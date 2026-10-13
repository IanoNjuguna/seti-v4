import { cn } from '@/lib/cn';
import { ONBOARDING_STEPS } from './Onboarding.constants';
import type { OnboardingStepsProps } from './Onboarding.types';

/**
 * Where the person is in the four steps.
 *
 * The number is TEXT, not a colour: `1. Sign in › 2. Claim your name …` reads the
 * same to a screen reader and to someone who cannot see the ink/starlight
 * difference, and `aria-current="step"` says which one is live without relying on
 * the visual weight either. Wraps rather than scrolls at 360px — four labels do not
 * fit on one line and a horizontally scrolling progress bar hides its own end.
 */
export function OnboardingSteps({ current }: OnboardingStepsProps) {
  const index = ONBOARDING_STEPS.findIndex((step) => step.id === current);

  return (
    <ol aria-label="Setup progress" className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {ONBOARDING_STEPS.map((step, position) => {
        const isCurrent = position === index;
        const isDone = position < index;
        return (
          <li key={step.id} className="flex items-center gap-1.5">
            {position > 0 ? (
              <span aria-hidden className="text-caption text-faint">
                ›
              </span>
            ) : null}
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'text-caption',
                isCurrent ? 'font-semibold text-ink' : isDone ? 'text-mute' : 'text-stone'
              )}
            >
              {position + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
