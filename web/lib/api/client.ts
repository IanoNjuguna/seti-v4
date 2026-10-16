import { API_BASE_URL } from './api.constants';
import {
  REFUSAL_NETWORK,
  REFUSAL_NETWORK_STATUS,
  refusalMessageFor,
} from './refusal.constants';

/**
 * Typed error for anything the API refuses.
 *
 * `status` and `body` are kept because the backend answers a refused payment with
 * `422 { error, code, requestId }` — the `code` is machine-readable and the UI
 * branches on it rather than on the message text.
 *
 * **`message` is OUR copy, never the server's.** The server's sentence is written
 * for a log: it is whatever failed, verbatim, which is how a Prisma error naming a
 * column reached the sign-in screen. Every renderer in this app shows
 * `error.message`, so the invariant is enforced here, at the one place an
 * `ApiError` is constructed, rather than trusted to each of a dozen call sites.
 * The server's own words survive on `serverMessage` for logs, and the correlation
 * id on `requestId` for support; neither is rendered.
 */
export class ApiError extends Error {
  constructor(
    /** Safe to show: mapped from the code. See `refusal.constants.ts`. */
    message: string,
    public status: number,
    public body?: unknown,
    /** The server's own sentence. For logs and debugging — NEVER rendered. */
    public serverMessage?: string,
    /** The server's correlation id, carried for support — never rendered. */
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The backend's machine-readable refusal code, when it sent one. */
  get code(): string | undefined {
    const body = this.body as { code?: unknown } | null | undefined;
    return typeof body?.code === 'string' ? body.code : undefined;
  }
}

/** A source of tokens, asked at call time rather than once at sign-in. */
export type TokenProvider = () => Promise<string | null>;

let authToken: string | null = null;
let tokenProvider: TokenProvider | null = null;

/** The token as of the last sign-in. Used by the dev shortcut, and as a fallback. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Register the source of FRESH tokens — the Privy session.
 *
 * The static token above is set once and never changes, which is fine for the dev
 * shortcut but makes a Privy session die when its access token does, an hour in.
 * Privy refuses to refresh tokens server-side by design, so the browser is the only
 * party that can mint a new one, and only if it is asked on each request.
 */
export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

async function resolveToken(): Promise<string | null> {
  if (tokenProvider) {
    try {
      const fresh = await tokenProvider();
      if (fresh) return fresh;
    } catch {
      // Fall through to the last known token: whether this is fatal is decided by
      // the response, not here.
    }
  }

  return authToken;
}

async function send(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  token: string | null
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // No response at all: offline, DNS, a blocked origin, or the API is down.
    // From the customer's side this is the same event as a refusal, so it reads
    // like one — and it never surfaces the browser's own "Failed to fetch".
    throw new ApiError(REFUSAL_NETWORK, REFUSAL_NETWORK_STATUS);
  }
}

/** The request id the server put on the response, or in the body as a fallback. */
function requestIdOf(response: Response, data: unknown): string | undefined {
  const header = response.headers.get('x-request-id');
  if (header) return header;
  const body = data as { requestId?: unknown } | null | undefined;
  return typeof body?.requestId === 'string' ? body.requestId : undefined;
}

/**
 * The body, or `null` when it is not JSON.
 *
 * A refusal does not promise a JSON body: a proxy's 502 is usually HTML, and
 * `JSON.parse` on it throws a `SyntaxError` from inside the error path — which
 * then surfaced as "Unexpected token < in JSON at position 0" to the customer,
 * through the same `error.message` every renderer shows. A body that cannot be
 * read is simply no body.
 */
function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Read a refused response and throw the mapped `ApiError`.
 *
 * Split out of `handleResponse` so a request whose body is a FILE maps a refusal
 * through the same code -> sentence table a JSON read does. A statement that
 * fails must not leak the server's own words any more than a page of activity
 * can, so both paths throw from this one place.
 */
async function throwRefusal(response: Response): Promise<never> {
  const body = parseBody(await response.text());
  const serverMessage = (body as { error?: unknown } | null)?.error;
  const code = (body as { code?: unknown } | null)?.code;

  throw new ApiError(
    refusalMessageFor(typeof code === 'string' ? code : undefined),
    response.status,
    body,
    typeof serverMessage === 'string' ? serverMessage : undefined,
    requestIdOf(response, body)
  );
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) await throwRefusal(response);

  return parseBody(await response.text()) as T;
}

/**
 * Send a request, refreshing the access token once if the backend rejects it.
 *
 * Exactly one retry: an access token can expire mid-session, and a single refresh
 * recovers that. Retrying repeatedly would turn a genuine authorization failure
 * (a deleted user, a revoked token) into a loop. If the refresh cannot produce a
 * usable token the SDK logs the user out, and the second response is surfaced.
 */
async function authenticated(
  method: 'GET' | 'POST',
  path: string,
  body: unknown
): Promise<Response> {
  const first = await send(method, path, body, await resolveToken());
  if (first.status !== 401) return first;

  return send(method, path, body, await resolveToken());
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown
): Promise<T> {
  return handleResponse<T>(await authenticated(method, path, body));
}

/** A response whose body is a file, handed to the browser rather than parsed. */
export interface ApiFile {
  blob: Blob;
  /** The name the server attached (`Content-Disposition`), or null when it named none. */
  fileName: string | null;
}

/** The filename a `Content-Disposition` header carries, if it carries one. */
function fileNameFrom(disposition: string | null): string | null {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

/**
 * GET a URL whose body is a file, authenticated exactly as a JSON read is.
 *
 * A statement cannot be fetched with a plain link or `window.open`: neither
 * carries the session's `Authorization` header, so the server would refuse both.
 * Everything else is the shared path — the same `authenticated` send (and its one
 * 401 refresh), and the same code -> sentence mapping on a refusal. Only the
 * successful body differs: it is returned as a Blob for the caller to save.
 */
export async function getFile(path: string): Promise<ApiFile> {
  const response = await authenticated('GET', path, undefined);
  if (!response.ok) await throwRefusal(response);

  return {
    blob: await response.blob(),
    fileName: fileNameFrom(response.headers.get('content-disposition')),
  };
}

export function get<T>(path: string): Promise<T> {
  return request<T>('GET', path, undefined);
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}
