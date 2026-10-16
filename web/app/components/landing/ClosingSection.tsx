import { ButtonLink } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { Reveal } from './Reveal';
import { CLOSING_CTA_LABEL, CLOSING_HEADING } from './ClosingSection.constants';

/**
 * The closing band: the last sentence, and the button.
 *
 * `canvas-dark` — true #000, like the band above it: the field's lift is the
 * hero's alone, and a second glowing band at the bottom of the page would make
 * the first one ordinary.
 *
 * THE PHOENIX IS OUT OF THIS BAND. The page's only image at size used to sit on
 * the top of this column: the mark at 80-96px above the heading, with the nav's
 * mark above it and the footer's below, so the same bird appeared three times
 * down one black page. It is removed, and nothing was put in its place. The
 * heading and the button are the whole band now, and the heading starts the
 * column rather than hanging under a mark that is no longer there, so the `mt-8`
 * that separated the two went with it. The footer's mark still carries the
 * accessible name, so no image lost its label with this one.
 *
 * The button keeps its alignment against the heading (`items-end`), so the
 * action lands level with the last thing the reader has just read.
 *
 * THE TESTNET LINE IS GONE. "Runs on Tempo testnet — no real money yet." used to
 * sit beside the button, and it was the page's last plain statement of the
 * network. Nothing on the landing says it now: the hero QR's sentence is
 * network-agnostic, this band no longer admits it, and the page's only remaining
 * money framing is "$"/"dollars" in the copy. That is a real risk on a testnet
 * deployment — a visitor is invited to open the app on copy that implies live
 * money — and it is recorded here rather than quietly accepted.
 */
export function ClosingSection() {
  return (
    <Reveal id="open" className="bg-canvas-dark py-[var(--band-pad-block)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-end gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-7">
            <h2 className="max-w-lg font-brand text-heading-lg font-medium text-on-dark sm:text-display-md">
              {CLOSING_HEADING}
            </h2>
          </div>

          <div className="flex flex-col gap-4 md:col-span-5 md:items-end">
            <ButtonLink href={SIGN_IN_PATH} variant="on-dark" fullWidth className="sm:w-auto">
              {CLOSING_CTA_LABEL}
            </ButtonLink>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
