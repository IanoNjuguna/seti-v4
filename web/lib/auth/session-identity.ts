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
 *
 * ## Why there is no longer a sentence here
 *
 * This module also held the words a person read when the pair did not survive:
 * one naming the two accounts, and one wrapping the mapped refusal in brackets and
 * appending a second instruction (#284). Both are gone, and the copy lives in
 * `session-problem.constants.ts`, so this file is back to the one question it is
 * named for. The two-accounts sentence is the loss worth naming: a mismatch is
 * still a distinct EVENT, it is the tamper signal, it just no longer gets its own
 * paragraph, because the only action behind it is signing in again and the expiry
 * sentence already says that.
 */
export function isSameAccount(stored: AuthUser | null, resolved: AuthUser | null): boolean {
  if (!stored || !resolved) return false;
  return stored.id === resolved.id && stored.email === resolved.email;
}
