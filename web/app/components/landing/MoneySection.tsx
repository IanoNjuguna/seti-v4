import { Band } from './Band';
import { MoneyCard } from './MoneyCard';
import { MONEY_COPY } from './MoneySection.constants';

/**
 * Your money — the first dark band after the hero, and the only place the page
 * explains what a balance is FOR.
 *
 * IT IS NOW THREE SQUARES (#286). It has been prose, then two hairline rows, then a
 * 4-up card grid (cash.app's band, and the one section shape this page did not
 * carry). The fourth tile was a restatement of the hero's custody claim and of the
 * heading above it, so it went and the grid is `lg:grid-cols-3` at that breakpoint:
 * three tiles in a four-column grid leave an empty cell at the right edge.
 * `grid-cols-1` / `sm:grid-cols-2` / `lg:grid-cols-3`, 20px between columns, which is
 * the reference's own gap, and every tile carries the same height from `sm` up (see
 * `MoneyCard` for why a square would be mostly empty here).
 *
 * NO PROSE COLUMN AND NO LEDE. The owner deleted this band's intro paragraph
 * ("Your money is digital dollars. Each one is worth a US dollar.") and then the
 * lede under the heading, both as glosses on a page whose reader already knows
 * what money is. Nothing here puts either back: the marker and the squares
 * are the whole band, and `SectionHeader` renders no paragraph when it is handed
 * none.
 *
 * THE BAND HAS A SENTENCE FOR A HEADING AGAIN (#552), and this time it is not the one #288
 * deleted. "Paid to you, held by you." said what the tiles said. `MONEY_COPY.heading` says what
 * the tiles have in COMMON and no tile repeats: the balance is denominated in dollars and it
 * is not converted on the way in, which is the question a seller paid from abroad arrives
 * with. It is set at the page's band size (32/40), not at display scale, because `who` above
 * is the page's one scale jump.
 *
 * TRUE #000, deliberately. The field's lift belongs to the HERO band alone, so this band
 * paints `canvas-dark` and lets the hero stay the one lit band. Since #552 it is no longer
 * "the first dark band after the hero": `who` and `customer` above it are dark too, so this
 * is the third band of a four-band dark run (who, customer, money, fees) and it carries a top
 * hairline, because a dark band under a dark band with nothing between them is one band with
 * a gap in it.
 */
export function MoneySection() {
  return (
    <Band
      id="money"
      className="border-t border-hairline-dark bg-canvas-dark pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        {/* THE HEADING IS A SENTENCE NOW (#552). It used to be the caps marker alone,
            pressed into service as the `h2` when the display heading was deleted (#288), so
            the band opened with the same 12px label as seven others. `MONEY_COPY.heading`
            states the one thing the three tiles below have in common: the balance is dollars
            and stays dollars. Same size as every other band heading on the page (32/40), so
            `who` is still the page's single scale jump. */}
        <h2 className="max-w-2xl font-brand text-heading-lg font-medium text-balance text-on-dark sm:text-display-md">
          {MONEY_COPY.heading}
        </h2>

        {/* THE ONE BAND THAT LEAVES THE COLUMN (#540). Every band on the page starts and
            ends at the same x, which is the loudest reason the page scanned as nine slides:
            nothing ever suggested the page was wider than the text. This row breaks the
            1104px content box by 64px on each side at `lg` and nothing is clipped, so the
            three tiles open out toward the viewport edges and no band after this one is the
            same width as the one before it. It is the trade `design/revolut.md` already
            sanctions for a band whose content is an object rather than a column of text:
            the row IS the band. */}
        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:-mx-16 lg:grid-cols-3">
          {MONEY_COPY.tiles.map((tile) => (
            <MoneyCard key={tile.label} tile={tile} />
          ))}
        </ul>
      </div>
    </Band>
  );
}
