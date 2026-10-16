import type { ReactNode } from 'react';
import { PageBack } from '@/components/app/PageBack';
import { Text } from '@/components/ui';
import { SEND_FLOW_COPY } from './Send.constants';
import { SendProgress } from './SendProgress';

export interface SendFrameProps {
  /** 0 or 1 — which step of the flow the body is asking for. */
  current: number;
  children: ReactNode;
}

/**
 * The send page's own chrome: the way back, the title, and where the customer is
 * in the flow.
 *
 * It is a frame rather than four lines repeated in each state, because the flow's
 * body changes under it and the frame must not: a customer answering the
 * recipient question and one entering an amount see the same page, one step
 * apart. The body is a child, so what fills it is decided by the state rather
 * than by the frame.
 */
export function SendFrame({ current, children }: SendFrameProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageBack />
      <Text variant="section" as="h1">
        {SEND_FLOW_COPY.title}
      </Text>
      <SendProgress current={current} />
      {children}
    </div>
  );
}
