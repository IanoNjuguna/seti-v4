import { cn } from '@/lib/cn';
import type { MarketingPriceListProps } from './MarketingPriceList.types';

/**
 * The price, printed the way the landing's fee band prints it: a `dl` of hairline rows, the
 * figure left and one sentence right, `minmax(0,1fr) 22rem` from `sm` up.
 *
 * IT IS THE LANDING'S MEASURED PAIR, NOT A NEW LAYOUT. `FeesSection` fixed its detail column
 * at 22rem because its details are the long strings and a column that gave width away
 * wrapped them into the label's baseline; its widest label renders 236px, so the label
 * column has slack. Two of these three labels are that band's own rows and the third is
 * shorter, so the same pair is what makes the price read as the same object on `/` and on
 * `/pricing` instead of as a second, differently-shaped price list.
 *
 * `onDark` IS A CANVAS, NOT A MOOD. On `/pricing` the list sits in the masthead, on the black
 * canvas, where `text-ink` would be unreadable and `hairline-light` invisible; the prop swaps
 * both for the dark pair. It is `SectionHeader`'s own `onDark` idea, kept to the one
 * component that needs it.
 */
export function MarketingPriceList({ rows, onDark = false }: MarketingPriceListProps) {
  return (
    <dl>
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            'border-t py-6 first:border-t-0 first:pt-0',
            'sm:grid sm:grid-cols-[minmax(0,1fr)_22rem] sm:items-baseline sm:gap-10',
            onDark ? 'border-hairline-dark' : 'border-hairline-light'
          )}
        >
          <dt
            className={cn(
              'font-brand text-heading-md font-medium',
              onDark ? 'text-on-dark' : 'text-ink'
            )}
          >
            {row.label}
          </dt>
          <dd
            className={cn(
              'mt-2 text-body-sm sm:mt-0 sm:text-right',
              onDark ? 'text-on-dark-mute' : 'text-mute'
            )}
          >
            {row.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}
