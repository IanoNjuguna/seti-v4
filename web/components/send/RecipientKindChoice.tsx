'use client';

import { cn } from '@/lib/cn';
import { SEND_FLOW_COPY } from './Send.constants';
import type { RecipientKind } from './RecipientStep';

export interface RecipientKindChoiceProps {
  kind: RecipientKind;
  onKindChange: (kind: RecipientKind) => void;
}

/**
 * The flow's two answers, as pressed-state buttons.
 *
 * Never colour alone: `aria-pressed` says which is chosen, so the dark fill is the
 * second signal rather than the only one. The press is answered on pointer-DOWN with
 * the system's own pressed step (`Button.constants.ts`) — an instant 2% scale, the
 * same one every other control in the app answers with. Without it the choice was
 * hover-only, so a touch user got nothing back until the step changed under them.
 *
 * Extracted from `RecipientStep` unchanged when the step grew the recent-people block
 * (#99): the step now holds three sections (question, answer, field plus repeat
 * entry) and the answers are the one of them that is a self-contained control.
 */
export function RecipientKindChoice({ kind, onKindChange }: RecipientKindChoiceProps) {
  const byName = kind === 'name';

  return (
    <div role="group" aria-label={SEND_FLOW_COPY.question} className="flex flex-col gap-2">
      {([true, false] as const).map((isName) => {
        const active = isName === byName;

        return (
          <button
            key={isName ? 'name' : 'address'}
            type="button"
            aria-pressed={active}
            onClick={() => onKindChange(isName ? 'name' : 'address')}
            className={cn(
              'min-touch w-full rounded-md px-4 py-3 text-left text-body-sm font-semibold transition-colors',
              'active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light',
              active ? 'bg-canvas-dark text-on-dark' : 'bg-surface-soft text-ink hover:bg-faint'
            )}
          >
            {isName ? SEND_FLOW_COPY.byName : SEND_FLOW_COPY.byAddress}
          </button>
        );
      })}
    </div>
  );
}
