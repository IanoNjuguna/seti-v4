import { Reveal } from './Reveal';
import { SectionEyebrow } from './SectionEyebrow';
import {
  PARTNER_ENTRIES,
  PARTNER_STATE_LABELS,
  PARTNERS_EYEBROW,
} from './PartnersSection.constants';
import { cn } from '@/lib/cn';

/**
 * What Seti is built on — four marks on one row, each captioned with its state.
 *
 * The section the page carried and lost. It says the stack and, just as
 * importantly, WHICH OF IT IS LIVE: two of the four names are fiat rails that are
 * not connected, and a bare logo wall would read as four working integrations.
 *
 * THE STATE IS ON THE TILE, BECAUSE ONE ROW LEAVES THE GROUPING NOWHERE TO LIVE.
 * The four used to be split into two stacked groups — "In use now" above, "Not in
 * use yet" below a hairline — and the grouping carried the state, which is why
 * the tiles carried no label of their own. The owner asked for all four on one
 * row at laptop width, and a group split that stacks cannot also line up in a
 * row: the two headings have no column to sit over once the marks are four
 * across. So the state moved onto each mark as a caption, said per tile rather
 * than once for a group. That repeats a phrase the old arrangement said once, and
 * it is the trade this layout forces — on one row, position alone can no longer
 * keep Bridge and Stripe from reading as connected, and the distinction outranks
 * the row. A caption is the honest way to keep it. The two captions are set in
 * the one muted ink the band uses for secondary text, so the words carry the
 * distinction and nothing else does.
 *
 * THE HEADING AND THE INTRO ARE GONE. The h2 ("What Seti runs on.") and the line
 * that named what the two live names DO ("Tempo settles the payments. Privy
 * handles signing in and the wallet.") were both deleted by the owner, and
 * nothing took either one's place. The band is now the eyebrow and the row: the
 * eyebrow leads straight into the marks at the same `mt-12` step every other band
 * uses under its own eyebrow, so no gap is left where the heading was.
 *
 * TILES, NOT A MARQUEE. An auto-scrolling strip was considered and rejected: it
 * would make the one thing this section has to communicate ("two of these are not
 * in use") something a reader has to chase, four marks repeating in a loop read
 * as a placeholder rather than a stack, moving content needs reduced-motion
 * handling and a pause affordance to be accessible, and motion that carries no
 * meaning is decoration. A row grows the way the owner wants it to as the stack
 * grows, and it is still.
 *
 * NO CLAIM OF PARTNERSHIP. The section is called Integrations, not Partners: two
 * of these four have no relationship with Seti at all, and a label is a claim.
 * Only what Seti runs on is stated. Names are not links — linking out would look
 * like an endorsement nobody has given.
 *
 * FOUR ENTRIES AND BRIDGE'S OVERLAP — THE OWNER'S CALL, NOT AN OVERSIGHT. The kit
 * holds no standalone Bridge mark; its only Bridge asset is a co-branded
 * Bridge + Stripe lockup, so Bridge's tile names Stripe and Stripe keeps a tile of
 * its own. That repeat is deliberate. Two alternatives were weighed and declined:
 * merging the two into one entry that shows the lockup, which would drop a name
 * from a four-part stack, and leaving Bridge unmarked until a standalone Bridge
 * logo is sourced from Bridge's brand page rather than the kit. So do not merge
 * the entries, do not blank the tile, and do not reach outside the kit for a mark.
 *
 * ONE OPTICAL WEIGHT, NOT ONE HEIGHT. These are four assets with four aspect
 * ratios — Tempo 4.5:1, Privy 3.3:1, Stripe 2.4:1 and Bridge's lockup 2:1 — and
 * at a single shared pixel height they do NOT read alike: the wordmarks land at
 * different sizes and the two-line lockup collapses into a sliver. So each mark
 * gets the same BOX instead, sized for weight rather than height: at most 176px
 * wide and 64px tall, invisible, with the mark contained in it and centred in its
 * cell. THE WIDTH CAP IS THE FIX THE OWNER ASKED FOR. The box used to run the full
 * column — 256px at a laptop before this — so at four across a wide wordmark
 * filled its cell edge to edge and read as banner type rather than as a brand, and
 * TEMPO and privy shouted the row. Capping the width as well as the height, and
 * centring the mark, leaves the four reading as a set of similar weight. The
 * wordmarks still span the box's width and the lockup still fills its height;
 * sizing one mark at a time is how the sliver came back last time, so check the
 * four as a set. The box is fixed-height (not fitted to each mark) so the four
 * captions sit on one baseline; a box that grew with its mark would stagger them.
 *
 * BRIDGE IS THE ONE MARK A BOX CANNOT EVEN UP, AND THAT IS THE ASSET, NOT THE
 * LAYOUT. Its artwork is a two-line lockup — the Bridge name with "a stripe
 * company" under it — so inside any box that has to hold both lines its name sits
 * at roughly half the cap height of a single-line wordmark, however the box is
 * sized. It is already given the best treatment available: contained in the same
 * box as the rest, filling that box's full height. Growing the box to suit it
 * alone would make the other three heavier than they need to be, and stretching
 * it would distort the mark, which no brand asset gets. So do not special-case it.
 *
 * NO PLATE. The marks used to be drawn on a raised tile surface; the plate is
 * gone and they sit directly on the dark band. A plate turns each name into a
 * card, and a card around a logo reads as a listing — one name per card, each one
 * claimed equally, which is the opposite of what the captions are here to say.
 * The marks are the kit's own white variants, not inverted with a filter, so
 * nothing here pretends to be a light variant it is not. The section's one filter
 * is Bridge's, and it exists because that mark's artwork is an embedded bitmap
 * that a fill edit cannot whiten — the constant says which.
 */
export function PartnersSection() {
  return (
    <Reveal id="partners" className="bg-canvas-dark py-[var(--band-pad-block)]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionEyebrow label={PARTNERS_EYEBROW} onDark />

        <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {PARTNER_ENTRIES.map((entry) => (
            <li key={entry.label} className="flex flex-col items-center">
              <span className="flex h-16 w-full items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- a brand SVG, which
                    next/image cannot serve without dangerouslyAllowSVG */}
                <img
                  src={entry.mark}
                  alt={entry.label}
                  className={cn(
                    'max-h-full max-w-[176px] object-contain',
                    entry.hasEmbeddedBitmap && 'brightness-0 invert',
                  )}
                />
              </span>
              <span className="mt-4 text-caption text-on-dark-mute">
                {PARTNER_STATE_LABELS[entry.state]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
