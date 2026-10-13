import type { AccountIntent, HandleKind } from '@/lib/api';

/**
 * The account's own constants, mirroring `backend/src/services/account.ts`.
 *
 * ## Two vocabularies, one bridge
 *
 * `AccountIntent` is `personal` | `business`; `HandleKind` is `person` |
 * `business`. They are not the same thing and are deliberately not aliased:
 *
 *  - the INTENT is the ACCOUNT's mode — a preference, switchable at any time;
 *  - the KIND is the HANDLE's — what a name was claimed as, and therefore which
 *    `purpose` its signature covers.
 *
 * `HANDLE_KIND_FOR_INTENT` is the ONE place they meet, and it exists as a map
 * rather than as a rename so a reader has to pass through it and see the
 * distinction. Onboarding picks an intent and this decides the kind it claims and,
 * through the claim hook, the purpose the wallet signs.
 */
export const ACCOUNT_INTENTS: readonly AccountIntent[] = ['personal', 'business'];

export const ACCOUNT_MODE_LABEL: Record<AccountIntent, string> = {
  personal: 'Personal',
  business: 'Business',
};

export const HANDLE_KIND_FOR_INTENT: Record<AccountIntent, HandleKind> = {
  personal: 'person',
  business: 'business',
};

/** The mode a handle belongs to — the same bridge, read the other way. */
export function intentForHandleKind(kind: HandleKind): AccountIntent {
  return kind === 'person' ? 'personal' : 'business';
}

export function isAccountIntent(value: unknown): value is AccountIntent {
  return value === 'personal' || value === 'business';
}
