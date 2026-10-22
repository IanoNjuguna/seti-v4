/**
 * The invite cookie: one signed string, on the web app's own host, for thirty days.
 *
 * WHY A COOKIE AND NOT A QUERY PARAMETER. The link is `seti.live/i/<handle>`, and
 * the person following it is usually not signed up yet: they read the link in a
 * chat, tap it, and land in the app where signing up happens minutes later, on
 * another page, possibly after they close the tab and come back. A parameter on
 * `/app` survives nothing; a cookie survives all of that.
 *
 * WHY IT IS SIGNED, AND WHY IT NAMES AN ID. The value is minted by the API
 * (`services/referral.ts`) as `base64url(payload).base64url(HMAC)`, and the payload
 * carries the REFERRER'S USER ID, never only the handle. A handle is a namespace
 * entry that can be parked for review and later released to a brand, so a cookie
 * that re-resolved the name would credit whoever holds it then. Signed, because a
 * cookie is client-side state: unsigned, anyone could write a value naming any
 * account, and every attribution is a claim about a real person. This app cannot
 * forge one either: it has no signing key and never parses the payload.
 *
 * WHY httpOnly. Nothing in the browser needs to read it: the only consumer is the
 * account-establishing call, and the page that must carry it (`/signin`) is server
 * rendered, so the SERVER reads it and hands it to the one request that needs it.
 * No script can copy it, which is the point of holding a capability in a cookie
 * rather than in `localStorage` beside the session token.
 */
export const INVITE_COOKIE = 'seti-invite';

/**
 * Thirty days, in seconds.
 *
 * Deliberately the same number the API puts INSIDE the signed payload, which is
 * the authority: the cookie dying early is harmless (the invite is simply not
 * carried), and a cookie outliving its payload is refused by the signature check.
 * So this is the maximum age the browser keeps it, not the invite's expiry.
 */
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
