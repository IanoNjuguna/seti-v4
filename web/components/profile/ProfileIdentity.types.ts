import type { HandleIdentity } from '@/lib/api';

/** What the identity block renders: the person, and the name money reaches them at. */
export interface ProfileIdentityProps {
  /** The name the account goes by: their own, or the active handle's. */
  name: string;
  /** The stored handle without its `@`, or null when the account holds none. */
  handle: string | null;
}

/**
 * The person, read from the account the app has already loaded.
 *
 * `businesses` is every business handle the account holds, listed and never
 * chosen: the account model carries `intent: personal | business`, not a selected
 * business, so no surface may pretend one of them is "the active business".
 */
export interface UseProfileIdentityReturn extends ProfileIdentityProps {
  businesses: HandleIdentity[];
}
