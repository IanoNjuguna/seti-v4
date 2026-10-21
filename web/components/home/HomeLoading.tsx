import { Skeleton } from '@/components/ui';

/**
 * The loading state, shaped like the screen it stands in for.
 *
 * The shapes match `HomeScreen` exactly — the greeting line and the hero are one
 * `gap-4` unit, the two actions are full-width halves, then the period row, then a
 * heading over merchant rows on the canvas. Three rules earned this file, and each
 * one still bites:
 *
 *  1. **The hero is `bg-canvas-dark`.** A white placeholder for a black card is not
 *     a resize on arrival — it is a surface flip across the largest element on the
 *     screen, which is the jump the skeleton exists to prevent.
 *  2. **The actions are the buttons that arrive.** They were icon wells for a while;
 *     two 48px halves at `gap-3` are what lands now, so the row cannot change width.
 *  3. **No card around the bottom.** The real rows draw their own hairlines on the
 *     canvas (`HomeMerchants`), so a bordered container would reserve a border and a
 *     radius the content never delivers.
 *
 * Two marks are hand-rolled spans rather than `Skeleton`s, for the two limits of
 * that primitive: it is `bg-surface-soft` only (a #f4f4f4 bar on the black hero is
 * louder than the balance it stands in for), and it bakes `rounded-md`, which a
 * caller's own radius cannot beat through `cn()`'s join.
 */
export function HomeLoading() {
  return (
    <div className="flex flex-col gap-6 md:gap-8" aria-busy aria-label="Loading your account">
      <div className="flex flex-col gap-4">
        <div className="flex h-6 items-center">
          <Skeleton className="h-4 w-40" />
        </div>

        <section className="rounded-md bg-canvas-dark p-6 sm:p-8">
          <span className="block h-4 w-24 rounded-sm bg-surface-elevated" />
          <span className="mt-2 block h-8 w-48 rounded-sm bg-surface-elevated" />
        </section>
      </div>

      <div className="flex gap-3">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 flex-1" />
      </div>

      <div className="flex flex-col gap-1 border-b border-hairline-light pb-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />

        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex h-16 items-center justify-between gap-4 border-b border-hairline-light py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
