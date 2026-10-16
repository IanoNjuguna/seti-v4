import { startIndexer } from './services/indexer.js';

/**
 * The standalone indexer worker.
 *
 * `src/index.ts` is the API: it serves HTTP and, in development, also runs the
 * indexer loop. This entry is the other half, split out so a deployment can run
 * the indexer as its own service — the `indexer` service in `docker-compose.yml`
 * and `seti-indexer.service` on the systemd path both exec `dist/worker.js`.
 *
 * Why a separate process matters here:
 *
 *   - The indexer is a long-running loop, not a request handler. Running it
 *     inside the API ties the scan cadence to however many API replicas exist
 *     and makes a crash of either take down both.
 *   - The API can therefore be restarted, redeployed or scaled on its own
 *     without interrupting a scan, and vice versa.
 *   - `INDEXER_ENABLED=false` on the API keeps the single-writer cursor loop in
 *     exactly one place.
 *
 * It touches nothing but the loop: the loop itself owns the shared cursor lock
 * (`indexer_cursors.lockedBy`, 60s TTL), so even if this worker and an API that
 * forgot to disable its indexer run at once, only one scans and the other skips
 * the tick. No HTTP server is started, and no port is bound.
 *
 * The process stays alive because `startIndexer` installs a `setInterval`; a
 * SIGTERM/SIGINT clears it so a systemd stop or a container stop is clean.
 */

const stopIndexer = startIndexer();

console.log(`[indexer] worker started (pid ${process.pid})`);

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[indexer] received ${signal}, stopping`);
  stopIndexer();
  // Nothing else holds the event loop once the interval is cleared, but exiting
  // explicitly makes a systemd `Restart=always` behave predictably.
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
