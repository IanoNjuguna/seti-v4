/**
 * Minimal HTTP client for the Seti backend.
 *
 * Kept deliberately thin: the point of these tools is to expose the API as it
 * exists, not to invent a nicer one on top. Where the API has no endpoint (an
 * FX quote on its own, for example) there is no tool — rather than one that
 * guesses by calling something else.
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

interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

/**
 * Performs one request against the Seti API.
 *
 * The Authorization header is set here and never logged; `scrub()` covers text
 * that comes back from the server.
 */
export async function setiRequest<T>(options: RequestOptions): Promise<T> {
  const { baseUrl, token } = requireApiConfig('This tool');

  const url = new URL(`${baseUrl}${options.path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${token}`,
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
    throw new ToolError(`Seti API returned HTTP ${response.status} for ${options.method} ${options.path}: ${detail}`);
  }

  return payload as T;
}
