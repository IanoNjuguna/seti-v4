import type { HandleIdentity } from '@/lib/api';

/** What the settings list renders: the account's own facts, and its businesses. */
export interface ProfileSettingsProps {
  /** The name the account goes by, as the identity block states it. */
  name: string;
  /** The stored handle without its `@`, or null when the account holds none. */
  handle: string | null;
  /** Every business handle the account holds. Listed, never chosen. */
  businesses: HandleIdentity[];
}
