import type { FastifyInstance } from 'fastify';
import { servedNetwork } from '../config/networks.js';
import { chainIdForNetwork, NETWORK_LABEL, type Network } from '../lib/network.js';
import { getSweepStatus } from '../services/stuck-transactions.js';

/**
 * The liveness body, as one exported value.
 *
 * It carries the network this process SERVES, because the deployment's worst
 * misconfiguration is otherwise invisible from outside: the client is built with
 * `NEXT_PUBLIC_TEMPO_CHAIN_ID` and the API reads `TEMPO_CHAIN_ID`, two different
 * places (`docs/internal/ci.md` §2), and nothing compares them. A Worker built for
 * `4217` in front of an API serving `42431` signs every payment on a chain the API
 * will not reconcile against, while both deploys report success and this probe
 * answers `ok`. Naming the chain here makes that a single unauthenticated curl.
 *
 * Three fields rather than one, deliberately: `chainId` is what a client compares
 * against its own build, `network` is what the code branches on, and `networkLabel`
 * is the word a person reads in the app. They are derived from `servedNetwork`
 * here, never from a literal, so they cannot disagree with the running process.
 *
 * What it does NOT say: which chain the deployed client was built for. The API
 * cannot know that, so this makes the API's half readable and leaves the
 * comparison to whoever reads both.
 */
export interface HealthView {
  status: 'ok';
  service: 'seti-api';
  version: string;
  /** The network this process serves — the same constant every route branches on. */
  network: Network;
  /** `4217` (Live) or `42431` (Practice). */
  chainId: number;
  /** The product's word for the network: `Live` or `Practice`. */
  networkLabel: string;
}

/**
 * Pure and synchronous on purpose: the route below must answer while the database
 * is down, so nothing here reads Postgres, the chain, or the environment at call
 * time. `servedNetwork` is decided once at boot and this only restates it.
 */
export function healthView(): HealthView {
  return {
    status: 'ok',
    service: 'seti-api',
    version: '0.1.0',
    network: servedNetwork,
    chainId: chainIdForNetwork(servedNetwork),
    networkLabel: NETWORK_LABEL[servedNetwork],
  };
}

export async function healthRoutes(app: FastifyInstance) {
  /**
   * Liveness. Deliberately touches nothing: this has to answer even when the
   * database is down, or an orchestrator restarts a process that is fine.
   *
   * It also names the served Tempo network, so a client built for one chain and an
   * API serving the other is visible in one request instead of failing as an
   * unexplained verification error on every payment. Nothing secret is in the
   * body: a chain id and a label are public, and this route is unauthenticated.
   */
  app.get('/', async () => {
    return healthView();
  });

  /**
   * Readiness for the payment lifecycle: is any payment stuck, and is the sweep
   * that resolves them actually running?
   *
   * This is the alerting surface. A row left in `processing` is invisible in the
   * app and was, until now, only visible in a worker log line — so a probe that
   * returns **503** when there is a stuck or unresolved row is what turns
   * "nothing alerts on a stuck payment" into a signal any uptime monitor,
   * load balancer or orchestrator can already act on. Two distinct failures are
   * covered: rows the chain cannot explain (needs a human), and a sweep that has
   * stopped running (the silent failure — a dead sweep looks like a quiet one).
   *
   * Counts only, no transaction hashes: the hashes are public on-chain data, but
   * this endpoint is unauthenticated, and binding Seti's ledger to them is not
   * needed for the probe to work. Use `npm run support:payment -- --stuck` when
   * you need the hashes.
   */
  app.get('/sweep', async (request, reply) => {
    try {
      const status = await getSweepStatus();
      return reply.status(status.degraded ? 503 : 200).send(status);
    } catch (error) {
      // A probe that cannot read the database is not healthy either. The error
      // itself is logged, never echoed: provider and connection errors embed
      // hostnames, ports and sometimes a credentialed URL.
      request.log.error({ error }, 'sweep health probe could not read its status');
      return reply.status(503).send({
        degraded: true,
        reasons: ['sweep status could not be read'],
      });
    }
  });
}
