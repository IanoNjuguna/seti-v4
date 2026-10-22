'use client';

import { Button, Text } from '@/components/ui';
import { RECEIVE_COPY } from './receive.constants';
import { useShareLink } from './useShareLink';
import type { ReceiveHalfProps } from './ReceiveHalf.types';

/**
 * One receive half, top to bottom, on ONE axis: the code, the name, the field, then the
 * actions.
 *
 * Everything is left-aligned, the plate included. That is the change of shape: the old
 * halves centred a plate and then left-aligned the text beside it, so at 360px the eye
 * had no edge to follow and two strings read as a wall next to a square. A document
 * reads down one edge; so does this.
 *
 * The order is the order a person needs it in: scan it, say who it is, hand over the
 * string, send it onward or save the code. The note under the field belongs to the
 * FIELD (it says what else a sender can do with that account), which is why it arrives
 * already assembled rather than being drawn here.
 */
export function ReceiveHalf({ plate, title, monoTitle = false, field, share, download }: ReceiveHalfProps) {
  const { state, share: shareNow } = useShareLink(share?.title ?? '', share?.url ?? '');

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {plate}

      {title ? (
        <Text
          variant="card-title"
          as="p"
          className={monoTitle ? 'break-all font-mono' : 'break-words'}
        >
          {title}
        </Text>
      ) : null}

      {field}

      {share || download ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {share ? (
            <Button variant="ghost" onClick={shareNow}>
              {state === 'shared'
                ? RECEIVE_COPY.shared
                : state === 'copied'
                  ? RECEIVE_COPY.sharedByCopy
                  : RECEIVE_COPY.share}
            </Button>
          ) : null}
          {download}
        </div>
      ) : null}

      {state === 'failed' ? (
        <Text variant="micro" as="p" color="alert">
          {RECEIVE_COPY.shareFailed}
        </Text>
      ) : null}
    </div>
  );
}
