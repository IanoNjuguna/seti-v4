/**
 * The response headers every page of the web app carries, and the one sentence that
 * explains why each is here.
 *
 * ## The enforcing set, which carries almost no policy
 *
 * These are the headers that do not depend on knowing the app's script or connection
 * graph: nobody may frame us, nothing may be sniffed into a different type, no
 * referrer leaks past the origin, and the transport is pinned for two years. The
 * ENFORCING `Content-Security-Policy` therefore carries `frame-ancestors` and nothing
 * else.
 *
 * A `script-src` on the enforcing header would be the dangerous edit, not the safe
 * one. Our bundles carry wasm (secp256k1, sha3, p256), the Privy SDK opens
 * `auth.privy.io`, the connectors reach WalletConnect, and balances and receipts are
 * read from Tempo's RPC directly. A policy written without any one of them does not
 * weaken the app, it breaks signing or shows every balance as zero.
 *
 * ## So the allowlist ships REPORT-ONLY first
 *
 * `Content-Security-Policy-Report-Only` is sent alongside it. The browser evaluates
 * the same policy and reports violations without blocking anything, which is the only
 * honest way to write a policy against a wallet: the reports are the test, and the
 * switch to enforcing is a separate, single-line change once they are quiet.
 *
 * `api.seti.live` is not hardcoded: the API origin comes from
 * `NEXT_PUBLIC_API_URL`, because a build may point anywhere and a CSP naming the
 * wrong origin is a CSP that breaks the app on that build only.
 */

/**
 * The API origin, as a CSP source.
 *
 * Returns null when the build has no API url, so the caller can leave it out rather
 * than emit an invalid source.
 */
function apiOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;

  try {
    const { origin } = new URL(raw);
    return origin;
  } catch {
    return null;
  }
}

/**
 * The report-only allowlist, built from hosts the app is observed to use.
 *
 * Deliberately narrow: every entry below either appears in a production HAR or is
 * required by a library that does the signing. Anything speculative is left out so
 * the reports show it, which is what report-only is for.
 *
 * `'unsafe-eval'` is added in development only: the dev server needs it for HMR, and
 * a report-only header that cries about the dev server every save teaches everyone to
 * ignore the reports.
 */
export function cspReportOnly(): string {
  const api = apiOrigin();
  const dev = process.env.NODE_ENV !== 'production';

  const connect = [
    "'self'",
    ...(api ? [api] : []),
    'https://auth.privy.io',
    // Privy's own RPC proxy: the embedded wallet's reads go through it.
    'https://*.rpc.privy.systems',
    // Chain reads. Balances and receipts are read from Tempo directly, so a policy
    // without these shows a wallet that appears empty.
    'https://rpc.tempo.xyz',
    'https://rpc.moderato.tempo.xyz',
    'wss://relay.walletconnect.com',
    'wss://relay.walletconnect.org',
    'https://explorer-api.walletconnect.com',
  ];

  return [
    "default-src 'self'",
    [
      "script-src 'self' 'wasm-unsafe-eval' https://auth.privy.io",
      dev ? "'unsafe-eval'" : '',
    ]
      .filter(Boolean)
      .join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
    "child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Reported to our own handler so violations are visible in the Worker's log
    // rather than only in whichever browser happened to hit them.
    'report-uri /api/csp-report',
  ].join('; ');
}

/**
 * Set on the document, not on assets.
 *
 * `X-Frame-Options` is the legacy pair of `frame-ancestors`; both are sent because the
 * browsers that still read the old one are exactly the ones that ignore the new one.
 * `DENY` is right here: nothing embeds seti.live. Us embedding `auth.privy.io` is the
 * opposite direction and is unaffected.
 *
 * `Strict-Transport-Security` commits every subdomain to https for two years and
 * cannot be taken back from a browser that has already seen it: removing it later
 * means waiting the max-age out. Every subdomain this deployment has is https today
 * (`www`, `api`, and whatever `app` becomes), so `includeSubDomains` is correct now.
 * If a plain-http subdomain is ever part of the plan, that is the line to revisit, and
 * revisiting it is not a revert.
 */
export function securityHeaders(): Record<string, string> {
  return {
    'X-Frame-Options': 'DENY',
    // Enforcing, and carrying only the directive that cannot break the app.
    'Content-Security-Policy': "frame-ancestors 'none'",
    // The allowlist, measured before it is enforced. See `cspReportOnly`.
    'Content-Security-Policy-Report-Only': cspReportOnly(),
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}
