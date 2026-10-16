import type { NoIdentityView } from '@/components/app/no-account.types';

export interface RailIdentitySignedOutProps {
  /** `anonymous` or `restoring` — the rail's card is only drawn for these. */
  view: NoIdentityView;
}
