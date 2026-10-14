import { Card, Skeleton } from '@/components/ui';

/**
 * Loading state shaped like the real header, so the layout does not jump when
 * the dashboard arrives (DESIGN.md §7 requires skeletons matching the layout).
 *
 * The shapes match `web/app/app/page.tsx`: the greeting line and the hero are one
 * `gap-4` unit, and the strip is two content-sized tiles rather than two
 * full-width bars — the bars predated the tiles being sized to their content, and
 * a skeleton that promises a different shape than the content has is the jump it
 * exists to prevent.
 */
export function HomeLoading() {
  return (
    <div className="flex flex-col gap-6 md:gap-8" aria-busy aria-label="Loading your account">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Card>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-10 w-48" />
          <Skeleton className="mt-4 h-6 w-32" />
        </Card>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-20 w-20" />
        <Skeleton className="h-20 w-16" />
      </div>
      <Skeleton className="h-5 w-40" />
    </div>
  );
}
