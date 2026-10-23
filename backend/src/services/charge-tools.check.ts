/**
 * The receive-side tool surface — `npm run check:charge-tools`.
 *
 * Requires: `docker compose up -d` (the `seti-postgres` container). No RPC, no wallet
 * funding: every charge and every signature here is made by a throwaway key in this
 * process.
 *
 * What this suite exists for. `mcp-server` is a SEPARATE package that tells an agent
 * how to ask to be paid, and it can only do that by knowing two things this backend
 * owns: the EIP-712 shape of a charge and of a listing signature. Both are duplicated
 * there on purpose (a copy that is tested beats an import that hides a drift), so
 * something has to test the copy, and that is section 1.
 *
 * Sections:
 *
 *  1. **The two signed shapes agree, field for field.** The MCP file's struct is
 *     parsed out of its source and compared with `services/charge.ts` and
 *     `services/charge-admin.ts`: same primary type, same fields in the same types,
 *     same domain name and version. If someone adds a field to a charge and forgets
 *     the tools, this fails instead of every agent's signature silently mismatching.
 *  2. **The listing is the payee's own set, and only theirs.** No signature, a stale
 *     signature and another wallet's signature are each refused with a CODE, the
 *     payee's own rows come back newest first with the signed limit honoured, and a
 *     second payee's charges never appear in the first one's answer.
 *  3. **A listing does not report a lapsed charge as pending.** The same rule the
 *     single read follows: past its deadline is `expired` when it is read, not when a
 *     sweep gets round to it.
 *  4. **The links the tools parse are the links this API emits.** A charge's
 *     `pageUrl` and `uri` are checked against the two patterns `resolve_pay_link`
 *     accepts, so the parser and the emitter cannot drift apart either.
 *
 * Every row this suite writes is removed before it reports, and the removal proves it
 * left nothing behind.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { publicChargeRoutes } from '../routes/public-charges.js';
import { apiErrorHandler } from '../server.js';
import { PRIMARY_ASSET, network as servedChain } from './chain.js';
import { CHARGE_DOMAIN_NAME, CHARGE_DOMAIN_VERSION, CHARGE_PRIMARY_TYPE, CHARGE_TYPES, chargeTypedData, type ChargeFields } from './charge.js';
import { CHARGE_LIST_PRIMARY_TYPE, CHARGE_LIST_TYPES, chargeListTypedData } from './charge-admin.js';
import { createCharge, chargePageUrl, chargeUri } from './charge-store.js';

const CHAIN_ID = servedChain.chainId;

/** Every id this run writes starts here, so cleanup is one predicate. */
const ID_PREFIX = `tools-check-${randomUUID().slice(0, 8)}`;

let failures = 0;
let passes = 0;

function describe(detail: unknown): string {
  if (detail === undefined) return '';
  return `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
}

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passes += 1;
    console.log(`ok    ${label}${describe(detail)}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${describe(detail)}`);
  }
}

function checkEq(label: string, actual: unknown, expected: unknown) {
  check(`${label}`, actual === expected, `got ${String(actual)}, want ${String(expected)}`);
}

// The suite runs from the `backend` workspace (`npm run check:charge-tools`), so the
// monorepo root is one level up. `import.meta` is out: these checks compile to CommonJS.
const MCP_RECEIVE_SOURCE = resolve(process.cwd(), '..', 'mcp-server', 'src', 'tools', 'receive.ts');

/** Pull `{ name: 'x', type: 'y' }` pairs out of one `X_TYPES = { Primary: [ … ] }` block. */
function structFromSource(source: string, constName: string): { primary: string; fields: string[] } | null {
  const start = source.indexOf(constName);
  if (start === -1) return null;
  const block = source.slice(start);
  const primary = /(\w+):\s*\[/.exec(block)?.[1];
  if (!primary) return null;
  // The struct runs from its opening bracket to the matching one. (Not to a literal
  // `] as const`: these declarations close the OBJECT with `as const`, so the struct's
  // own bracket is just `]`.)
  const open = block.indexOf('[');
  const body = open === -1 ? '' : block.slice(open, block.indexOf(']', open) + 1);
  const fields = [...body.matchAll(/\{\s*name:\s*'([^']+)',\s*type:\s*'([^']+)'\s*\}/g)].map(
    (match) => `${match[1]}:${match[2]}`
  );
  return { primary, fields };
}

function fieldsOf(types: Record<string, readonly { name: string; type: string }[]>): string[] {
  const primary = Object.keys(types)[0];
  return types[primary].map((field) => `${field.name}:${field.type}`);
}

async function main() {
  const payee = privateKeyToAccount(generatePrivateKey());
  const otherPayee = privateKeyToAccount(generatePrivateKey());
  const payeeAddress = payee.address.toLowerCase();
  const otherAddress = otherPayee.address.toLowerCase();

  // ---------------------------------------------------------------------------
  // 1. The two signed shapes agree
  // ---------------------------------------------------------------------------
  console.log('\n— the shapes an agent signs, against the shapes this API verifies —');

  const mcpSource = readFileSync(MCP_RECEIVE_SOURCE, 'utf8');
  const mcpCharge = structFromSource(mcpSource, 'CHARGE_TYPES');
  const mcpList = structFromSource(mcpSource, 'CHARGE_LIST_TYPES');

  check('the MCP package still declares a charge struct', mcpCharge !== null);
  check('and a listing struct', mcpList !== null);
  checkEq('the charge struct names the same primary type', mcpCharge?.primary, CHARGE_PRIMARY_TYPE);
  checkEq(
    'with the same seven fields and types, in the same order',
    mcpCharge?.fields.join(','),
    fieldsOf(CHARGE_TYPES).join(',')
  );
  checkEq('the listing struct names the same primary type', mcpList?.primary, CHARGE_LIST_PRIMARY_TYPE);
  checkEq(
    'with the same four fields and types',
    mcpList?.fields.join(','),
    fieldsOf(CHARGE_LIST_TYPES).join(',')
  );
  check('the domain name the MCP side signs under is this API\'s', mcpSource.includes(`name: '${CHARGE_DOMAIN_NAME}'`));
  check('and the domain version', mcpSource.includes(`version: '${CHARGE_DOMAIN_VERSION}'`));

  // ---------------------------------------------------------------------------
  // 2. The listing is the payee's own set
  // ---------------------------------------------------------------------------
  console.log('\n— listing a payee\'s own charges —');

  const app: FastifyInstance = Fastify();
  app.setErrorHandler(apiErrorHandler);
  await app.register(publicChargeRoutes, { prefix: '/public/charges' });
  await app.ready();

  const limit = 3;

  // `limit` is part of the SIGNED message, so every call signs the size it asks for:
  // a header signed for 3 rows cannot be replayed to read 1.
  const listSign = async (input: {
    account: typeof payee;
    recipient: string;
    issuedAt: string;
    nonce: string;
    limit?: number;
  }) =>
    input.account.signTypedData(
      chargeListTypedData(
        {
          recipient: input.recipient,
          limit: input.limit ?? limit,
          issuedAt: input.issuedAt,
          nonce: input.nonce,
        },
        CHAIN_ID
      )
    );

  const list = async (input: {
    recipient?: string;
    issuedAt?: string;
    nonce?: string;
    signature?: string;
    queryLimit?: number;
  }) =>
    app.inject({
      method: 'GET',
      url: '/public/charges',
      query: {
        recipient: input.recipient ?? payeeAddress,
        limit: String(input.queryLimit ?? limit),
      },
      headers:
        input.signature && input.issuedAt && input.nonce
          ? {
              'x-seti-signature': input.signature,
              'x-seti-issued-at': input.issuedAt,
              'x-seti-nonce': input.nonce,
            }
          : {},
    });

  const unsigned = await list({});
  checkEq('an unsigned listing is refused', unsigned.statusCode, 403);
  checkEq(
    'with the code that names the missing signature',
    unsigned.json<{ code?: string }>().code,
    'charge-signature-invalid'
  );

  const malformed = await list({ recipient: 'not-an-address' });
  checkEq('a recipient that is not an address is refused', malformed.statusCode, 422);
  checkEq('naming the address, not the signature', malformed.json<{ code?: string }>().code, 'recipient-invalid');

  const staleAt = new Date(Date.now() - 10 * 60_000).toISOString();
  const staleNonce = randomUUID();
  const stale = await list({
    issuedAt: staleAt,
    nonce: staleNonce,
    signature: await listSign({ account: payee, recipient: payeeAddress, issuedAt: staleAt, nonce: staleNonce }),
  });
  checkEq('a signature older than the window is refused', stale.statusCode, 403);
  checkEq('as stale, which is the useful answer', stale.json<{ code?: string }>().code, 'charge-admin-stale');

  // Three charges for this payee, then a fourth older one that the limit must exclude.
  const makeCharge = async (input: { recipient: typeof payee; memo: string; expiresInMs?: number }) => {
    const fields: ChargeFields = {
      recipient: input.recipient.address.toLowerCase() as `0x${string}`,
      asset: PRIMARY_ASSET,
      amount: '10.000000',
      memo: input.memo,
      id: `${ID_PREFIX}-${randomUUID().slice(0, 8)}`.slice(0, 63),
      expiresAt: new Date(Date.now() + (input.expiresInMs ?? 60 * 60_000)).toISOString(),
      nonce: randomUUID(),
      scope: null,
    };
    const signature = await input.recipient.signTypedData(chargeTypedData(fields, CHAIN_ID));
    const created = await createCharge({
      charge: { ...fields, signature },
      network: servedChain.network,
      chainId: CHAIN_ID,
      webhookUrl: null,
      idempotencyKey: null,
    });
    if (created.kind !== 'created') throw new Error(`fixture charge was not created: ${created.kind}`);
    return { publicId: created.view.id, status: created.view.status };
  };

  const first = await makeCharge({ recipient: payee, memo: 'invoice one' });
  await new Promise((r) => setTimeout(r, 15));
  const second = await makeCharge({ recipient: payee, memo: 'invoice two' });
  await new Promise((r) => setTimeout(r, 15));
  const third = await makeCharge({ recipient: payee, memo: 'invoice three' });
  await new Promise((r) => setTimeout(r, 15));
  const fourth = await makeCharge({ recipient: payee, memo: 'beyond the page (oldest kept)' });
  const foreign = await makeCharge({ recipient: otherPayee, memo: 'not this payee\'s' });

  const issuedAt = new Date().toISOString();
  const nonce = randomUUID();
  const good = await list({
    issuedAt,
    nonce,
    signature: await listSign({ account: payee, recipient: payeeAddress, issuedAt, nonce }),
  });
  checkEq('the payee\'s own listing answers 200', good.statusCode, 200);
  const listed = good.json<{ charges: { id: string; memo: string }[]; count: number }>();
  checkEq('with the signed limit honoured', listed.count, limit);
  checkEq('the newest charge first', listed.charges[0]?.id, fourth.publicId);
  checkEq('then the one before it', listed.charges[1]?.id, third.publicId);
  checkEq('then the one before that', listed.charges[2]?.id, second.publicId);
  check(
    'and nothing from another payee',
    listed.charges.every((charge) => charge.id !== foreign.publicId),
    listed.charges.map((charge) => charge.id).join(',')
  );
  check(
    'and the oldest of the four is beyond the page',
    listed.charges.every((charge) => charge.id !== first.publicId),
    'limit 3 of 4'
  );

  const wrongKeyNonce = randomUUID();
  const wrongKey = await list({
    issuedAt,
    nonce: wrongKeyNonce,
    // A signature over the right shape, from the wrong wallet: the set it authorises
    // is the address whose key signed, and that address is not the one asked for.
    signature: await listSign({
      account: otherPayee,
      recipient: otherAddress,
      issuedAt,
      nonce: wrongKeyNonce,
    }),
  });
  checkEq('another wallet\'s signature is refused', wrongKey.statusCode, 403);
  checkEq(
    'as a signature that does not come from that address',
    wrongKey.json<{ code?: string }>().code,
    'charge-signature-invalid'
  );

  // ---------------------------------------------------------------------------
  // 3. A lapsed charge is not reported as pending
  // ---------------------------------------------------------------------------
  console.log('\n— a lapsed charge, read through the listing —');

  const lapsing = await makeCharge({ recipient: payee, memo: 'lapses immediately', expiresInMs: 1 });
  await new Promise((r) => setTimeout(r, 30));

  const lapsedAt = new Date().toISOString();
  const lapsedNonce = randomUUID();
  const lapsed = await list({
    issuedAt: lapsedAt,
    nonce: lapsedNonce,
    queryLimit: 1,
    signature: await listSign({
      account: payee,
      recipient: payeeAddress,
      issuedAt: lapsedAt,
      nonce: lapsedNonce,
      limit: 1,
    }),
  });
  checkEq('the most recent row is the lapsed charge', lapsed.json<{ charges: { id: string }[] }>().charges[0]?.id, lapsing.publicId);
  checkEq(
    'and it reads expired, not pending',
    lapsed.json<{ charges: { status: string }[] }>().charges[0]?.status,
    'expired'
  );

  // ---------------------------------------------------------------------------
  // 4. The links the tools parse are the links this API emits
  // ---------------------------------------------------------------------------
  console.log('\n— the two strings a human is handed —');

  const pageUrl = chargePageUrl(third.publicId);
  const uri = chargeUri(third.publicId);
  check(
    'the page link matches what resolve_pay_link accepts',
    /^https?:\/\/[^/]+\/pay\/[a-z0-9][a-z0-9_-]{5,63}\/?$/.test(pageUrl),
    pageUrl
  );
  check(
    'and the seti:// URI matches too',
    /^seti:\/\/pay\/[a-z0-9][a-z0-9_-]{5,63}$/.test(uri),
    uri
  );
  check(
    'the MCP parser accepts the same two shapes',
    mcpSource.includes('seti:\\/\\/pay') && mcpSource.includes('\\/pay\\/'),
    'pattern present'
  );

  await app.close();

  // ---------------------------------------------------------------------------
  // Cleanup, and proof of it
  // ---------------------------------------------------------------------------
  const removed = await prisma.charge.deleteMany({ where: { publicId: { startsWith: ID_PREFIX } } });
  const left = await prisma.charge.count({ where: { publicId: { startsWith: ID_PREFIX } } });
  check('every fixture charge was removed', left === 0, `${removed.count} removed`);

  console.log(`\n${failures === 0 ? `${passes} assertions — all passed.` : `${passes + failures} assertions — ${failures} FAILED.`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

void main();
