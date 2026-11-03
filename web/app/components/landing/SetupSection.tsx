import { Reveal } from './Reveal';
import { SectionHeader } from './SectionHeader';
import { SETUP_COPY } from './SetupSection.constants';

/**
 * Getting started: the three moves between deciding and being paid.
 *
 * WHY IT SITS AFTER THE FEE AND BEFORE THE QUESTIONS. Everything above it answers "what
 * is this, who is it for, what does it cost"; a reader who has accepted those is asking
 * the only question left, which is what to do first. The questions band then catches the
 * objections this one raises.
 *
 * THE MARKER IS THE HEADING here, so `SectionHeader` renders it as the band's `h2` with no
 * display heading under it. That is the same trade `how` made in #288, and it is what keeps
 * this band from repeating the words above it: three numbered steps do not need a sentence
 * announcing that they are three numbered steps.
 *
 * ONE COLUMN, ONE HAIRLINE BETWEEN STEPS, no grid and no card. `how` above already owns the
 * numbered sequence with an object opposite it; a second band in that shape would read as a
 * second procedure. This is the same sequence as a single column of prose, at `max-w-2xl` so
 * the measure stays a paragraph rather than running the width of the band.
 *
 * LIGHT CANVAS with a top hairline, because the band above it (`fees`) is light too: the rule
 * separates two white bands instead of shading one.
 */
export function SetupSection() {
  return (
    <Reveal
      id="start"
      className="border-t border-hairline-light bg-canvas-light py-[var(--band-pad-block)]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader eyebrow={SETUP_COPY.eyebrow} />

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
    </Reveal>
  );
}
