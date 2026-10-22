/**
 * Spend the invite cookie from the browser.
 *
 * The cookie is httpOnly, so the page that carried it cannot expire it itself; it
 * asks the route that set it (`DELETE /api/invite`, same origin, no arguments).
 *
 * Called once, after an account has been established on this browser and only when
 * a code was actually carried. Never awaited and never reported: nothing here can
 * fail in a way a person needs to act on, and the worst case is a code that lingers
 * until it expires — which the API refuses to attribute twice anyway.
 */
export async function clearInviteCode(): Promise<void> {
  try {
    await fetch('/api/invite', { method: 'DELETE', cache: 'no-store' });
  } catch {
    // Offline, or the route is missing in some deployment. The cookie expires on its
    // own; there is nothing to tell the person and nothing to retry.
  }
}
