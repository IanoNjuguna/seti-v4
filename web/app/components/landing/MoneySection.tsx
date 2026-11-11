import { Band } from './Band';
import { SectionHeader } from './SectionHeader';
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
 * The marker is the band's heading now (#288): the display heading ("Paid to you, held by
 * you.") was deleted for restating what the marker and the squares already said, and the
 * marker carries the h2 so the band keeps a heading in the outline.
 *
 * TRUE #000, deliberately. The field's lift belongs to the HERO band alone, so
 * this band paints `canvas-dark` and lets the hero stay the one lit band. That is
 * the page's rhythm: one glowing band at the top, then flat black and white
 * stripes under it.
 */
export function MoneySection() {
  return (
    <Band id="money" className="bg-canvas-dark pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow="Your money" onDark />

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
