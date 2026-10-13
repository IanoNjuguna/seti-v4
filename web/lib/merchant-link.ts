/**
 * A merchant's handle, and the link a customer follows.
 *
 * The handle is the name in lowercase with everything outside `[a-z0-9._-]`
 * removed: `Java House` → `javahouse`. Lowercase because a link a merchant
 * prints on a sticker must not be case-sensitive to retype, and because it is
 * matched against a key the backend lowercases. Characters outside that set are
 * removed rather than hyphenated so the common case reads as a word
 * (`javahouse`, not `java-house`) and so a name that legitimately contains a
 * hyphen cannot collide with a name that contains a space.
 *
 * THIS FILE IS A MIRROR. The rule is the backend's, in
 * `backend/src/lib/merchant-name.ts` → `merchantHandle`, which is what the
 * backend STORES on the merchant and enforces as unique at claim time. This copy
 * exists only so the link can be built in the browser without a round trip, and
 * the two are pinned to each other by `backend/src/services/merchant-handle.check.ts`,
 * which imports this module at runtime and asserts it produces the same string as
 * the backend for a table of names. Change one, change both — the gate will say
 * so.
 *
 * The host is stated once, here. A second copy of it in a component is how a product
 * ends up shipping two spellings of its own address.
 */

/** The product's public host. Any other value is a bug, not a configuration. */
const HOST = 'seti.live';

/**
 * The handle for a name: lowercase, no characters outside `[a-z0-9._-]`.
 *
 * Non-URL-safe characters are dropped rather than escaped, because an escaped handle
 * in a printed link is unusable — `%2C` on a sticker is not a handle.
 */
export function merchantHandle(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

/** The link a business hands to a customer. */
export function merchantLink(name: string): string {
  /*
   * A plain path, not `/@name`.
   *
   * In the App Router a folder named `@name` is a parallel route slot rather than a
   * URL, so `/@name` would need middleware to rewrite it — or a root-level catch-all
   * that turns every unknown path into a merchant lookup. `/m/<handle>` is an ordinary
   * route that collides with nothing, and it is short enough to print on a sticker.
   */
  return `https://${HOST}/m/${merchantHandle(name)}`;
}

/**
 * The link a PERSON hands to a customer: `seti.live/u/<handle>`.
 *
 * The same handle rule as `merchantLink` — a person's username and a business's
 * name compete for the same string, so `/u/<handle>` and `/m/<handle>` are two
 * routes onto ONE namespace, not two namespaces. `/u` is an ordinary route that
 * collides with nothing.
 */
export function personLink(name: string): string {
  return `https://${HOST}/u/${merchantHandle(name)}`;
}

/**
 * Whether a handle belongs to a person or a business — the shape a link needs.
 *
 * Declared here rather than imported from `@/lib/api/handles.types` on purpose:
 * this file is loaded at RUNTIME by the backend's `check:handle` suite (it is the
 * live mirror the drift assertion compares against), so it must stay dependency-
 * free. The backend owns the same union in `handle-claims.ts`.
 */
export type HandleLinkKind = 'person' | 'business';

/**
 * The link for a handle, by KIND. The same string either way — `/u/<handle>` for
 * a person, `/m/<handle>` for a business.
 *
 * One namespace, two routes onto it: a claim the app makes as `person` must not
 * hand out a `/m/` link, because `/m` is the shop page and a customer following
 * it would be paying a person as though they were a merchant. Which route a
 * handle lives at is decided by the kind it was claimed as.
 */
export function handleLink(kind: HandleLinkKind, name: string): string {
  return kind === 'person' ? personLink(name) : merchantLink(name);
}

/**
 * The human-readable form of the same link — `seti.live/u/<handle>` — for copy
 * that names the address before it is a clickable URL (an error message, a
 * sticker's caption). Built from the same handle and the same two route names.
 */
export function handleLinkLabel(kind: HandleLinkKind, handle: string): string {
  return `${HOST}/${kind === 'person' ? 'u' : 'm'}/${handle}`;
}
