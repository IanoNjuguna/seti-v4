'use client';

import { StateMessage } from '@/components/ui';
import { PROFILE_INTENT_COPY } from './ProfileIntent.constants';
import { ProfileIntentSwitch } from './ProfileIntentSwitch';
import { ProfileRow } from './ProfileRow';
import { useProfileIntent } from './useProfileIntent';

/**
 * How the account is used, as a row with the switch inside it.
 *
 * The switch is kept, and it is the only control on this page that writes
 * anything: the mode decides which handle the app acts under and which name the
 * payment is signed as. It sits INSIDE the row rather than under a heading of its
 * own, so the page reads as one list and the one writable setting looks like the
 * rest of them until it is touched.
 *
 * The handle behind each mode is no longer printed here. The identity block at the
 * top of the page states the name the account is acting under, and a panel under
 * this switch printing it again was the same fact twice on one screen.
 */
export function ProfileModeRow() {
  const intent = useProfileIntent();

  return (
    <ProfileRow title={PROFILE_INTENT_COPY.title} subtitle={PROFILE_INTENT_COPY.intro}>
      <ProfileIntentSwitch
        intent={intent.intent}
        switching={intent.switching}
        onSwitch={(mode) => void intent.switchTo(mode)}
      />

      {intent.error ? (
        <div className="mt-3">
          <StateMessage variant="failure" title={PROFILE_INTENT_COPY.errorTitle} body={intent.error} />
        </div>
      ) : null}
    </ProfileRow>
  );
}
