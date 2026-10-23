'use client';

import { Button, IconButton, Text } from '@/components/ui';
import { useCopyLink } from '@/components/app/useCopyLink';
import { RECEIVE_COPY } from './receive.constants';
import { useShareLink } from './useShareLink';
import type { ShareState } from './useShareLink.types';
import type { ReceiveHalfProps } from './ReceiveHalf.types';

/** What the share control is telling the reader, after it was pressed. */
function shareLabel(state: ShareState): string {
  if (state === 'shared') return RECEIVE_COPY.shared;
  if (state === 'copied') return RECEIVE_COPY.sharedByCopy;
  return RECEIVE_COPY.share;
}

/**
 * One receive half, top to bottom, on ONE axis: the code, the name it stands for, then
 * the controls that hand it out.
 *
 * THE AXIS IS THE CENTRE, and that is a reversal with a reason. This half used to be
 * left-aligned on the argument that "a centred plate above left-aligned text is two
 * edges". That was true of what it held then: a bordered field wrapping 42 characters
 * of address was paragraph-shaped with a real left edge, and a note under it was a
 * second line of prose, so centring the plate above them did leave the eye without an
 * edge to follow.
 *
 * The field and the note are gone. What is left is three stacked things of comparable
 * width — a 288px code, one line of display type, one row of controls — and no prose.
 * A centred stack has exactly one edge (the centre) and reads as one object to show
 * someone, which is what this page is for. A left-aligned 288px square inside the app's
 * 768px desktop column leaves half the column empty to its right and reads as an
 * unfinished form. Both readings were checked in a render at 390x844 and at 1440x900.
 *
 * The order is the order a person needs it in: scan it, say who it is, hand it over or
 * save it. The copy control sits AT the name it copies rather than in a column of its
 * own, so the two read as one thing; share and save sit under both, because they act on
 * the half rather than on the string.
 *
 * SHARE WEARS THE FILL AND SAVE DOES NOT. Both were `ghost`, on the argument that
 * matching `QrDownloadControl`'s recipe was worth more than two mismatched controls.
 * The render said otherwise: two cobalt text actions of equal weight under one name gave
 * the screen two alternatives and no next step, so the eye had nothing to land on after
 * the code. Sharing is what this page is FOR (hand the code over), and saving it is the
 * rarer alternative, so Share is the one filled pill and download stays the lighter
 * action beside it — the system's own premise-and-its-alternative pairing, which the
 * Home actions already use.
 */
export function ReceiveHalf({ plate, headline, copy, share, download }: ReceiveHalfProps) {
  const copyState = useCopyLink(copy?.value ?? '');
  const shareLink = useShareLink(share?.title ?? '', share?.url ?? '');
  const copied = copyState.state === 'copied';

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {plate}

      <div className="flex max-w-full items-center justify-center gap-1">
        <Text variant="display" as="p" className="min-w-0 break-words">
          {headline}
        </Text>
        {copy ? (
          <IconButton
            name={copied ? 'check' : 'copy'}
            tone={copied ? 'confirmed' : 'default'}
            label={copy.label}
            onClick={copyState.copy}
          />
        ) : null}
      </div>

      {share || download ? (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {share ? (
            <Button variant="primary" onClick={shareLink.share}>
              {shareLabel(shareLink.state)}
            </Button>
          ) : null}
          {download}
        </div>
      ) : null}

      {copyState.state === 'failed' ? (
        <Text variant="micro" as="p" color="alert">
          {RECEIVE_COPY.copyFailed}
        </Text>
      ) : null}

      {shareLink.state === 'failed' ? (
        <Text variant="micro" as="p" color="alert">
          {RECEIVE_COPY.shareFailed}
        </Text>
      ) : null}

      <Text
        variant="micro"
        as="p"
        color="success"
        role="status"
        className={copied ? undefined : 'sr-only'}
      >
        {copied ? copy?.confirmed ?? '' : ''}
      </Text>
    </div>
  );
}
