import type { ReactNode } from 'react';
import { Card } from './Card';
import { Text } from './Text';

export interface StateMessageProps {
  title: string;
  body: string;
  /** Optional call to action, e.g. a retry button. */
  action?: ReactNode;
  /** `alert` tints the surface for a failure; the default is neutral/empty. */
  tone?: 'neutral' | 'alert';
}

/**
 * One component for the empty and error states so they read the same
 * everywhere: a title, one sentence, and at most one action.
 */
export function StateMessage({ title, body, action, tone = 'neutral' }: StateMessageProps) {
  return (
    <Card
      className={tone === 'alert' ? 'border-accent-danger bg-canvas-light' : undefined}
      role={tone === 'alert' ? 'alert' : undefined}
    >
      <Text variant="card-title" as="p">
        {title}
      </Text>
      <Text variant="body" color="secondary" as="p" className="mt-1">
        {body}
      </Text>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}
