/**
 * The response headers every page of the web app carries, and the one sentence that
 * explains why each is here.
 *
 * ## What this is, and what it deliberately is not
 *
 * These are the headers that do not depend on knowing the app's script or connection
 * graph: nobody may frame us, nothing may be sniffed into a different type, no
 * referrer leaks past the origin, and the transport is pinned for two years. The
 * `Content-Security-Policy` below therefore carries `frame-ancestors` and nothing
 * else.
 *
 * A `script-src` here would be the dangerous edit, not the safe one. Our bundles
 * carry wasm (secp256k1, sha3, p256), the Privy SDK opens `auth.privy.io`, and the
 * WalletConnect connectors reach two more hosts; a policy written without them does
 * not weaken the app, it breaks signing. That allowlist is its own change, shipped
 * Report-Only first, and this file is where it will land when it has been measured.
 *
 * ## The one header with teeth
 *
 * `Strict-Transport-Security` commits every subdomain to https for two years and
 * cannot be taken back from a browser that has already seen it: removing it later
 * means waiting the max-age out. Every subdomain this deployment has is https today
 * (`www`, `api`, and whatever `app` becomes), so `includeSubDomains` is correct now.
 * If a plain-http subdomain is ever part of the plan, that is the line to revisit,
 * and revisiting it is not a revert.
 */

/**
 * Set on the document, not on assets.
 *
 * `X-Frame-Options` is the legacy pair of `frame-ancestors`; both are sent because the
 * browsers that still read the old one are exactly the ones that ignore the new one.
 * `DENY` is right here: nothing embeds seti.live. Us embedding `auth.privy.io` is the
 * opposite direction and is unaffected.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
