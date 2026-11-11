import { Band } from './Band';
import { SETUP_COPY } from './SetupSection.constants';

/**
 * Getting started: the three moves between deciding and being paid.
 *
 * WHY IT SITS AFTER THE FEE AND BEFORE THE QUESTIONS. Everything above it answers "what
 * is this, who is it for, what does it cost"; a reader who has accepted those is asking
 * the only question left, which is what to do first. The questions band then catches the
 * objections this one raises.
 *
 * THE HEADING NAMES THE SPAN (#552). It used to be the caps marker "Getting started" promoted
 * to the `h2`, which told a reader the band was about starting and nothing else. The copy's
 * own sentence names the two ends of the sequence under it: the name you claim at the top,
 * the first payment at the bottom. Set as a heading at the page's band size, so the band
 * opens the way `how`, `who`, `customer` and `money` do rather than with the 12px label
 * every band on the page used to carry.
 *
 * ONE COLUMN, ONE HAIRLINE BETWEEN STEPS, no grid and no card. `how` above already owns the
 * numbered sequence with an object opposite it; a second band in that shape would read as a
 * second procedure. This is the same sequence as a single column of prose, at `max-w-2xl` so
 * the measure stays a paragraph rather than running the width of the band.
 *
 * LIGHT CANVAS, and it is the canvas step that separates it from `fees` above: the fee band is
 * dark, so this band needs no rule of its own. It is the first white after the four-band dark
 * run, which is why it reads as the page taking a breath before the questions.
 */
export function SetupSection() {
  return (
    <Band
      id="start"
      className="bg-canvas-light pt-[var(--band-pad-top)] pb-[var(--band-pad-bottom)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        {/* THE HEADING NAMES THE SPAN OF THE BAND (#552). "Getting started" was the marker,
            promoted to the `h2`; `SETUP_COPY.heading` says where the three steps take you: a
            claimed name at the top, the first payment at the bottom. Set at the page's band
            heading size, with no marker above it. */}
        <h2 className="max-w-2xl font-brand text-heading-lg font-medium text-balance text-ink sm:text-display-md">
          {SETUP_COPY.heading}
        </h2>

        <ol className="mt-12 max-w-2xl md:mt-16">
          {SETUP_COPY.steps.map((step) => (
            <li
              key={step.index}
              className="flex gap-6 border-t border-hairline-light py-7 first:border-t-0 first:pt-0"
            >
              <span className="font-tabular text-body-sm font-semibold text-mute">
                {step.index}
              </span>
              <div>
                <h3 className="font-brand text-heading-sm font-medium text-ink">{step.title}</h3>
                <p className="mt-2 text-body-md text-mute">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-2xl border-t border-hairline-light pt-6 text-body-md text-mute">
          {SETUP_COPY.closing}
        </p>
      </div>
    </Band>
  );
}
