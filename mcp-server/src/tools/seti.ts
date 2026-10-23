/**
 * Seti API tools.
 *
 * These wrap the backend as it exists. Two honesty constraints are baked in:
 *
 * - **Authentication is a prerequisite, not a detail.** The Seti API has no
 *   public keys; every route needs a Privy-issued bearer token, EXCEPT the public
 *   reads that exist to be opened signed out (a payee looked up by address, which
 *   is what a payer with no account uses). A missing token produces an error that
 *   says so plainly rather than a confusing 401 later, and the one credential-free
 *   Seti tool is marked as such here and in `docs/mcp.md`.
 * - **There is no endpoint for everything.** No standalone FX quote, no
 *   merchant list, no webhook management. Those tools do not exist here either,
 *   rather than being faked out of a neighbouring call.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { allowWrites } from '../config.js';
import { ToolError, toolError, toolJson } from '../errors.js';
import { setiPublicGet, setiRequest } from '../http.js';

const assetArg = z
  .enum(['ousd', 'pathusd'])
  .optional()
  .describe('Payment asset. v1 supports ousd (default) and pathusd only.');

export function registerSetiTools(server: McpServer): string[] {
  const registered: string[] = [];

  /**
   * The ONE Seti API tool that takes no token (#197).
   *
   * Every other tool here drives an account, so a token is the prerequisite. This one
   * answers a question a payer with no account has already asked by opening a payment
   * link: is the address this money goes to a merchant Seti reviewed, and when. The
   * route is deliberately public for that reason, so the tool sends no Authorization
   * header — claiming a credential the surface does not require would send an
   * integrator looking for an account they do not need.
   *
   * It reports the backend's answer verbatim rather than deciding: `name` and
   * `merchantVerifiedAt` arrive together only when a live claim is bound to the exact
   * address, its signature still verifies, AND a person reviewed the merchant. Anything
   * less is the handle with `name: null` (a name, not a verified merchant), and an
   * address with no Seti name is `payee: null`. An agent is told this in the description
   * because an agent that sees `name: null` and infers "untrusted" would be right, but
   * one that saw a handle and inferred "verified merchant" would not be.
   */
  server.registerTool(
    'seti_lookup_payee_address',
    {
      title: 'Look up a payee by address (no token)',
      description:
        'Ask what is known about the address a payment goes to. Returns the Seti handle bound to ' +
        'that exact address, plus `name` and `merchantVerifiedAt` — which are set TOGETHER, or not ' +
        'at all, and only when a live claim is bound to the address, its claim signature still ' +
        'verifies, AND a person at Seti reviewed the merchant record. Anything less answers the ' +
        'handle with `name: null`; an address with no Seti name answers `payee: null`. Read-only. ' +
        'Needs SETI_API_BASE_URL but NOT SETI_API_TOKEN: this is the read the public pay page uses.',
      inputSchema: {
        address: z
          .string()
          .describe(
            'The recipient address a charge names: 0x followed by 40 hex characters. Not a handle — ' +
              'use seti_resolve_merchant for a handle, a business name or a QR payload.'
          ),
      },
    },
    async ({ address }) => {
      try {
        const result = await setiPublicGet<{ payee: unknown }>('seti_lookup_payee_address', {
          path: `/public/payees/${encodeURIComponent(address)}`,
        });
        return toolJson(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_lookup_payee_address');

  server.registerTool(
    'seti_resolve_merchant',
    {
      title: 'Resolve a merchant QR payload',
      description:
        'Resolve a Seti payload through the one resolver: a username, a business name, a stored ' +
        "handle, a platform id or a Seti deep link (seti://pay?merchantId=…&amount=…), all as one " +
        'string. Returns the name, the ADDRESS the money goes to, and whether the binding verifies. ' +
        'Note this parser accepts only Seti-issued payloads; it does not read other QR standards.',
      inputSchema: {
        qr: z.string().describe('The scanned or pasted QR payload.'),
      },
    },
    async ({ qr }) => {
      try {
        const result = await setiRequest<{ handle: unknown; suggestedAmount: string | null }>({
          method: 'GET',
          path: '/handles/resolve',
          query: { q: qr },
        });
        return toolJson(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_resolve_merchant');

  server.registerTool(
    'seti_preview_payment',
    {
      title: 'Preview a merchant payment',
      description:
        'Get the server-computed preview for a payment: the principal, the platform fee, the GROSS ' +
        'the customer must sign for, the customer-currency conversion with its FX provenance, and ' +
        'whether the balance covers it. The amount is in the CUSTOMER\'s currency — the field is ' +
        'amountFiat on the wire, because that is what the customer actually enters.',
      inputSchema: {
        merchantId: z.string().describe('Merchant id, from seti_resolve_merchant.'),
        amountFiat: z.string().describe("Amount the customer pays, in their currency, e.g. \"250\"."),
        asset: assetArg,
      },
    },
    async ({ merchantId, amountFiat, asset }) => {
      try {
        const result = await setiRequest<{ preview: unknown }>({
          method: 'POST',
          path: '/transactions/preview',
          body: { merchantId, amountFiat, asset: asset ?? 'ousd' },
        });
        return toolJson({ preview: result.preview });
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_preview_payment');

  server.registerTool(
    'seti_get_transaction_status',
    {
      title: 'Get a transaction status',
      description:
        'Fetch the status, tx hash and settlement timestamps of one transaction you recorded. ' +
        'Statuses are pending, processing, completed, failed or reversed.',
      inputSchema: {
        transactionId: z.string().describe('The transaction id returned when the payment was recorded.'),
      },
    },
    async ({ transactionId }) => {
      try {
        const result = await setiRequest<unknown>({
          method: 'GET',
          path: `/transactions/${encodeURIComponent(transactionId)}/status`,
        });
        return toolJson(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_get_transaction_status');

  server.registerTool(
    'seti_get_balance',
    {
      title: 'Get a wallet balance',
      description:
        'Read the on-chain balance the Seti API reports for a user, in the payment asset. This is the ' +
        'same figure the payment preview checks against the gross.',
      inputSchema: {
        userId: z.string().describe('The Seti user id.'),
      },
    },
    async ({ userId }) => {
      try {
        const result = await setiRequest<unknown>({
          method: 'GET',
          path: `/users/${encodeURIComponent(userId)}/balance`,
        });
        return toolJson(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_get_balance');

  server.registerTool(
    'seti_list_transactions',
    {
      title: 'List recent transactions',
      description: 'List transactions for the authenticated account, newest first.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe('Page size, default 20.'),
        offset: z.number().int().min(0).optional().describe('Rows to skip, default 0.'),
      },
    },
    async ({ limit, offset }) => {
      try {
        const result = await setiRequest<unknown>({
          method: 'GET',
          path: '/transactions',
          query: { limit, offset },
        });
        return toolJson(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );
  registered.push('seti_list_transactions');

  /**
   * The only tool with a side effect, so it is registered only when writes are
   * explicitly enabled. A host that enables it should know that the backend
   * verifies the claimed amount against the on-chain receipt and fails closed:
   * a missing payout address, an unverifiable receipt, or a mismatch beyond 1%
   * are all refused rather than recorded.
   */
  if (allowWrites()) {
    server.registerTool(
      'seti_record_payment',
      {
        title: 'Record a settled payment (write)',
        description:
          'Record an already-broadcast payment. The backend reconciles the claimed amount against the ' +
          'on-chain receipt and refuses on a mismatch beyond 1%, a missing payout address, or an ' +
          'unverifiable receipt. In inside-transfer mode pass the GROSS that was signed; in batch mode ' +
          'pass the PRINCIPAL. Enabled only with SETI_MCP_ALLOW_WRITES=true.',
        inputSchema: {
          merchantId: z.string().describe('Merchant id.'),
          amount: z.string().describe('Amount in token units that was actually transferred (see description).'),
          txHash: z.string().regex(/^0x[a-fA-F0-9]+$/).describe('The broadcast transaction hash.'),
          asset: assetArg,
          description: z.string().optional(),
        },
      },
      async ({ merchantId, amount, txHash, asset, description }) => {
        try {
          if (!allowWrites()) {
            throw new ToolError('Writes are disabled. Set SETI_MCP_ALLOW_WRITES=true to enable this tool.');
          }
          const result = await setiRequest<unknown>({
            method: 'POST',
            path: '/transactions/pay',
            body: { merchantId, amount, asset: asset ?? 'ousd', txHash, description },
          });
          return toolJson(result);
        } catch (error) {
          return toolError(error);
        }
      }
    );
    registered.push('seti_record_payment');
  }

  return registered;
}
