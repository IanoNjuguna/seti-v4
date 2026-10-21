import { Text } from '@/components/ui';
import { ActivityDay } from './ActivityDay';
import type { ActivityBandProps } from './Activity.types';

/**
 * One band, and the day groups inside it.
 *
 * The hierarchy is two steps, not one: a band is the coarse question a customer
 * actually asks a ledger ("what is waiting on me?", "what did this month cost?"),
 * and the day is the fine one underneath it. `section` (20px, brand face) answers
 * the first, `micro` (14px) answers the second, so the eye lands on the band before
 * it reads a single row — which is the whole reason this exists, since flat day
 * headings gave every row equal weight.
 *
 * The band is a real `<section>` with an accessible name, and the days inside it are
 * sections too, so the list is a navigable tree: band, then day, then row. That is
 * also why the day headings drop to `h3` — a heading level that skips from `h2` to
 * `h4` reads as a structure bug to a screen reader, and a day is genuinely a level
 * below its band.
 *
 * `gap-4` between days is tighter than the `gap-6` the bands take from each other:
 * the spacing says which grouping is the coarser one, and a uniform gap would make
 * every day look like the start of a new section of the ledger.
 */
export function ActivityBand({ band, onSelect }: ActivityBandProps) {
  return (
    <section aria-label={band.label} className="flex flex-col gap-4">
      <Text variant="section" as="h2">
        {band.label}
      </Text>

      <div className="flex flex-col gap-4">
        {band.days.map((day) => (
          <ActivityDay key={day.key} group={day} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
