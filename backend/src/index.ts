import { buildServer } from './server.js';
import { env } from './config/env.js';

async function start() {
  const app = await buildServer();

  try {
    await app.listen({ port: Number(env.PORT), host: env.HOST });
    app.log.info(`Seti API running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
