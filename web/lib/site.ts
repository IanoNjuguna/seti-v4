/**
 * The app's canonical origin — the ONE place the deployed host is named.
 *
 * A merchant link, a receipt link, a sticker's QR and the hero's payment QR all
 * have to point at the SAME host, and the host is not knowable from the request.
 * The marketing page is prerendered at build time, where there is no `window`; a
 * relative path is not enough either, because a QR has to carry an absolute URL;
 * and `window.location` would bake whatever host happened to serve the build —
 * `localhost:3100`, a preview URL — into a code that ends up printed on a
 * sticker, where it cannot be corrected.
 *
 * So it is configuration, with a production default that matches the host this
 * repo already names in its own docs (`seti.live/m/<handle>` —
 * `app/m/[handle]/page.tsx`, `docs/api-reference.md`, `prisma/seed.ts`). Set
 * `NEXT_PUBLIC_SITE_ORIGIN` to the origin a deployment is actually served from.
 * A trailing slash is stripped so joining a path can never double it.
 *
 * NOTE — one remaining second answer: the receipt's share link
 * (`components/receipt/useReceiptLink.ts`) resolves the backend's path against
 * the reader's own `window.location.origin`. That is defensible for a link minted
 * in the browser, but it is the last place that answers "what is our host" a
 * different way, and moving it onto this constant is the obvious next step.
 */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://seti.live').replace(
  /\/+$/,
  ''
);

/**
 * The public payment page for a merchant handle — what a printed sticker, a
 * shared link and the hero's QR all carry. The route is
 * `app/m/[handle]/page.tsx`, unauthenticated on purpose: a stranger scanning a
 * code must be able to see who they are paying before being asked for anything.
 */
export function merchantPaymentUrl(handle: string): string {
  return `${SITE_ORIGIN}/m/${handle}`;
}

/**
 * The product app's origin — the host the signed-in app answers on (#574).
 *
 * The app lives on its own host so that nothing the marketing page loads can reach a
 * signed-in session's storage. Two places need to know that host rather than assume the
 * reader is already on it: the redirect after an invitation, which arrives on
 * `seti.live/i/<handle>` and must land on the app's host, and anything else that has to
 * cross from the marketing side to the product side.
 *
 * Empty string in development, so a local `next dev` keeps every link relative and
 * `localhost:3000/app` keeps working. Set `NEXT_PUBLIC_APP_ORIGIN` to point a build at a
 * different host. A trailing slash is stripped, same reason as `SITE_ORIGIN`.
 */
export const APP_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? (process.env.NODE_ENV === 'production' ? 'https://app.seti.live' : '')
).replace(/\/+$/, '');

/**
 * The domain the invite cookie is scoped to, or `undefined` where there is only one host.
 *
 * `seti-invite` is set on `seti.live` when an invitation link is opened, and read by the
 * app on `app.seti.live`. A cookie without a domain is scoped to the host that set it, so
 * without this the invite would be dropped at the host boundary and every attributed
 * signup would silently stop being attributed. It is `undefined` in development because
 * a `.seti.live` cookie is refused by a `localhost` origin.
 */
export const SITE_COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.seti.live' : undefined;

/**
 * Where an invitation link forwards to, on the app's own host.
 *
 * `invite=not-live` is the one difference between a live and a dead invitation: the same
 * landing place, with a flag the app can read, so a dead link says so instead of
 * pretending it worked.
 */
export function appInviteLanding(isLive: boolean): string {
  const flag = isLive ? '' : '?invite=not-live';

  // Production: the app's own host, absolute, because the reader is on the apex.
  // Development: there is only one host, and the app is the `/app` path on it.
  return APP_ORIGIN ? `${APP_ORIGIN}/${flag}` : `/app${flag}`;
}
