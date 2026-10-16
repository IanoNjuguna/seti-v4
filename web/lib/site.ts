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
