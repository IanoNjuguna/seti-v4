import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card, type CardPadding } from './Card';
import { Text } from './Text';

/**
 * Which state a message is. `neutral` (the default, and the previous sole
 * rendering) is the long-form card: a title, one sentence and at most one
 * action. `empty` and `failure` are deliberately different SHAPES, not a tint
 * swap — the defect was that both read identically and were told apart only by a
 * red hairline:
 *
 *  - `empty` reads *nothing here yet + what will appear*: a soft, centred well
 *    (the doc's inset group — `surface-soft`, no border) with a neutral icon
 *    medallion above the copy.
 *  - `failure` reads *something went wrong + what to do*: it sits ON the page, not
 *    in a box — left-aligned, a leading alert medallion beside an alert-coloured
 *    title and the fix (`action`).
 */
export type StateMessageVariant = 'neutral' | 'empty' | 'failure';

export interface StateMessageProps {
  /** State shape. Defaults to `neutral`, byte-identical to the previous rendering. */
  variant?: StateMessageVariant;
  title: string;
  body: string;
  /** Optional call to action, e.g. a retry button — and, on `failure`, the "what to do". */
  action?: ReactNode;
  /** Optional leading icon, e.g. `<Icon name="alert" className="h-5 w-5" />`, drawn in a medallion. */
  icon?: ReactNode;
  /**
   * Passed through to the Card inset; `sm` is the phone step for the home/activity
   * cards. Ignored on `failure`, which no longer sits in a surface at all.
   */
  padding?: CardPadding;
}

const MEDALLION = 'flex shrink-0 items-center justify-center rounded-full';

/**
 * One component for the empty and error states, now in three shapes that read
 * differently. The `neutral` default is unchanged so no existing caller moves
 * unless it opts into `empty` or `failure`.
 *
 * `failure` is the app's ONE failure primitive — every failure surface renders
 * through this one branch (`activity`, `pay`, `auth`, `merchant`, `onboarding`,
 * `profile`). Taking it out of its card therefore flips ALL of them at once, and
 * that is intended: text lives on the page and only objects sit in surfaces, so a
 * bordered, rounded, background-filled box around a heading, a sentence and a
 * retry control was a surface drawn around the page's own words. The retry control
 * is itself an object and is left exactly as it is; `role="alert"` and the
 * alert/warning colour roles are untouched, so the accessible structure is
 * byte-identical to before.
 */
export function StateMessage({
  variant = 'neutral',
  title,
  body,
  action,
  icon,
  padding = 'md',
}: StateMessageProps) {
  if (variant === 'failure') {
    return (
      <div role="alert" className="flex items-start gap-4">
        {icon ? (
          <span aria-hidden="true" className={cn(MEDALLION, 'h-10 w-10 bg-surface-soft text-accent-danger')}>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <Text variant="card-title" color="alert" as="p">
            {title}
          </Text>
          <Text variant="body" color="secondary" as="p" className="mt-1">
            {body}
          </Text>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    );
  }

  if (variant === 'empty') {
    return (
      <Card padding={padding} inset className="flex flex-col items-center text-center">
        {icon ? (
          <span aria-hidden="true" className={cn(MEDALLION, 'h-14 w-14 bg-canvas-light text-mute')}>
            {icon}
          </span>
        ) : null}
        <Text variant="card-title" as="p" className={icon ? 'mt-3' : undefined}>
          {title}
        </Text>
        <Text variant="body" color="secondary" as="p" className="mt-1 max-w-sm">
          {body}
        </Text>
        {action ? <div className="mt-4">{action}</div> : null}
      </Card>
    );
  }

  return (
    <Card padding={padding}>
      <Text variant="card-title" as="p">
        {title}
      </Text>
      <Text variant="body" color="secondary" as="p" className="mt-1">
        {body}
      </Text>
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}
