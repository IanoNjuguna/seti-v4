import { ButtonLink } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { Reveal } from './Reveal';
import { CLOSING_COPY } from './ClosingSection.constants';
import type { AudienceProps } from './Audience.types';

/**
 * The closing band: the last sentence, and the button.
 *
 * `canvas-dark` — true #000, like the band above it: the field's lift is the
 * hero's alone, and a second glowing band at the bottom of the page would make the
 * first one ordinary.
 *
 * IT IS THE REFERENCE'S SHAPE AND NOTHING MORE. cash.app closes on a large line and
 * a single pill; this band is a heading in seven columns and one action in five,
 * with the action aligned to the heading's last line (`items-end`), so the button
 * lands level with the thing the reader has just read. No mark, no stat row, no
 * column of links: there is nothing true to put in a stat row that the product can
 * back, and inventing one is the failure mode this page has been corrected for.
 *
 * THE PHOENIX IS OUT OF THIS BAND. The mark at 80-96px above the heading, the nav's
 * mark above it and the footer's below made the same bird appear three times down
 * one black page. The heading and the button are the whole band now, and the
 * footer's mark still carries the accessible name.
 *
 * The action's LABEL is the reader's (`CLOSING_COPY`); its destination is the
 * product's front door for both.
 */
export function ClosingSection({ audience }: AudienceProps) {
  const copy = CLOSING_COPY[audience];

  return (
    <Reveal id="open" className="bg-canvas-dark py-[var(--band-pad-block)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-end gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-7">
            <h2 className="max-w-lg font-brand text-heading-lg font-medium text-on-dark sm:text-display-md">
              {copy.heading}
            </h2>
          </div>

          <div className="flex flex-col gap-4 md:col-span-5 md:items-end">
            <ButtonLink href={SIGN_IN_PATH} variant="on-dark" fullWidth className="sm:w-auto">
              {copy.action}
            </ButtonLink>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
