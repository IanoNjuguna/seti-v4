import type { NoIdentityView } from '@/components/app/no-account.types';

export interface HomeSignedOutProps {
  /** `anonymous` or `restoring` — never `signed-in` (`HomeScreen` renders that). */
  view: NoIdentityView;
}
