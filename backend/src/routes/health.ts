import type { FastifyInstance } from 'fastify';
import { getSweepStatus } from '../services/stuck-transactions.js';

export async function healthRoutes(app: FastifyInstance) {
  /**
   * Liveness. Deliberately touches nothing: this has to answer even when the
   * database is down, or an orchestrator restarts a process that is fine.
   */
  app.get('/', async () => {
    return { status: 'ok', service: 'seti-api', version: '0.1.0' };
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
