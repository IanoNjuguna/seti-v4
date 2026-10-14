/**
 * CORS probe for `server.cors.check.ts`.
 *
 * Boots the REAL server — the same `buildServer()` the app runs, with its own
 * `@fastify/cors` registration — under a chosen `NODE_ENV` and
 * `CORS_ALLOWED_ORIGINS`, listens on an ephemeral loopback port, and makes
 * ordinary HTTP requests with different `Origin` headers, exactly as a browser
 * does. It prints one JSON object per origin and exits.
 *
 * It runs as its own process on purpose: `config/env` parses the environment at
 * module load, so the only honest way to ask "does this allow-list change the
 * verdict?" is a fresh process with that environment. The parent check spawns it
 * several times with different values and asserts on the JSON.
 */
import { buildServer } from './server.js';

/** The origins the parent asks about. One is expected to be allowed and the
 * other refused in any non-development run; `evil` is the control. */
const ORIGINS = [
  'https://app.seti.example',
  'https://admin.seti.example',
  'https://evil.example',
];

async function main() {
  const app = await buildServer();
  await app.listen({ host: '127.0.0.1', port: 0 });

  const address = app.server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('server did not bind a TCP address');
  }
  const base = `http://127.0.0.1:${address.port}`;

  const results = [];
  for (const origin of ORIGINS) {
    // An actual cross-origin GET, browser style: the server decides whether to
    // hand back an Access-Control-Allow-Origin for this origin.
    const response = await fetch(`${base}/health/`, { headers: { Origin: origin } });
    results.push({
      origin,
      status: response.status,
      allowOrigin: response.headers.get('access-control-allow-origin'),
      allowCredentials: response.headers.get('access-control-allow-credentials'),
    });
  }

  // A preflight, which is the request a browser sends before a JSON POST.
  const preflight = await fetch(`${base}/health/`, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGINS[0],
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  const preflightResult = {
    origin: ORIGINS[0],
    status: preflight.status,
    allowOrigin: preflight.headers.get('access-control-allow-origin'),
    allowMethods: preflight.headers.get('access-control-allow-methods'),
  };

  // A request with no Origin at all (a same-origin fetch, curl, a health check):
  // must keep working and must not gain a CORS header.
  const noOrigin = await fetch(`${base}/health/`);
  const noOriginResult = {
    origin: null,
    status: noOrigin.status,
    allowOrigin: noOrigin.headers.get('access-control-allow-origin'),
  };

  await app.close();

  process.stdout.write(
    `${JSON.stringify({ nodeEnv: process.env.NODE_ENV, results, preflight: preflightResult, noOrigin: noOriginResult })}\n`
  );
}

main().catch((error) => {
  console.error('cors probe failed:', error);
  process.exit(1);
});
