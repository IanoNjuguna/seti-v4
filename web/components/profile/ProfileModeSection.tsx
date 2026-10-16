import { StateMessage } from '@/components/ui';
import { PROFILE_INTENT_COPY } from './ProfileIntent.constants';
import { ProfileHandlePanel } from './ProfileHandlePanel';
import { ProfileIntentSwitch } from './ProfileIntentSwitch';
import { ProfileSection } from './ProfileSection';
import type { ProfileModeSectionProps } from './ProfileScreen.types';

/**
 * The mode row: how this account uses Seti, and the name that mode has.
 *
 * The switch is the control and the words around it are the page's. The name behind
 * the active mode is rendered by the SAME panel the claim flow uses
 * (`ProfileHandlePanel`), so this row, the claim surface and the rail cannot disagree
 * about what the account holds — the link, the QR and the "no name yet" state all
 * come from one place.
 */
export function ProfileModeSection({
  intent,
  switching,
  handle,
  error,
  onSwitch,
}: ProfileModeSectionProps) {
  return (
    <ProfileSection title={PROFILE_INTENT_COPY.title} intro={PROFILE_INTENT_COPY.intro}>
      <div className="flex flex-col gap-4">
        <ProfileIntentSwitch intent={intent} switching={switching} onSwitch={onSwitch} />

        {error ? (
          <StateMessage variant="failure" title={PROFILE_INTENT_COPY.errorTitle} body={error} />
        ) : null}

        <ProfileHandlePanel intent={intent} handle={handle} />
      </div>
    </ProfileSection>
  );
}
