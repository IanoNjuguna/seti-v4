/**
 * Where the report-only Content Security Policy sends its violations.
 *
 * Without an endpoint the policy can only be read in whichever browser happened to
 * hit a violation, which means nobody reads it and the allowlist never gets narrowed.
 * This handler turns each violation into one line in the Worker's log
 * (`wrangler tail`, and the Cloudflare dashboard's log stream), which is the feed the
 * switch to an enforcing policy is decided on.
 *
 * It accepts, logs, and answers 204 — the status the reporting spec expects. It never
 * parses or validates: a report from a browser is untrusted input, and the only thing
 * worth doing with it is reading it later. The body is capped so a hostile page cannot
 * fill the log with one request.
 *
 * A same-origin POST here is allowed by the policy's own `connect-src 'self'`
 * (`report-uri` is not subject to `connect-src` in any case, but the note saves the
 * next reader the worry).
 */

/** Enough of a report to identify the violation, not enough to be a payload sink. */
const MAX_LOGGED_CHARS = 2000;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.text();
    console.warn('[csp]', body.slice(0, MAX_LOGGED_CHARS));
  } catch {
    // A malformed body is still a report we cannot use; answering 204 keeps the
    // browser from retrying.
  }

  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' },
  });
}
