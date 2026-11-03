/**
 * `npm run check:convert-pairs`: the swap surface's allowlist, published once.
 *
 * Run with:  npm run check:convert-pairs     (the last entry in `npm run verify`)
 *
 * Requires:  docker compose up -d  (the `seti-postgres` container) for the route
 *            section, which authenticates through the development bypass and needs a
 *            user row, and which counts that nothing was written. The derivation and
 *            the two-network assertions below need no database.
 *
 * WHY THIS EXISTS
 *
 * The web app is growing a swap page at /app/swap, and its picker has to know which
 * pairs exist on the caller's network and into which assets. That list lives in ONE
 * place in this repository: `CONVERT_PAIRS` in `services/convert.ts`, which is the
 * allowlist `/convert/quote` refuses against (`convert-pair-unavailable`). A copy in
 * the client would be a second answer to the same question, and the two would drift
 * the first time a pair is added or a book empties: the page would keep offering a
 * button the server refuses. So `GET /transactions/convert/pairs` exists, and it is
 * a read of that constant and nothing else. This suite holds it to the allowlist.
 *
 * WHAT IS ASSERTED
 *
 *  1. BOTH NETWORKS, 4217 mainnet and 42431 practice, reached by PASSING the network
 *     to `convertPairsFor` rather than by mutating the environment. A suite that only
 *     ever looks at the network this box happens to serve cannot see the other one,
 *     and the two allowlists differ: `usdt0` is on mainnet's and not on practice's,
 *     because Tempo does not list that token on practice at all.
 *  2. The derivation itself: `pairs` is the allowlist expanded both ways, in its own
 *     order, with nothing invented and nothing duplicated; `targets` is the distinct
 *     outs of exactly those pairs; no pair has the same asset on both sides; every
 *     pair is one `isAllowedPair` accepts, so a picker built from this list cannot
 *     offer a swap the quote route then refuses.
 *  3. The route, over HTTP and through the real auth hook: registered as a GET and
 *     never as a write, it answers what the helper says for the SERVED network, it
 *     carries pairs and targets and nothing else, an anonymous caller gets the API's
 *     own 401, and the whole thing writes no row.
 *
 * WHAT IT DELIBERATELY DOES NOT ASSERT: the book. Whether a pair has resting orders
 * at 03:00 is Tempo's inventory, and `check:convert` reports it. This file is about
 * the LIST we publish, which is ours.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { AUTH_UNAUTHORIZED } from './auth.js';
import { isListedOn, networkConfigFor, servedNetwork } from './chain.js';
import { CONVERT_PAIRS, isAllowedPair } from './convert.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { apiErrorHandler } from '../server.js';
import {
  convertPairsFor,
  transactionRoutes,
  type ConvertPairView,
  type ConvertPairsView,
} from '../routes/transactions.js';
import type { Network } from '../lib/network.js';
import type { SupportedAsset } from '../config/assets.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/** The path under test, in one place for the six requests and assertions below. */
const PAIRS_PATH = '/transactions/convert/pairs';

/** The account the development bypass attaches every request to. */
const DEV_TEST_EMAIL = 'dev@seti.test';

/** Both networks the product speaks about, named explicitly rather than served. */
const NETWORKS: readonly Network[] = ['mainnet', 'testnet'];

/** `usdt0 → ousd`, for a line or a detail column. */
function pairLabel(pair: ConvertPairView): string {
  return `${pair.in} → ${pair.out}`;
}

/**
 * The allowlist expanded both ways, worked out HERE rather than asked of the route.
 *
 * That independence is the whole value of the assertion: comparing the route to the
 * same function it calls would prove only that a function returns what it returns.
 */
function bidirectional(network: Network): ConvertPairView[] {
  return CONVERT_PAIRS[network].flatMap(([a, b]) => [
    { in: a, out: b },
    { in: b, out: a },
  ]);
}

/** The distinct outs of a list of pairs, in the order they are met. */
function targetsOf(pairs: readonly ConvertPairView[]): SupportedAsset[] {
  const targets: SupportedAsset[] = [];
  for (const pair of pairs) {
    if (!targets.includes(pair.out)) targets.push(pair.out);
  }
  return targets;
}

/**
 * Ask the route as a caller with NO session.
 *
 * This process runs with `DEV_BYPASS_AUTH=true` (the npm script sets it, like every
 * other suite that drives a route through the real auth hook), so leaving the header
 * off would not produce an anonymous request: the bypass would attach the dev
 * fixture and the route would cheerfully answer it. The fallback is therefore turned
 * OFF for exactly this one request and put back in a `finally`, which is what makes
 * the 401 the hook's own refusal rather than an assumption about it. A throw here
 * cannot leave the suite authenticating everything afterwards.
 */
async function injectWithoutSession(app: FastifyInstance) {
  const forwarded = env.DEV_BYPASS_AUTH;
  env.DEV_BYPASS_AUTH = 'false';
  try {
    return await app.inject({ method: 'GET', url: PAIRS_PATH });
  } finally {
    env.DEV_BYPASS_AUTH = forwarded;
  }
}

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // (a) the derivation, on BOTH networks
  // -------------------------------------------------------------------------
  for (const network of NETWORKS) {
    const chainId = networkConfigFor(network).chainId;
    console.log(`\n${network} (chain ${chainId}):`);

    const view = convertPairsFor(network);
    const expected = bidirectional(network);

    for (const pair of view.pairs) console.log(`     ${pairLabel(pair)}`);
    console.log(`     targets: ${view.targets.join(', ')}`);

    // Both directions of one entry are one book, so an allowlist that named the same
    // pair twice would be a duplicate rather than a second market. Asserted because
    // the expansion below assumes it: without this, a duplicate entry would make the
    // route (which dedupes) and the expectation (which does not) disagree for a
    // reason that has nothing to do with the route.
    const canonical = CONVERT_PAIRS[network].map(([a, b]) => [a, b].sort().join('↔'));
    check(
      `${network}: the allowlist names no pair twice, in either direction`,
      new Set(canonical).size === canonical.length,
      `${CONVERT_PAIRS[network].length} entries`
    );

    check(
      `${network}: pairs are the allowlist expanded BOTH ways, in its own order`,
      JSON.stringify(view.pairs) === JSON.stringify(expected),
      `${view.pairs.length} pairs`
    );

    check(
      `${network}: targets are the distinct outs of those pairs, in order of appearance`,
      JSON.stringify(view.targets) === JSON.stringify(targetsOf(expected)),
      view.targets.join(', ')
    );

    // The gate the quote route refuses with. A picker built from a pair this rejects
    // would show a control that can only ever answer `convert-pair-unavailable`.
    const unaccepted = view.pairs.filter((pair) => !isAllowedPair(pair.in, pair.out, network));
    check(
      `${network}: every offered pair is one isAllowedPair accepts`,
      unaccepted.length === 0,
      unaccepted.map(pairLabel).join(', ')
    );

    // `assertConvertible` refuses it before the book is read, so offering it would be
    // offering a guarantee of `convert-same-asset`.
    const sameAsset = view.pairs.filter((pair) => pair.in === pair.out);
    check(
      `${network}: no offered pair has the same asset on both sides`,
      sameAsset.length === 0,
      sameAsset.map(pairLabel).join(', ')
    );

    // A target the chain does not list cannot be received at all: USDT0 on practice
    // is exactly this case, and it is why the two networks' lists differ.
    const unlisted = view.targets.filter((asset) => !isListedOn(asset, network));
    check(
      `${network}: every target is an asset this network lists`,
      unlisted.length === 0,
      unlisted.join(', ')
    );

    // Every asset the allowlist names must be reachable as a destination, because both
    // directions are offered. This fails if `targets` is ever narrowed to the written
    // direction only, which would hide half of every pair from a destination control.
    const named = new Set<SupportedAsset>(CONVERT_PAIRS[network].flatMap(([a, b]) => [a, b]));
    const missing = [...named].filter((asset) => !view.targets.includes(asset));
    check(
      `${network}: every asset the allowlist names is reachable as a target`,
      missing.length === 0,
      missing.join(', ')
    );
  }

  // -------------------------------------------------------------------------
  // (b) the two networks differ where the CHAIN differs, and nowhere else
  // -------------------------------------------------------------------------
  console.log('\nacross the two networks:');

  const live = convertPairsFor('mainnet');
  const practice = convertPairsFor('testnet');

  check(
    'usdt0 is a convert target on mainnet',
    live.targets.includes('usdt0'),
    live.targets.join(', ')
  );
  check(
    'and never on practice, where USDT0 is not a listed token',
    !practice.targets.includes('usdt0'),
    practice.targets.join(', ')
  );
  check(
    'practice narrows live: every pair it offers, mainnet offers too',
    practice.pairs.every((pair) =>
      live.pairs.some((offered) => offered.in === pair.in && offered.out === pair.out)
    )
  );
  check(
    'and every practice target is a mainnet target, so practice invents nothing',
    practice.targets.every((asset) => live.targets.includes(asset)),
    practice.targets.join(', ')
  );

  // WHAT IS NOT ASSERTED HERE, and why. The issue behind this route expected
  // `targets` to be `['ousd', 'usdt0']` on mainnet and "mainnet minus USDT0" on
  // practice. That is not what a bidirectional expansion produces, and pinning it as
  // a literal would pin a wrong answer: mainnet's allowlist also pays out to `usdc.e`
  // and `pathusd` (those are the assets its books quote into), and practice's single
  // pair pays out to both `ousd` and `pathusd`. What IS derivable, and is asserted
  // above, is that practice never invents a target, and that `usdt0` is the one asset
  // the two lists disagree about because of the CHAIN rather than the product. A
  // literal here would go red the first time the allowlist changed, which is exactly
  // the drift this route exists to prevent.

  // -------------------------------------------------------------------------
  // (c) the route, over HTTP, through the real auth hook
  // -------------------------------------------------------------------------
  console.log(`\nthe route (GET ${PAIRS_PATH}):`);

  const app: FastifyInstance = Fastify();
  app.setErrorHandler(apiErrorHandler);
  await app.register(transactionRoutes, { prefix: '/transactions' });
  await app.ready();

  // The bypass attaches this account on every request, so it exists before the count:
  // a row created by the first request would otherwise read as a write by a read.
  const devUser = await prisma.user.upsert({
    where: { email: DEV_TEST_EMAIL },
    update: {},
    create: { email: DEV_TEST_EMAIL },
  });

  const rowsBefore = await prisma.transaction.count({ where: { userId: devUser.id } });

  try {
    // A registered path runs its hooks; an unregistered one is a 404 before any hook
    // is reached. This pair is what makes the 401 below evidence that the LITERAL was
    // routed to the route rather than the router finding nothing.
    check(`the route is registered as a GET ${PAIRS_PATH}`, app.hasRoute({ method: 'GET', url: PAIRS_PATH }));
    check(
      'and never as a write: there is nothing here to write',
      !app.hasRoute({ method: 'POST', url: PAIRS_PATH }) &&
        !app.hasRoute({ method: 'PUT', url: PAIRS_PATH }) &&
        !app.hasRoute({ method: 'PATCH', url: PAIRS_PATH }) &&
        !app.hasRoute({ method: 'DELETE', url: PAIRS_PATH })
    );

    const answered = await app.inject({ method: 'GET', url: PAIRS_PATH });
    check(
      'an authenticated caller gets 200',
      answered.statusCode === 200,
      String(answered.statusCode)
    );

    const body = answered.json<ConvertPairsView>();
    console.log(`     ${JSON.stringify(body)}`);

    // The route is a passthrough of `convertPairsFor(session network)`. Driven over
    // HTTP for the SERVED network, because that is the network the bypass account
    // acts on by construction (`middleware/auth.ts` re-derives it per request); the
    // other network is covered by the derivation above, and this equality is what
    // ties the two together.
    check(
      `the body is exactly convertPairsFor('${servedNetwork}')`,
      JSON.stringify(body) === JSON.stringify(convertPairsFor(servedNetwork)),
      servedNetwork
    );
    check(
      'and it carries nothing but pairs and targets: no balance, no quote, no user',
      Object.keys(body).sort().join(',') === 'pairs,targets' &&
        body.pairs.every((pair) => Object.keys(pair).sort().join(',') === 'in,out'),
      Object.keys(body).join(',')
    );

    const anonymous = await injectWithoutSession(app);
    const refusal = anonymous.json<{ code?: string }>();
    check(
      'a caller with no session is refused with the API 401, not answered',
      anonymous.statusCode === 401 && refusal.code === AUTH_UNAUTHORIZED,
      `${anonymous.statusCode} ${refusal.code ?? 'no-code'}`
    );
  } finally {
    await app.close();
  }

  const rowsAfter = await prisma.transaction.count({ where: { userId: devUser.id } });
  check(
    'asking which pairs exist wrote no row: the allowlist is a read',
    rowsAfter === rowsBefore,
    `${rowsBefore} → ${rowsAfter}`
  );

  console.log('-'.repeat(74));
  console.log(
    failures === 0 ? `All ${total} checks passed.` : `${failures} of ${total} checks FAILED.`
  );
  if (failures > 0) process.exit(1);
}

void main();
