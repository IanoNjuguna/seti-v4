import { buildServer } from './server.js';
import { env } from './config/env.js';
import { startIndexer } from './services/indexer.js';

async function start() {
  const app = await buildServer();

  // Start the on-chain transaction indexer unless this process is meant to be
  // API-only. The network config provides a default RPC for testnet, so it runs
  // unless explicitly disabled. A deployed box runs the loop in the dedicated
  // `indexer` service (`dist/worker.js`) and starts the API with
  // INDEXER_ENABLED=false — see docs/deploy-oracle.md.
  if (env.INDEXER_ENABLED === 'true') {
    startIndexer();
    app.log.info('On-chain transaction indexer started');
  } else {
    app.log.info('Indexer disabled in this process (INDEXER_ENABLED=false)');
  }

  try {
    await app.listen({ port: Number(env.PORT), host: env.HOST });
    app.log.info(`Seti API running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// `void` is explicit about intent here: this is a fire-and-forget bootstrap.
// A bare `start()` would surface a buildServer() rejection (bad config, missing
// env var) as an unhandled rejection rather than a readable failure.
void start().catch((error) => {
  // Nothing is wired up yet, so the logger does not exist either.
  console.error('[startup] failed to boot', error);
  process.exit(1);
});
