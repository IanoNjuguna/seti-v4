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
 * One receive half, top to bottom, on ONE axis: the code, the row that names it, then
 * the actions that hand it out.
 *
 * THE AXIS IS THE CENTRE, and that is a reversal with a reason. This half used to be
 * left-aligned on the argument that "a centred plate above left-aligned text is two
 * edges". That was true of what it held then: a bordered field wrapping 42 characters
 * of address was paragraph-shaped with a real left edge, and a note under it was a
 * second line of prose, so centring the plate above them did leave the eye without an
 * edge to follow.
 *
 * The field and the note are gone. What is left is three stacked things of comparable
 * width — a 288px code, one named row, one row of controls — and no prose. A centred
 * stack has exactly one edge (the centre) and reads as one object to show someone,
 * which is what this page is for. A left-aligned 288px square inside the app's 768px
 * desktop column leaves half the column empty to its right and reads as an unfinished
 * form. Both readings were checked in a render at 390x844 and at 1440x900.
 *
 * THE NAME IS A LABELLED ROW NOW (#549). It was `@ian` and `Java House` in display type,
 * standing alone under the code, and nothing on the page said which of the account's two
 * strings a reader was looking at. The label is the missing half of the sentence —
 * `Username: @ian`, `Merchant name: Java House` — and the value keeps the emphasis at
 * 16px semibold, so the row reads as a value with its name beside it rather than as a
 * form field.
 *
 * The copy control sits AT the end of the row it acts on, bare, with no well (#549:
 * `IconButton`'s `well="none"`), so the glyph is a footnote to the value instead of a
 * disc competing with the code. It follows the LAST string in the row, which on the
 * merchant half is the handle: a control copies what it sits under, never something the
 * page has not printed.
 *
 * THE ACTIONS ARE ONE ROW OF TWO, WITH ONE LINK UNDER IT. Share wears the fill, because
 * handing the code over is what this page is FOR and the screen gets exactly one filled
 * control (`npm run check:filled` declares it). Claim is the outlined secondary beside
 * it: the same job with a figure added. Download QR moved UNDER that row, because saving
 * the code is the one action here that hands nothing to anyone — and three controls of
 * equal height in one line gave the eye three answers to the same question.
 */
export function ReceiveHalf({ plate, name, share, download, claim }: ReceiveHalfProps) {
  const copyState = useCopyLink(name.copy?.value ?? '');
  const shareLink = useShareLink(share?.title ?? '', share?.url ?? '');
  const copied = copyState.state === 'copied';

  const glyph = name.copy ? (
    <IconButton
      name={copied ? 'check' : 'copy'}
      tone={copied ? 'confirmed' : 'default'}
      well="none"
      label={name.copy.label}
      onClick={copyState.copy}
      className="shrink-0"
    />
  ) : null;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {plate}

      {/* THE ROW IS THREE UNBREAKABLE SLOTS, not one text flow and not four equal flex items.
          A flex row of label, value, handle and glyph pushed the 44px glyph onto a line of its
          own under the merchant half at 390px; one inline text flow broke the BUSINESS NAME
          instead (`Merchant name: Java` / `House @javahouse`). So the label is its own slot,
          the value is its own slot, and the handle travels welded to the glyph it belongs to.
          Flex-wrap then breaks between SLOTS: at 390px the merchant row reads
          `Merchant name: Java House` / `@javahouse <glyph>`, and a name too long for the line
          moves whole rather than splitting mid-word. */}
      <p className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
        <Text variant="body" as="span" color="secondary" className="whitespace-nowrap">
          {name.label}:
        </Text>
        {name.handle ? (
          <>
            <Text variant="body-medium" as="span" className="min-w-0 break-words">
              {name.value}
            </Text>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Text variant="body" as="span" color="secondary">
                @{name.handle}
              </Text>
              {glyph}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Text variant="body-medium" as="span">
              {name.value}
            </Text>
            {glyph}
          </span>
        )}
      </p>

      {share || claim ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {share ? (
            <Button variant="primary" onClick={shareLink.share}>
              {shareLabel(shareLink.state)}
            </Button>
          ) : null}
          {claim}
        </div>
      ) : null}

      {download ? <div className="flex flex-col items-center">{download}</div> : null}

      {copyState.state === 'failed' ? (
        <Text variant="micro" as="p" color="alert">
          {name.copy?.failed}
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
        {copied ? name.copy?.confirmed ?? '' : ''}
      </Text>
    </div>
  );
}
