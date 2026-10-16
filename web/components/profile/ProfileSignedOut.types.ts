import type { NoIdentityView } from '@/components/app/no-account.types';

export interface ProfileSignedOutProps {
  /** `anonymous` or `restoring` — never `signed-in` (`ProfileScreen` renders that). */
  view: NoIdentityView;
}
