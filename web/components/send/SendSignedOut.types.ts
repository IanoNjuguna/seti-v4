import type { NoIdentityView } from '@/components/app/no-account.types';

export interface SendSignedOutProps {
  /** `anonymous` or `restoring` — never `signed-in` (`SendFlow` renders that). */
  view: NoIdentityView;
}
