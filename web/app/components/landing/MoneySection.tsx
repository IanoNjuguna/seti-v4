import { Reveal } from './Reveal';
import { SectionHeader } from './SectionHeader';
import { MoneyCard } from './MoneyCard';
import { MONEY_COPY } from './MoneySection.constants';

/**
 * Your money — the first dark band after the hero, and the only place the page
 * explains what a balance is FOR.
 *
 * IT IS NOW FOUR SQUARES. The band used to be prose on the left and two hairline
 * rows on the right; it is four objects on a 4-up grid now, which is cash.app's
 * card-grid band and the one section shape this page did not carry. The grid is
 * `grid-cols-1` / `sm:grid-cols-2` / `lg:grid-cols-4` with 20px between columns,
 * which is the reference's own gap, and every tile carries the same height from `sm`
 * up (see `MoneyCard` for why a square would be mostly empty here).
 *
 * NO PROSE COLUMN AND NO LEDE. The owner deleted this band's intro paragraph
 * ("Your money is digital dollars. Each one is worth a US dollar.") and then the
 * lede under the heading, both as glosses on a page whose reader already knows
 * what money is. Nothing here puts either back: the heading and the four squares
 * are the whole band, and `SectionHeader` renders no paragraph when it is handed
 * none.
 *
 * The heading is the band's own sentence, and the four squares are what a merchant
 * does with a balance. There were two sets of squares while the page had two readings;
 * the merchant's four are what it says now.
 *
 * TRUE #000, deliberately. The field's lift belongs to the HERO band alone, so
 * this band paints `canvas-dark` and lets the hero stay the one lit band. That is
 * the page's rhythm: one glowing band at the top, then flat black and white
 * stripes under it.
 */
export function MoneySection() {
  return (
    <Reveal id="money" className="bg-canvas-dark py-[var(--band-pad-block)]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow="Your money" title={MONEY_COPY.title} onDark />

        <ul className="mt-12 grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {MONEY_COPY.tiles.map((tile) => (
            <MoneyCard key={tile.label} tile={tile} />
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
