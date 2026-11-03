import { cn } from '@/lib/cn';
import type { MarketingStepListProps } from './MarketingStepList.types';

/**
 * A numbered sequence in the landing's `HowSection` shape: a tabular figure, the title, one
 * sentence, a hairline between each row.
 *
 * NUMBERED BECAUSE IT IS A SEQUENCE. These three happen in order — they open your page, they
 * look, they pay — and the numeral is the only thing on the page that says so; the same three
 * sentences bulleted would read as three options.
 *
 * THE STEP TITLE IS A `p`, NOT AN h3, AND THAT IS THE OUTLINE'S RULE RATHER THAN A STYLE CALL.
 * This list sits in the masthead, under the page's h1, and the dictated copy gives the steps no
 * heading of their own. An h3 there would skip a level — h1 straight to h3 with no h2 between
 * them, which is exactly what a heading-order audit reports — and inventing an h2 to hold them
 * would be adding a heading nobody wrote to satisfy a checker. The h1 above them names the
 * sequence; the numerals order it. `MarketingRowList`'s titles stay h3s because those rows do
 * live inside a band with an h2.
 *
 * `onDark` carries the masthead's canvas: the figure drops to `on-dark-mute`, the title to
 * `on-dark`, the hairline to the dark pair. Same rows, same rhythm, inverted inks.
 */
export function MarketingStepList({ steps, onDark = false }: MarketingStepListProps) {
  return (
    <ol className="max-w-2xl">
      {steps.map((step) => (
        <li
          key={step.index}
          className={cn(
            'flex gap-6 border-t py-7 first:border-t-0 first:pt-0',
            onDark ? 'border-hairline-dark' : 'border-hairline-light'
          )}
        >
          <span
            className={cn(
              'font-tabular text-body-sm font-semibold',
              onDark ? 'text-on-dark-mute' : 'text-mute'
            )}
          >
            {step.index}
          </span>

          <div>
            <p
              className={cn(
                'font-brand text-heading-sm font-medium',
                onDark ? 'text-on-dark' : 'text-ink'
              )}
            >
              {step.title}
            </p>
            <p
              className={cn('mt-2 text-body-md', onDark ? 'text-on-dark-mute' : 'text-mute')}
            >
              {step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
