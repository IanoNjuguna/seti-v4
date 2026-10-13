'use client';

import { cn } from '@/lib/cn';
import { ACCOUNT_INTENTS, ACCOUNT_MODE_LABEL } from '@/lib/account';
import { PROFILE_INTENT_COPY } from './ProfileIntent.constants';
import type { ProfileIntentSwitchProps } from './ProfileIntent.types';

/**
 * The mode switch — two pressed-state pills.
 *
 * Buttons with `aria-pressed` rather than a radio group, and that is a keyboard
 * decision: a radio group fires on ARROW keys, so sweeping across the two options
 * with the arrow keys would write the preference once per keypress — and on the
 * wizard's equivalent step would start a wallet signature. A button fires on Enter
 * or Space only, which is where a state change belongs.
 *
 * `aria-pressed` is what carries the state to a screen reader; the dark fill is the
 * visual half of the same signal, never the only one.
 */
export function ProfileIntentSwitch({ intent, switching, onSwitch }: ProfileIntentSwitchProps) {
  return (
    <div role="group" aria-label={PROFILE_INTENT_COPY.switchLabel} className="flex flex-wrap gap-2">
      {ACCOUNT_INTENTS.map((mode) => {
        const active = intent === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            aria-busy={switching === mode}
            disabled={switching !== null}
            onClick={() => onSwitch(mode)}
            className={cn(
              'min-touch h-10 rounded-full px-5 text-body-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light',
              'disabled:cursor-not-allowed disabled:opacity-60',
              active ? 'bg-canvas-dark text-on-dark' : 'bg-surface-soft text-ink hover:bg-faint'
            )}
          >
            {ACCOUNT_MODE_LABEL[mode]}
          </button>
        );
      })}
    </div>
  );
}
