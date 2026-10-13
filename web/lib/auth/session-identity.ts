import type { AuthUser } from './auth.types';

/**
 * Does the stored identity describe the account the token actually belongs to?
 *
 * Only `id` and `email` are compared, because those are the two fields a token
 * resolves to — they are what "who this is" means. Everything else on the record
 * (`firstName`, `lastName`, `phone`) can legitimately change server-side between
 * loads, and treating a profile edit as an identity mismatch would sign a real
 * user out for typing their name. Those fields are refreshed from the server's
 * answer instead; this predicate only decides whether the pair is the same
 * account at all.
 *
 * A null on either side is a mismatch: an account with no resolved identity
 * cannot be confirmed, and the caller must not adopt it.
 */
export function isSameAccount(stored: AuthUser | null, resolved: AuthUser | null): boolean {
  if (!stored || !resolved) return false;
  return stored.id === resolved.id && stored.email === resolved.email;
}

/**
 * Why a stored session was refused, in words that name the actual fault.
 *
 * This is the one case a person can be shown a discrepancy about: the browser
 * held one account and the token belonged to another, which is either a stale
 * snapshot from before an account switch or a hand-edited localStorage entry.
 * Both are cleared the same way; naming the mismatch (rather than a bare "could
 * not sign in") is what makes a tamper report distinguishable from an outage.
 */
export function describeStoredSessionMismatch(stored: AuthUser, resolved: AuthUser): string {
  const held = stored.email ?? stored.id;
  const owned = resolved.email ?? resolved.id;
  return (
    `The session stored on this device said ${held}, but the token belongs to ${owned}. ` +
    'The stored session was cleared — sign in again.'
  );
}

/** Why the server would not confirm the stored session — a rejection or a fault. */
export function describeStoredSessionFailure(cause: unknown): string {
  const reason = cause instanceof Error ? cause.message : 'the server refused the token';
  return `Could not confirm this session with the server (${reason}). It was cleared — sign in again.`;
}
