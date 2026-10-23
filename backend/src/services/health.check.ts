/**
 * Health checks: the liveness body names the Tempo network this process serves.
 *
 * Run with:  npm run check:health
 * Requires:  nothing. No database, no RPC, no wallet — the whole suite is a pure
 *            function plus one Fastify `inject`, which is the property `/health`
 *            must keep: it has to answer while Postgres is down.
 *
 * The bug this pins is a deployment one, not a routing one. The client is built
 * with `NEXT_PUBLIC_TEMPO_CHAIN_ID` and the API reads `TEMPO_CHAIN_ID` from the
 * box's `.env.production` — two separate settings that nothing compares
 * (`docs/internal/ci.md` §2). A Worker built for one chain in front of an API
 * serving the other signs every payment on a chain the API will not reconcile
 * against, and both deploys still report success. So the check asserts three
 * things the fix has to get right:
 *
 * 1. the body's network, chain id and label are derived from `servedNetwork`,
 *    the same constant every route branches on — not literals that could drift;
 * 2. the three agree with each other in both directions, so the pair a reader
 *    compares against their client build means one thing;
 * 3. the comparison a reader makes actually discriminates: a body naming the
 *    other chain is rejected. A check that only asserted "there is a chainId"
 *    would pass on a body that always said mainnet.
 *
 * The body's key set is asserted too, because this route is unauthenticated: a
 * field added here later is a decision about what the public sees, and it should
 * break a check rather than ship silently.
 */
import Fastify from 'fastify';
import {
  healthRoutes,
  healthView,
  type HealthView,
} from '../routes/health.js';
import { servedNetwork } from '../config/networks.js';
import { network as servedChain } from '../services/chain.js';
import {
  chainIdForNetwork,
  NETWORK_LABEL,
  NETWORKS,
  networkForChainId,
  TEMPO_MAINNET_CHAIN_ID,
  TEMPO_TESTNET_CHAIN_ID,
} from '../lib/network.js';

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/** The comparison a reader of `docs/internal/ci.md` §2 makes, in one place. */
function agreesWithClientBuild(body: { chainId?: number }, clientChainId: number): boolean {
  return body.chainId === clientChainId;
}

async function main(): Promise<void> {
  const view = healthView();

  console.log(`served network: ${servedNetwork} (chain ${chainIdForNetwork(servedNetwork)})`);

  // 1. Derived from the served network, never a literal.
  check('the body names the served network', view.network === servedNetwork, `${view.network}`);
  check('the same network the chain service hands out', view.network === servedChain.network, `${servedChain.network}`);
  check('the chain id is the served network\'s', view.chainId === chainIdForNetwork(servedNetwork), `${view.chainId}`);
  check('and the same one every RPC call uses', view.chainId === servedChain.chainId, `${servedChain.chainId}`);

  // 2. The three fields agree, in both directions.
  check('the chain id maps back to that network', networkForChainId(view.chainId) === view.network);
  check(
    'the label is the product word for it',
    view.networkLabel === NETWORK_LABEL[view.network] && ['Live', 'Practice'].includes(view.networkLabel),
    view.networkLabel
  );
  check('the network is one the code knows', NETWORKS.includes(view.network));
  // Widened to `number` on purpose: the two ids are literal types, so a direct
  // comparison is a compile error ("no overlap") rather than a runtime check.
  const mainnetChainId: number = TEMPO_MAINNET_CHAIN_ID;
  const testnetChainId: number = TEMPO_TESTNET_CHAIN_ID;
  check(
    'the two Tempo chains do not collide',
    mainnetChainId !== testnetChainId &&
      chainIdForNetwork('mainnet') === mainnetChainId &&
      chainIdForNetwork('testnet') === testnetChainId
  );

  // 3. The comparison discriminates. A body naming the other chain must fail it,
  //    or the field proves nothing about the deployment actually serving.
  const otherChain = servedNetwork === 'mainnet' ? TEMPO_TESTNET_CHAIN_ID : TEMPO_MAINNET_CHAIN_ID;
  check('a client built for the served chain agrees with this body', agreesWithClientBuild(view, view.chainId));
  check(
    'a client built for the other chain does not',
    !agreesWithClientBuild(view, otherChain),
    `client ${otherChain} vs body ${view.chainId}`
  );

  // Liveness contract: still ok, still no database.
  check('the status is ok', view.status === 'ok');
  check('the service is named', view.service === 'seti-api');
  check('a version travels with it', typeof view.version === 'string' && view.version.length > 0, view.version);

  // The public shape is fixed: this route is unauthenticated.
  const EXPECTED_KEYS = ['chainId', 'network', 'networkLabel', 'service', 'status', 'version'];
  const keys = Object.keys(view).sort();
  check('the body carries exactly the six public fields', JSON.stringify(keys) === JSON.stringify(EXPECTED_KEYS), keys.join(','));
  check(
    'nothing secret rides along',
    !keys.some((key) => /url|key|secret|address|treasury|token|rpc/i.test(key)),
    keys.join(',')
  );

  // The route, not just the function: prove the server returns this body, with no
  // database in the process (the suite never connects).
  const app = Fastify();
  await app.register(healthRoutes, { prefix: '/health' });
  await app.ready();
  const response = await app.inject({ method: 'GET', url: '/health' });
  check('GET /health answers 200', response.statusCode === 200, String(response.statusCode));
  const body: HealthView = response.json();
  check('with the served chain in it', body.chainId === chainIdForNetwork(servedNetwork), `${body.chainId}`);
  check('and the same body the function builds', JSON.stringify(body) === JSON.stringify(view));
  check(
    'it answers without touching a database',
    response.statusCode === 200 && typeof body.network === 'string'
  );
  await app.close();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('health check crashed:', error);
  process.exit(1);
});
