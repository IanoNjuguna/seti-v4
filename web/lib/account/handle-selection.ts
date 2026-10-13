import type { AccountIntent, HandleIdentity } from '@/lib/api';
import { HANDLE_KIND_FOR_INTENT } from './account.constants';

/**
 * The handle an account holds for a MODE.
 *
 * The one place an intent is read against the handle list, so every surface that
 * asks "which name is this mode using?" — the Profile panel and the rail's
 * identity card — cannot answer differently. `HANDLE_KIND_FOR_INTENT` is the
 * bridge (`personal` → `person`), and this is where it is crossed; the mode is
 * the account's word, the handle carries the handle's word.
 *
 * A mode with no name is `null`, which is a normal state and not a failure: an
 * account can hold a business name and no username, or neither yet.
 */
export function handleForIntent(
  handles: HandleIdentity[],
  intent: AccountIntent
): HandleIdentity | null {
  return handles.find((held) => held.kind === HANDLE_KIND_FOR_INTENT[intent]) ?? null;
}
