import { Reveal } from './Reveal';
import { SectionEyebrow } from './SectionEyebrow';
import { MONEY_ROWS } from './MoneySection.constants';

/**
 * Your money — the dark band, and the only place the page explains the money
 * itself. No gloss of what the dollars are any more: the "Your money is digital
 * dollars. Each one is worth a US dollar." line was deleted by the owner, and the
 * band's intro lede went the same way, so the band is now the eyebrow, the h2 and
 * the list. It explains where money can GO and never says what money here IS.
 *
 * Seven/five the other way round from the band above: prose on the left, a
 * hairline list on the right and no card, so the two light bands do not read as
 * the same layout twice.
 *
 * `md:items-center`, not the grid default. With the lede gone the prose column is
 * the shorter of the two, and under the default `stretch` its content would sit at
 * the top of the tall column and pool the empty space at the bottom — a void the
 * eye reads as the section running on. Centring the shorter column splits that
 * space above and below it, so the band reads as one block.
 *
 * TRUE #000, deliberately. The field's lift belongs to the HERO band alone —
 * this band used to have no background of its own and let the drifting field
 * show through it too, which made the field a texture rather than a signature.
 * Painting `canvas-dark` here (and in the closing band and the footer) returns
 * every other black to flat black and leaves the hero as the one lit band. That
 * is the page's rhythm: one glowing band at the top, then flat black and white
 * stripes under it.
 */
export function MoneySection() {
  return (
    <Reveal id="money" className="bg-canvas-dark py-[var(--band-pad-block)]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 md:grid-cols-12 md:items-center md:gap-16">
          <div className="md:col-span-7">
            <SectionEyebrow label="Your money" onDark />
            <h2 className="mt-6 max-w-xl font-brand text-heading-lg font-medium text-on-dark sm:text-display-md">
              Spend it, or send it.
            </h2>
          </div>

          <dl className="md:col-span-5 md:pt-2">
            {MONEY_ROWS.map((row) => (
              <div
                key={row.label}
                className="border-t border-hairline-dark py-6 first:border-t-0 first:pt-0"
              >
                <dt className="font-brand text-heading-sm font-medium text-on-dark">{row.label}</dt>
                <dd className="mt-2 text-body-md text-on-dark-mute">{row.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Reveal>
  );
}
