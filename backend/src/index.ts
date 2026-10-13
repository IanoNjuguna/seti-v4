import { buildServer } from './server.js';
import { env } from './config/env.js';
import { startIndexer } from './services/indexer.js';

async function start() {
  const app = await buildServer();

  // Start the on-chain transaction indexer. The network config provides a
  // default RPC for testnet, so it runs unless explicitly disabled.
  startIndexer();
  app.log.info('On-chain transaction indexer started');

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
