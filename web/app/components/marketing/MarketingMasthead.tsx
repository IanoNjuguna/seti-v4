import type { MarketingMastheadProps } from './MarketingMasthead.types';

/**
 * The opening band: the page's h1, one sentence, and the list that follows from them.
 *
 * THE FIRST LIST IS NOT A BAND OF ITS OWN, and that is the outline's decision rather than
 * the layout's. The dictated copy gives the three price lines on `/pricing` and the three
 * steps on `/how-it-works` no heading of their own: they are the h1's content, so a band
 * around them would need an h2 nobody wrote. They live here, under the sentence that
 * introduces them, and every band below this one has its own dictated marker as its h2.
 *
 * NO HEADING LEVEL IS OPEN TO THEM, either. Under an h1 with no h2 between, a row title at
 * h3 is a skipped level; the price rows are a `dl` and never had one, and the step titles
 * carry their weight in type rather than in the outline (`MarketingStepList` records it).
 *
 * DARK, because the bar above it is dark and the brand's opening surface is the black one
 * (`design/revolut.md`: the storytelling canvas carries the hero band). The bands under it
 * switch to white in full-bleed steps, so the page keeps the two-mode rhythm and no soft
 * transition is invented between them.
 *
 * THE h1 IS 40px ON A PHONE AND 48 FROM `sm`, one step above the band headings it parents.
 * The landing's hero runs `display-xl` because its promise is four words; these titles are a
 * full sentence, and a sentence at 80px on a 360px screen is a column of ragged fragments.
 * `text-balance` is for the phone, where the line breaks two or three times.
 */
export function MarketingMasthead({ title, lede, children }: MarketingMastheadProps) {
  return (
    <section className="relative z-10 bg-canvas-dark pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]">
      <div className="mx-auto max-w-6xl px-6">
        <h1 className="text-balance max-w-3xl font-brand text-display-md font-medium text-on-dark sm:text-display-lg">
          {title}
        </h1>

        <p className="mt-5 max-w-2xl text-body-lg text-on-dark-mute">{lede}</p>

        <div className="mt-12 md:mt-16">{children}</div>
      </div>
    </section>
  );
}
