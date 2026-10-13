import { API_BASE_URL } from './api.constants';

/**
 * Typed error for anything the API refuses.
 *
 * `status` and `body` are kept because the backend now answers a refused
 * payment with `422 { error, code, txHash }` — the `code` is machine-readable
 * and the UI branches on it rather than on the message text.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
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

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      (data as { error?: string } | null)?.error ??
        `Request failed with status ${response.status}`,
      response.status,
      data
    );
  }

  return data as T;
}

/**
 * Send a request, refreshing the access token once if the backend rejects it.
 *
 * Exactly one retry: an access token can expire mid-session, and a single refresh
 * recovers that. Retrying repeatedly would turn a genuine authorization failure
 * (a deleted user, a revoked token) into a loop. If the refresh cannot produce a
 * usable token the SDK logs the user out, and the second response is surfaced.
 */
async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown
): Promise<T> {
  const first = await send(method, path, body, await resolveToken());
  if (first.status !== 401) return handleResponse<T>(first);

  const retried = await send(method, path, body, await resolveToken());
  return handleResponse<T>(retried);
}

export function get<T>(path: string): Promise<T> {
  return request<T>('GET', path, undefined);
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}
