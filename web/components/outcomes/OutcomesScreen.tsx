import { Icon } from '@/components/ui/Icon';
import { StateMessage, Text } from '@/components/ui';
import { OUTCOMES_COPY, OUTCOMES_ICON } from './Outcomes.constants';

/**
 * Outcomes — the dock's third place, and not open yet.
 *
 * ## Why it is a state and not a preview
 *
 * A tab that opens on an empty chart, a zero or a skeleton would each be a claim: a zero is a
 * real balance of nothing, a skeleton says data is on its way, and an empty chart says the
 * account has been measured. None of that is true, so the page states the one true thing — the
 * surface is being built — and nothing else. That is also why there is no retry control: nothing
 * failed, so there is nothing to retry.
 *
 * ## Why it has no account-specific work
 *
 * Nothing here reads the session. The page cannot show a figure to a signed-in account or to a
 * signed-out visitor, and `AppGate` already decides the second case before this renders, so the
 * screen owes neither a loading nor a signed-out branch of its own.
 */
export function OutcomesScreen() {
  return (
    <div className="flex flex-col gap-6">
      <Text variant="section" as="h1">
        {OUTCOMES_COPY.title}
      </Text>

      <StateMessage
        variant="empty"
        icon={<Icon name={OUTCOMES_ICON} className="h-6 w-6" />}
        title={OUTCOMES_COPY.stateTitle}
        body={OUTCOMES_COPY.stateBody}
      />
    </div>
  );
}
