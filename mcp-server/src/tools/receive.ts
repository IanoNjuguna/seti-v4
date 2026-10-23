/**
 * Receive-side tools: an agent asks to be paid, and reconciles what it was paid.
 *
 * ## Why these exist in this direction
 *
 * `tools/seti.ts` gives an agent the PAYER's side: resolve a merchant, preview a
 * payment, record one. The interesting direction for "anyone on the internet" is the
 * other one — an agent that needs money creates a request, hands back a link, and a
 * human pays it from any Tempo wallet. That is four tools, and none of them needs a
 * Seti account: the charge API's authorisation is the payee's own signature.
 *
 * ## No key ever lives here
 *
 * A charge is created by the RECIPIENT'S wallet signing seven fields. This server
 * cannot sign and must not be able to: an MCP server that signs for you is an MCP
 * server that owns your money, and it is also a prompt-injection target — a hostile
 * page could otherwise ask an agent to create a charge to an attacker's address and
 * have the signature produced for it.
 *
 * So the write is a two-call shape. With no `signature`, the tool returns the EXACT
 * EIP-712 typed data to sign plus the id and nonce it picked, and writes nothing. With
 * a `signature`, it posts the charge as the wallet signed it. The id and nonce are
 * returned so the second call signs over the same bytes the first one described; the
 * backend re-verifies the signature, so a mismatch is a refusal, not a stored charge.
 *
 * ## Refusals keep their code
 *
 * The API answers `{ error, code }` and the code is the one taxonomy every payment
 * uses. `setiPublicRequest` carries that code into the thrown error, so a wrong-wallet
 * signature surfaces as `charge-signature-invalid` rather than as a bare HTTP 422 or
 * a 500.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { defaultNetwork } from '../config.js';
import { ToolError, toolError, toolJson } from '../errors.js';
import { setiPublicRequest } from '../http.js';

/** The two Tempo networks, and the chain id each signature is bound to. */
const CHAIN_IDS = { mainnet: 4217, testnet: 42431 } as const;

/** The EIP-712 domain every Seti signature uses. Bump the version only if the DOMAIN changes. */
const CHARGE_DOMAIN = { name: 'Seti', version: '1' } as const;

/**
 * The charge struct, as the backend declares it.
 *
 * Duplicated here on purpose rather than imported across packages: this file is what
 * a wallet signs, and a dev-time check in the backend asserts the two agree field for
 * field (`backend/src/services/charge-tools.check.ts`). An import would hide that
 * agreement instead of testing it.
 */
const CHARGE_TYPES = {
  Charge: [
    { name: 'recipient', type: 'address' },
    { name: 'asset', type: 'string' },
    { name: 'amount', type: 'string' },
    { name: 'memo', type: 'string' },
    { name: 'id', type: 'string' },
    { name: 'expiresAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

/** The listing struct: which address, how many rows, and when it was signed. */
const CHARGE_LIST_TYPES = {
  ChargeList: [
    { name: 'recipient', type: 'string' },
    { name: 'limit', type: 'uint256' },
    { name: 'issuedAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

/** The four assets the charge API accepts. EURC.e is refused by the product, not by this list. */
const assetArg = z
  .enum(['ousd', 'pathusd', 'usdt0', 'usdc.e'])
  .optional()
  .describe('Asset the payer sends. Default ousd. USDT0 is mainnet only.');

/** The id rule the backend enforces, so a bad id is caught before a round trip. */
const CHARGE_ID = /^[a-z0-9][a-z0-9_-]{5,63}$/;

function chainIdFor(network: 'mainnet' | 'testnet' | undefined): number {
  return CHAIN_IDS[network ?? defaultNetwork()];
}

/** The typed data a payee's wallet signs to create one charge. */
function chargeTypedData(input: {
  chainId: number;
  recipient: string;
  asset: string;
  amount: string;
  memo: string;
  id: string;
  expiresAt: string;
  nonce: string;
}) {
  return {
    domain: { ...CHARGE_DOMAIN, chainId: input.chainId },
    types: CHARGE_TYPES,
    primaryType: 'Charge' as const,
    message: {
      recipient: input.recipient,
      asset: input.asset,
      amount: input.amount,
      memo: input.memo,
      id: input.id,
      expiresAt: input.expiresAt,
      nonce: input.nonce,
    },
  };
}

/** The typed data a payee's wallet signs to read its own charges. */
function chargeListTypedData(input: {
  chainId: number;
  recipient: string;
  limit: number;
  issuedAt: string;
  nonce: string;
}) {
  return {
    domain: { ...CHARGE_DOMAIN, chainId: input.chainId },
    types: CHARGE_LIST_TYPES,
    primaryType: 'ChargeList' as const,
    message: {
      recipient: input.recipient,
      limit: input.limit,
      issuedAt: input.issuedAt,
      nonce: input.nonce,
    },
  };
}

/** A pay link, a `seti://` URI or a bare id, reduced to the id it names. */
export function chargeIdFromLink(link: string): string | null {
  const trimmed = link.trim();
  if (CHARGE_ID.test(trimmed)) return trimmed;

  const uri = /^seti:\/\/pay\/?(?:\?id=)?([a-z0-9][a-z0-9_-]{5,63})$/i.exec(trimmed);
  if (uri?.[1]) return uri[1].toLowerCase();

  const url = /^https?:\/\/[^/]+\/pay\/([a-z0-9][a-z0-9_-]{5,63})\/?(?:\?.*)?$/i.exec(trimmed);
  if (url?.[1]) return url[1].toLowerCase();

  return null;
}

/** One charge, plus the two strings a human can act on. */
async function loadCharge(id: string) {
  const payload = await setiPublicRequest<{ charge: Record<string, unknown> }>('This tool', {
    method: 'GET',
    path: `/public/charges/${encodeURIComponent(id)}`,
  });
  return payload.charge;
}

export function registerReceiveTools(server: McpServer): string[] {
  const registered: string[] = [];

  server.registerTool(
    'seti_create_payment_request',
    {
      title: 'Ask to be paid: create a charge',
      description:
        'Create a payment request that anyone can pay from a Tempo wallet, and get back the id, the ' +
        'page link and the seti:// URI to hand a human. NO KEY IS HELD HERE: called without a ' +
        'signature it WRITES NOTHING and returns the exact EIP-712 typed data for YOUR wallet to sign, ' +
        'plus the id and nonce it picked; call it again with that signature to create the charge. The ' +
        'signature must come from the recipient address itself, so never sign one you did not read. ' +
        'Amounts are decimal TOKEN units ("250.000000"), 6 decimals.',
      inputSchema: {
        recipient: z.string().describe("The payee's address: the wallet that must sign, and where the money lands."),
        amount: z.string().describe('Amount owed, in token units, e.g. "250.000000".'),
        memo: z.string().max(512).describe('What the payer reads on the page. Say what this is for.'),
        expiresInMinutes: z
          .number()
          .int()
          .min(1)
          .max(1440)
          .optional()
          .describe('How long the request stays payable. Default 60, max 1440 (24 hours).'),
        expiresAt: z
          .string()
          .optional()
          .describe(
            'The exact ISO instant to sign. Omit on the first call: the answer names the value it chose, and the ' +
              'signed call must pass THAT value, because a deadline computed twice is two different messages.'
          ),
        asset: assetArg,
        network: z.enum(['mainnet', 'testnet']).optional().describe('Which Tempo network. Default from TEMPO_CHAIN_ID.'),
        id: z.string().optional().describe('Charge id. Omit and one is generated; reuse the value returned with the typed data.'),
        nonce: z.string().optional().describe('Signing nonce. Omit and one is generated; reuse the value returned with the typed data.'),
        signature: z
          .string()
          .optional()
          .describe("The recipient wallet's EIP-712 signature over the typed data. Omit on the first call."),
      },
    },
    async ({ recipient, amount, memo, expiresInMinutes, expiresAt, asset, network, id, nonce, signature }) => {
      try {
        const chainId = chainIdFor(network);
        const chargeId = (id ?? (randomUUID().replace(/-/g, '').slice(0, 20) as string)).toLowerCase();
        if (!CHARGE_ID.test(chargeId)) {
          throw new ToolError(
            `"${chargeId}" is not a usable charge id: it must match ${CHARGE_ID} (lower case, 6 to 64 characters).`
          );
        }

        const message = {
          recipient,
          asset: asset ?? 'ousd',
          amount,
          memo,
          id: chargeId,
          expiresAt: expiresAt ?? new Date(Date.now() + (expiresInMinutes ?? 60) * 60_000).toISOString(),
          nonce: nonce ?? randomUUID(),
        };

        // No signature: describe what to sign, write nothing. This is the half of the
        // shape that keeps a key out of this process.
        if (!signature) {
          return toolJson({
            needsSignature: true,
            wrote: false,
            chainId,
            typedData: chargeTypedData({ chainId, ...message }),
            next:
              'Sign this typed data with the wallet for `recipient`, then call seti_create_payment_request again ' +
              'with the same recipient, id, nonce, amount, asset, memo, expiresAt and network, plus `signature`.',
          });
        }

        const created = await setiPublicRequest<{ charge: Record<string, unknown> }>(
          'seti_create_payment_request',
          {
            method: 'POST',
            path: '/public/charges',
            body: { ...message, signature },
          }
        );

        const charge = created.charge ?? {};
        return toolJson({
          charge,
          pageUrl: charge.pageUrl ?? null,
          uri: charge.uri ?? null,
          payable: true,
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_create_payment_request');

  server.registerTool(
    'seti_get_charge',
    {
      title: 'Get a charge by id',
      description:
        'Fetch one charge: amount, asset, memo, status (pending, paid, expired, cancelled), txHash when ' +
        'a transfer settled it, and the page link. This is the same read the pay page performs, so it ' +
        'needs no account and no token.',
      inputSchema: {
        id: z.string().describe('The charge id.'),
      },
    },
    async ({ id }) => {
      try {
        return toolJson({ charge: await loadCharge(id) });
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_get_charge');

  server.registerTool(
    'seti_resolve_pay_link',
    {
      title: 'Resolve a pay link to the charge it names',
      description:
        'Turn what a human pasted — a https://seti.live/pay/<id> link, a seti://pay/<id> URI from a QR ' +
        'code, or a bare charge id — into the charge itself, so an agent can act on the request it was ' +
        'handed. A string that is not one of those is refused rather than guessed at.',
      inputSchema: {
        link: z.string().describe('The pasted link, URI or id.'),
      },
    },
    async ({ link }) => {
      try {
        const id = chargeIdFromLink(link);
        if (!id) {
          throw new ToolError(
            `"${link}" is not a Seti pay link, a seti://pay URI or a charge id. Expected https://<host>/pay/<id>, seti://pay/<id> or the id on its own.`
          );
        }
        return toolJson({ id, charge: await loadCharge(id) });
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_resolve_pay_link');

  server.registerTool(
    'seti_list_received',
    {
      title: 'List the charges a wallet issued',
      description:
        'Recent charges for ONE address, newest first, with their statuses, so an agent can reconcile ' +
        'its own invoices. Signed by the payee like every managing call: called without a signature it ' +
        'returns the typed data to sign and reads nothing. The listing is the payee\'s own set, which is ' +
        'why it needs the payee\'s key even though a single charge is public.',
      inputSchema: {
        recipient: z.string().describe('The payee address whose charges to list.'),
        limit: z.number().int().min(1).max(50).optional().describe('Rows to return. Default 20, max 50.'),
        network: z.enum(['mainnet', 'testnet']).optional().describe('Which Tempo network. Default from TEMPO_CHAIN_ID.'),
        issuedAt: z.string().optional().describe('ISO instant the signature was made. Omit on the first call.'),
        nonce: z.string().optional().describe('Signing nonce. Omit on the first call.'),
        signature: z.string().optional().describe('The payee wallet\'s EIP-712 signature over the ChargeList typed data.'),
      },
    },
    async ({ recipient, limit, network, issuedAt, nonce, signature }) => {
      try {
        const chainId = chainIdFor(network);
        const rows = limit ?? 20;
        const signedAt = issuedAt ?? new Date().toISOString();
        const signingNonce = nonce ?? randomUUID();

        if (!signature) {
          return toolJson({
            needsSignature: true,
            read: false,
            chainId,
            typedData: chargeListTypedData({
              chainId,
              recipient,
              limit: rows,
              issuedAt: signedAt,
              nonce: signingNonce,
            }),
            next:
              'Sign this typed data with the wallet for `recipient`, then call seti_list_received again with ' +
              'the same recipient, limit, network, issuedAt and nonce, plus `signature`.',
          });
        }

        const listed = await setiPublicRequest<{
          charges: Record<string, unknown>[];
          count: number;
        }>('seti_list_received', {
          method: 'GET',
          path: '/public/charges',
          query: { recipient, limit: rows },
          headers: {
            'x-seti-signature': signature,
            'x-seti-issued-at': signedAt,
            'x-seti-nonce': signingNonce,
          },
        });

        return toolJson({ count: listed.count, charges: listed.charges });
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_list_received');

  return registered;
}
