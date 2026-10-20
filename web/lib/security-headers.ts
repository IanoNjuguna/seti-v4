/**
 * The response headers every page of the web app carries, and the one sentence that
 * explains why each is here.
 *
 * ## How the CSP got here
 *
 * It started as `frame-ancestors 'none'` and nothing else, because everything else
 * depends on knowing the app's script and connection graph. Our bundles carry wasm
 * (secp256k1, sha3, p256), the Privy SDK opens `auth.privy.io`, the connectors reach
 * WalletConnect, and balances and receipts are read from Tempo's RPC directly: a policy
 * written without any one of them does not weaken the app, it breaks signing or shows
 * every balance as zero.
 *
 * So the allowlist was written, sent as `Content-Security-Policy-Report-Only` for one
 * deploy, and corrected by what real browsers reported: the framework's inline
 * bootstrap scripts and Cloudflare's injected analytics beacon. With both listed the
 * policy is quiet, and it is now the ENFORCING one. `report-uri` travels with it, so
 * the telemetry that would justify the next tightening does not vanish the moment this
 * one starts blocking.
 *
 * What that costs is written where it belongs, in `cspPolicy`: inline script execution
 * is still allowed, because this runtime has no nonce path. The value is that no script
 * loads from an unlisted host.
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
 * Deliberately narrow: every entry below either appears in a production HAR, or is
 * required by a library that does the signing, or appeared in a real violation report
 * from `/api/csp-report`. Anything speculative is left out so the reports show it,
 * which is what report-only is for.
 *
 * ## `'unsafe-inline'` is in `script-src`, and that is a finding not a preference
 *
 * Nine of the first twelve production reports were `script-src-elem` against
 * `blocked-uri: inline` on ordinary pages: the framework's own bootstrap scripts, which
 * are inline by construction. A policy without `'unsafe-inline'` therefore does not
 * tighten this app, it blanks it. The clean fix is a nonce plus `'strict-dynamic'`, and
 * it is not available here: the runtime this ships on (vinext) has no nonce plumbing,
 * and neither the proxy convention's docs nor its build offer one.
 *
 * So the honest value of this policy is host allowlisting: no script loads from a host
 * that is not listed, which is the vector an injected `<script src>` uses. Inline
 * execution remains possible until a nonce path exists, and that is written down here
 * rather than hidden behind a directive that reads stricter than it is.
 *
 * `'unsafe-eval'` is added in development only: the dev server needs it for HMR, and
 * a report-only header that cries about the dev server every save teaches everyone to
 * ignore the reports.
 */
export function cspPolicy(): string {
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
    // The beacon Cloudflare injects at the edge posts its measurements here.
    'https://cloudflareinsights.com',
  ];

  return [
    "default-src 'self'",
    [
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://auth.privy.io",
      // Injected by Cloudflare itself; three reports named it before it was listed.
      'https://static.cloudflareinsights.com',
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
    /**
     * Enforcing, carrying the measured allowlist.
     *
     * It was Report-Only for one deploy, which is what found the two things the
     * policy would have broken: the framework's inline bootstrap scripts and
     * Cloudflare's injected beacon. With both listed, the policy is quiet on the
     * public surfaces, so it stops being a suggestion.
     *
     * `report-uri` stays inside the enforcing policy: violations of an enforcing
     * policy are reported too, so the telemetry that decides the next tightening does
     * not disappear the moment this one starts blocking.
     */
    'Content-Security-Policy': cspPolicy(),
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}
