import Link from 'next/link';
import { Text } from '@/components/ui';
import { EmptyActivity } from './EmptyActivity';
import { HomeActivity } from './HomeActivity';
import { HOME_PAGE_COPY } from './HomePage.constants';
import type { HomeActivitySectionProps } from './HomeActivitySection.types';

/**
 * Home's recent-activity section: the page's heading, then rows or the sentence
 * that stands in for them.
 *
 * The words and the heading link are the PAGE's (`HOME_PAGE_COPY`) — the list
 * carries objects and the page names them, the same split `/app/receive` makes
 * between `RECEIVE_PAGE_COPY` and its halves. "See all" appears only when there
 * is something to see: it is a link to a longer list, and offering it over an
 * empty one is a door onto a screen with nothing behind it.
 *
 * The section is never a card: with rows it is a page-level list separated by
 * hairlines (`HomeActivity` — a card around rows would be a box around a box,
 * since the rows draw their own edge), and with none it is one sentence on the
 * canvas (`EmptyActivity`), because an empty state has no object to plate.
 *
 * "See all" is a 20px line of 14px text, so it carries its own tap target (Apple
 * §10 Gestures: ~10px of hit padding around the target) instead of taking one from
 * its row. The `after:` box is absolutely positioned, and that is the only way here
 * that does not move the heading: on an `items-baseline` row, `min-touch` on the
 * link grows the row from 28px to 44px and drops the heading with it, and a
 * negative margin on the same item makes it worse, not better — flexbox measures
 * the item's baseline offset from its MARGIN box, so `-my-3` adds to the row's
 * height rather than cancelling. The pseudo-element is invisible, spans the link's
 * own width and gives it 44px of height, so the heading stays where it was and a
 * thumb still gets the target the system's `min-touch` promises elsewhere.
 */
export function HomeActivitySection({ transactions }: HomeActivitySectionProps) {
  return (
    <section aria-label={HOME_PAGE_COPY.activityTitle} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <Text variant="section" as="h2">
          {HOME_PAGE_COPY.activityTitle}
        </Text>
        {transactions.length > 0 ? (
          <Link
            href="/app/activity"
            className="relative rounded-sm text-body-sm font-semibold text-primary after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {HOME_PAGE_COPY.activitySeeAll}
          </Link>
        ) : null}
      </div>

      {transactions.length === 0 ? (
        <EmptyActivity />
      ) : (
        <HomeActivity transactions={transactions} />
      )}
    </section>
  );
}
