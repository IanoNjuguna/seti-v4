import type { NoIdentityView } from '@/components/app/no-account.types';

export interface HomeSignedOutProps {
  /** `anonymous` or `restoring` — never `signed-in` (`HomeScreen` renders that). */
  view: NoIdentityView;
  /**
   * True only when this visit arrived on an invite link that names nobody.
   *
   * Set by `HomeSignedOutGate` from `?invite=not-live`, which the `/i/<handle>` route
   * adds for an unknown or parked handle. It exists so the page can say the invite is
   * not live rather than leaving the visitor to conclude it is: a link that does
   * nothing looks the same as a link that worked, and only one of those is true.
   */
  inviteNotLive?: boolean;
}
