import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * The session's network is decided by the SERVER. Pin that a client cannot send one.
 *
 * The rule is the same shape as the one that stops a client supplying a payment
 * amount (AGENTS.md): a value that decides where money moves or which chain an
 * action lands on is the server's, never the caller's. `authMiddleware` resolves
 * the session's network from the account's stored preference; this hook closes
 * the OTHER half — a request that tries to ASSERT a chain id is refused outright,
 * rather than having its assertion silently ignored.
 *
 * Ignoring would be the quieter failure: a modified client that sends
 * `chainId: 4217` against a testnet session would be told nothing, and a later
 * change to the resolution rule could start honouring it. A refusal is a state
 * the client can see and fix.
 *
 * Two things are refused, and they are different kinds of claim:
 *
 *  1. A **chain id** — always, on every route. It is a transport-level assertion
 *     about which chain a request runs on, and it is never the client's to make.
 *  2. A **`network` field** — everywhere EXCEPT the one route that is a request to
 *     SWITCH the account (`POST /account/network`). There, `network` is the
 *     TARGET of the switch, which the server may still refuse; everywhere else it
 *     is an attempt to override the session and is refused.
 *
 * It runs for EVERY route (registered globally in `server.ts`), including the
 * unauthenticated ones: a chain id in a public request is just as wrong as one in
 * a signed request, and a hook that only ran on some routes is a hook that leaks.
 */

export const CLIENT_NETWORK_REFUSED = 'client-network-refused';

/** Header names that could carry a client-asserted chain id. */
const CHAIN_ID_HEADERS = ['x-tempo-chain-id', 'x-chain-id'];
/** Header names that could carry a client-asserted network. */
const NETWORK_HEADERS = ['x-network'];

/** Body/query keys that could carry a client-asserted chain id. */
const CHAIN_ID_KEYS = ['chainid', 'chain_id', 'tempochainid'];
/** Body/query keys that could carry a client-asserted network. */
const NETWORK_KEYS = ['network'];

/** The one route where a `network` field is a switch TARGET, not an assertion. */
const NETWORK_SWITCH_PATH = '/account/network';

function matchesPath(request: FastifyRequest, suffix: string): boolean {
  const path = request.routeOptions?.url ?? request.url.split('?')[0] ?? '';
  return path === suffix;
}

function keyIn(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const key of Object.keys(value)) {
    if (keys.includes(key.toLowerCase())) return key;
  }
  return null;
}

function headerIn(request: FastifyRequest, names: string[]): string | null {
  for (const name of names) {
    if (request.headers[name] !== undefined) return name;
  }
  return null;
}

function refuse(reply: FastifyReply, field: string) {
  return reply.status(400).send({
    error:
      `This request tried to declare "${field}", but the network a request is served on is ` +
      'decided by the server and cannot be supplied by a client. Remove it and try again.',
    code: CLIENT_NETWORK_REFUSED,
    field,
  });
}

export async function networkScopeHook(request: FastifyRequest, reply: FastifyReply) {
  // 1. A chain id is never accepted, on any route, in any position.
  const chainIdField =
    headerIn(request, CHAIN_ID_HEADERS) ??
    keyIn(request.query, CHAIN_ID_KEYS) ??
    keyIn(request.body, CHAIN_ID_KEYS);

  if (chainIdField) return refuse(reply, chainIdField);

  // 2. A `network` field is an override everywhere except the switch route.
  if (!matchesPath(request, NETWORK_SWITCH_PATH)) {
    const networkField =
      headerIn(request, NETWORK_HEADERS) ??
      keyIn(request.query, NETWORK_KEYS) ??
      keyIn(request.body, NETWORK_KEYS);

    if (networkField) return refuse(reply, networkField);
  }
}
