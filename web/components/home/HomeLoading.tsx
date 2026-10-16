import { Skeleton } from '@/components/ui';

/**
 * The loading state, shaped like the screen it stands in for.
 *
 * The shapes match `web/app/app/page.tsx` exactly — the greeting line and the
 * hero are one `gap-4` unit, the strip is two content-sized tiles, and the bottom
 * is a heading over rows that stand on the canvas. Three things were wrong before
 * and each one showed up as a jump:
 *
 *  1. **The hero was a white `Card`.** The real hero is `bg-canvas-dark`, so the
 *     surface did not merely resize on arrival — it flipped from white to black
 *     across the largest element on the screen. A skeleton that promises a
 *     different surface than the content has is the jump it exists to prevent.
 *  2. **The strip promised the wrong tiles.** It drew three and sized them for
 *     labels that are not in the strip; home has two (`Receive`, `Send`), each
 *     sized to its own label, so the row changed width on arrival. A third,
 *     bordered panel used to stand in for a pay card that was deleted when Pay
 *     became a page of its own — a skeleton for a card that no longer exists
 *     reserved its whole height and collapsed when the real screen landed.
 *  3. **The activity section was a bordered container.** The real list is rows on
 *     the canvas separated by their own hairlines (`HomeActivity`), so a container
 *     drew a card the content never delivers. The screen jumped by its border and
 *     radius at the bottom.
 *
 * This is the HOME shape and nothing else. `/app/send`, `/app/receive` and
 * `/app/activity` used to render it too, which promised a balance hero and an
 * activity list on screens that have neither; each of those carries its own now.
 *
 * Two marks are hand-rolled spans rather than `Skeleton`s, for the two limits of
 * that primitive on a dark or circular placeholder — both findings against it,
 * recorded rather than worked around silently:
 *
 *  - `Skeleton` is `bg-surface-soft` only, and `cn()` is a join, so the bars
 *    inside the black hero cannot take `surface-elevated`: a #f4f4f4 bar on
 *    black is louder than the balance it stands in for.
 *  - It bakes `rounded-md`, and a caller's `rounded-full` cannot beat it (the
 *    later-emitted base utility wins), so a circular mark has to be a real span
 *    with the token — otherwise the avatar skeletons are squares and the arrival
 *    of the circles is one more jump.
 */
export function HomeLoading() {
  const tiles = [
    { label: 'w-14' },
    { label: 'w-9' },
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-8" aria-busy aria-label="Loading your account">
      <div className="flex flex-col gap-4">
        <div className="flex h-6 items-center">
          <Skeleton className="h-4 w-40" />
        </div>

        <section className="rounded-md bg-canvas-dark p-6 sm:p-8">
          <span className="block h-4 w-32 rounded-sm bg-surface-elevated" />
          <span className="mt-2 block h-8 w-48 rounded-sm bg-surface-elevated" />
          <span className="mt-1 block h-4 w-36 rounded-sm bg-surface-elevated" />
        </section>
      </div>

      <div className="flex items-center gap-4">
        {tiles.map((tile, index) => (
          <div key={index} className="flex flex-col items-center gap-2 px-2 py-1">
            <span className="block h-12 w-12 rounded-md bg-surface-soft" />
            <Skeleton className={`h-4 ${tile.label}`} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex h-16 items-center gap-3 border-b border-hairline-light px-5 last:border-b-0"
          >
            <span className="block h-10 w-10 shrink-0 rounded-full bg-surface-soft" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
