'use client';

import { Card, StateMessage, Text } from '@/components/ui';
import { ProfileHandlePanel } from './ProfileHandlePanel';
import { ProfileIntentSwitch } from './ProfileIntentSwitch';
import { PROFILE_INTENT_COPY } from './ProfileIntent.constants';
import { useProfileIntent } from './useProfileIntent';

/**
 * The account's mode, and the name that mode uses.
 *
 * This replaces the old "claim a business name" card. A link into the claim surface
 * was the whole of that card, and it was one-way by construction: a person who
 * claimed a username at sign-up had no route back to a business name, and a
 * business had no route to a username. Here the mode is a switch in both
 * directions, and the panel below it shows (or offers to claim) the name that mode
 * needs — the same claim surface either way.
 *
 * The mode is read from the account, not held here: the gate and this card read one
 * answer, so they cannot disagree about which mode the account is in.
 */
export function ProfileIntentCard() {
  const { intent, handleFor, switching, error, switchTo } = useProfileIntent();

  return (
    <Card className="space-y-4">
      <div>
        <Text variant="card-title" as="p">
          {PROFILE_INTENT_COPY.title}
        </Text>
        <Text variant="micro" as="p" className="mt-1">
          {PROFILE_INTENT_COPY.intro}
        </Text>
      </div>

      <ProfileIntentSwitch
        intent={intent}
        switching={switching}
        onSwitch={(kind) => void switchTo(kind)}
      />

      {error ? (
        <StateMessage tone="alert" title={PROFILE_INTENT_COPY.errorTitle} body={error} />
      ) : null}

      <ProfileHandlePanel intent={intent} handle={handleFor(intent)} />
    </Card>
  );
}
