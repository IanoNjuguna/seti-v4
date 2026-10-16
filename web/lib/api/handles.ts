import { get, post } from './client';
import { API_BASE_URL } from './api.constants';
import type {
  ClaimHandleRequest,
  HandleIdentity,
  HandleKind,
  HandleStatusPreview,
  HandleStatusResult,
  ResolveHandleResult,
} from './handles.types';

/**
 * Resolve a handle — the ONE lookup.
 *
 * A username, a business name, a stored handle, a platform id or a seti:// QR all
 * go through this call and come back as one kind of identity. The payload is sent
 * verbatim and `backend/src/services/handles.ts` decides what it is: parsing it
 * here would be a second implementation of a rule the backend already owns.
 *
 * `suggestedAmount` is the amount a link carried, if any.
 */
export async function resolveHandle(q: string): Promise<ResolveHandleResult> {
  const encoded = encodeURIComponent(q);
  return get<ResolveHandleResult>(`/handles/resolve?q=${encoded}`);
}

/**
 * Ask the backend what handle a name will get and whether it is taken.
 *
 * This is the claim path's OWN validation, not a second rule written here, so
 * the preview cannot call a handle free that the claim would then refuse. It sits
 * behind the same auth as the claim: a signed-in user checking a handle they are
 * about to sign for, not anonymous enumeration.
 *
 * The KIND goes with the question because it decides WHICH rule applies to
 * availability: a person's username is global (one name, both networks), a
 * business's name is the acting network's. Asking without it would let the form
 * call a username free that the claim then refuses as taken on the other network.
 * Omitted when it is not known yet — onboarding's name step, before the intent is
 * chosen — and the backend answers conservatively under both rules.
 */
export async function fetchHandleStatus(
  name: string,
  kind?: HandleKind
): Promise<HandleStatusPreview> {
  const query = new URLSearchParams({ name });
  if (kind) query.set('kind', kind);

  const { status } = await get<HandleStatusResult>(`/handles/status?${query}`);
  return status;
}

/**
 * Claim a username or business name for the wallet that signed it.
 *
 * The backend verifies the EIP-712 signature (whose `purpose` must match `kind`),
 * checks the signer owns the address and that the handle is free, then STORES the
 * signature — one-time, no gas, nothing on chain. Refusals come back as an
 * {@link ApiError} carrying a machine-readable `code`.
 */
export async function claimHandle(input: ClaimHandleRequest): Promise<HandleIdentity> {
  const { handle } = await post<{ handle: HandleIdentity }>('/handles/claim', input);
  return handle;
}

/**
 * The public identity behind a `seti.live/m/<handle>` or `seti.live/u/<handle>` link.
 *
 * This is the ONE read in the app that is deliberately unauthenticated: the whole
 * point of a link is that a customer can open it signed out and see who they are
 * about to pay before setting up anything. It hits `/public/handles/:handle`,
 * which has no auth hook at all — see `backend/src/routes/public-handles.ts`.
 *
 * `null` means "no such handle" (a 404), which the page turns into `notFound()`.
 * Any other failure is thrown and becomes a real error, never a fake 404: a
 * backend that is down must not read to a stranger as "this handle does not
 * exist".
 */
export async function fetchPublicHandle(handle: string): Promise<HandleIdentity | null> {
  const response = await fetch(`${API_BASE_URL}/public/handles/${encodeURIComponent(handle)}`, {
    // The identity is live: a name can be claimed or its address repointed, so
    // this is never served from Next's cache.
    cache: 'no-store',
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Could not load this handle (${response.status}).`);
  }

  const { handle: identity } = (await response.json()) as { handle: HandleIdentity };
  return identity;
}
