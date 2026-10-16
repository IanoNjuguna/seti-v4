import { cn } from '@/lib/cn';
import { ONBOARDING_STEPS } from './Onboarding.constants';
import type { OnboardingStepsProps } from './Onboarding.types';

/**
 * Where the person is in the four steps.
 *
 * The number is TEXT, not a colour: `1. Sign in › 2. Claim your name …` reads the
 * same to a screen reader and to someone who cannot see the ink/stone
 * difference, and `aria-current="step"` says which one is live without relying on
 * the visual weight either. Wraps rather than scrolls at 360px — four labels do not
 * fit on one line and a horizontally scrolling progress bar hides its own end.
 *
 * Two levels of colour, not three: the live step is `ink` at semibold and every
 * other step is `mute`. The step still AHEAD used to be `stone` (#8d969e, 3.0:1 at
 * 13px, below AA), and a "done" step has nothing to prove next to a "not yet" one
 * — the number says which is which. The separator is drawn in `stone`: it is
 * decoration over 3:1 rather than text, and at `faint` (#c9c9cd) it was very nearly
 * invisible.
 */
export function OnboardingSteps({ current }: OnboardingStepsProps) {
  const index = ONBOARDING_STEPS.findIndex((step) => step.id === current);

  return (
    <ol aria-label="Setup progress" className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {ONBOARDING_STEPS.map((step, position) => {
        const isCurrent = position === index;
        return (
          <li key={step.id} className="flex items-center gap-1.5">
            {position > 0 ? (
              <span aria-hidden className="text-caption text-stone">
                ›
              </span>
            ) : null}
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className={cn('text-caption', isCurrent ? 'font-semibold text-ink' : 'text-mute')}
            >
              {position + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
