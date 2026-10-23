/**
 * Minimal HTTP client for the Seti backend.
 *
 * Kept deliberately thin: the point of these tools is to expose the API as it
 * exists, not to invent a nicer one on top. Where the API has no endpoint (an
 * FX quote on its own, for example) there is no tool — rather than one that
 * guesses by calling something else.
 *
 * TWO KINDS OF REQUEST, and the difference is the credential. Almost every route
 * needs a Privy-issued bearer token (`setiRequest`). The public reads that exist to
 * be opened signed out — a payee looked up by address, for one — must NOT send a
 * token: a tool that demanded one would claim a requirement the route does not have
 * (`setiPublicGet`).
 */
import { setiApiConfig, type SetiApiConfig } from './config.js';
import { ToolError, scrub } from './errors.js';

const REQUEST_TIMEOUT_MS = 20_000;

export function requireApiConfig(toolName: string): SetiApiConfig {
  const config = setiApiConfig();
  if (!config) {
    throw new ToolError(
      `${toolName} needs a Seti API connection. Set SETI_API_BASE_URL and SETI_API_TOKEN in the ` +
        'server environment. Note that the Seti API currently authenticates with a Privy-issued ' +
        'bearer token, so this requires a Seti account — there are no public API keys yet.'
    );
  }
  return config;
}

/**
 * The base URL for a route that needs no token, or an error naming what is missing.
 *
 * Deliberately does not read SETI_API_TOKEN: a credential requirement invented here
 * would be one the route does not have, and a host that configured only the base URL
 * could not use a read that exists for people with no account at all.
 */
function requirePublicBaseUrl(toolName: string): string {
  const baseUrl = process.env.SETI_API_BASE_URL;
  if (!baseUrl) {
    throw new ToolError(
      `${toolName} needs the Seti API base URL. Set SETI_API_BASE_URL in the server ` +
        'environment. It does NOT need SETI_API_TOKEN: this route is one of the public reads ' +
        'that exist to be opened without an account.'
    );
  }
  return baseUrl.replace(/\/+$/, '');
}

interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

/**
 * One request, and the one place its failures are shaped.
 *
 * The headers are the CALLER'S, because authentication is the caller's question: the
 * status handling is identical whether or not a token rode along.
 */
async function perform<T>(
  baseUrl: string,
  options: RequestOptions,
  headers: Record<string, string>
): Promise<T> {
  const url = new URL(`${baseUrl}${options.path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers: {
        ...headers,
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // A network failure must not echo the URL: the base URL may carry a key.
    const reason = error instanceof Error ? error.name : 'unknown error';
    throw new ToolError(`Could not reach the Seti API at ${baseUrl} (${reason}).`);
  }

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : scrub(text).slice(0, 300);
    // The refusal CODE is the part a caller switches on, so it rides in the message:
    // a wrong-wallet signature must read as `charge-signature-invalid`, not as a bare
    // HTTP status the agent has to guess at.
    const code =
      payload && typeof payload === 'object' && 'code' in payload
        ? String((payload as { code: unknown }).code)
        : null;
    throw new ToolError(
      `Seti API returned HTTP ${response.status} for ${options.method} ${options.path}` +
        `${code ? ` [${code}]` : ''}: ${detail}`
    );
  }

  return payload as T;
}

/**
 * Performs one request against the Seti API as an authenticated caller.
 *
 * The Authorization header is set in this one place and never logged; `scrub()` covers
 * text that comes back from the server.
 */
export async function setiRequest<T>(options: RequestOptions): Promise<T> {
  const { baseUrl, token } = requireApiConfig('This tool');

  return perform<T>(baseUrl, options, { Authorization: `Bearer ${token}` });
}

/**
 * Performs one request against a route that exists to be opened signed out.
 *
 * No Authorization header at all — not an empty one, and not one that is only set when a
 * token happens to exist: `docs/mcp.md` reports each tool's token requirement, so a tool
 * that quietly authenticated would teach an integrator that this read needs an account.
 */
export async function setiPublicGet<T>(
  toolName: string,
  options: Omit<RequestOptions, 'method' | 'body'>
): Promise<T> {
  return setiPublicRequest<T>(toolName, { ...options, method: 'GET' });
}

/**
 * A token-free request that may also write, and may carry the caller's own signature
 * headers.
 *
 * The receive tools need both: creating a charge is a POST whose authorisation is the
 * payee's EIP-712 signature in the body, and listing the payee's charges is a GET whose
 * authorisation is the same kind of signature in three `x-seti-*` headers. Neither has
 * anything to do with a Seti account, so no Authorization header is ever set here.
 */
export async function setiPublicRequest<T>(
  toolName: string,
  options: RequestOptions & { headers?: Record<string, string> }
): Promise<T> {
  const baseUrl = requirePublicBaseUrl(toolName);
  const { headers = {}, ...rest } = options;

  return perform<T>(baseUrl, rest, { accept: 'application/json', ...headers });
}
