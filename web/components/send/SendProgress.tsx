import { cn } from '@/lib/cn';
import { SEND_FLOW_COPY } from './Send.constants';

export interface SendProgressProps {
  /** Zero-based index of the step the customer is on. */
  current: number;
}

/**
 * Where the customer is in the flow: a filled track per step, the reached ones in
 * ink and the rest in the hairline, with the step's name beside each.
 *
 * It is drawn from ONE array (`SEND_FLOW_COPY.steps`), so the bar cannot promise a
 * different number of steps than the flow has. A progress bar that changes shape
 * when a branch is chosen is worse than none: the customer learns mid-flow that
 * what they were told was wrong.
 *
 * The name is text beside the track, not a number in a circle, and the current one
 * is `aria-current="step"` — the bar is a fact about the flow, so it is a `list`
 * of steps rather than decoration.
 *
 * The label wears the system's `caption` recipe and nothing else, exactly as the
 * wizard's own step list does (`OnboardingSteps`): two progress indicators for the
 * same kind of label must read as one thing, and setting this one in uppercase
 * with wide tracking made a second eyebrow style the doc does not define. The
 * steps still AHEAD are `mute` (#505a63, 7.0:1) rather than `stone` (#8d969e,
 * 3.0:1) — the unreached steps are the ones a person is looking for, and at 13px
 * they were below AA.
 */
export function SendProgress({ current }: SendProgressProps) {
  return (
    <ol aria-label={SEND_FLOW_COPY.progressLabel} className="flex items-center gap-3">
      {SEND_FLOW_COPY.steps.map((label, index) => {
        const active = index === current;

        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-1 min-w-6 flex-1 rounded-full transition-colors duration-(--duration-quick) ease-out',
                index <= current ? 'bg-canvas-dark' : 'bg-hairline-light'
              )}
            />
            <span
              className={cn('text-caption', active ? 'font-semibold text-ink' : 'text-mute')}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
