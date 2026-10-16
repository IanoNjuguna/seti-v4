'use client';

import { Button } from '@/components/ui';
import { STATEMENT_COPY, STATEMENT_FORMAT_LABEL, STATEMENT_FORMATS } from './Statement.constants';
import type { StatementFormatsProps } from './Statement.types';

/**
 * The three formats, side by side and the same size: the row's content, and the
 * customer's choice to make. None of them is the "right" one, so none is louder
 * than the others.
 *
 * The one being generated shows the app's own loading button — the spinner, the
 * disabled state and `aria-busy` all come from `Button`, so a statement in flight
 * looks like every other request in this app. The other two wait their turn rather
 * than starting a second statement behind the first.
 *
 * ONE SIZE DOWN, on the app's own scale, without leaving the `secondary` recipe.
 * `Button` carries a size only inside its variants — 48px (`h-12 px-7`) for the
 * standard ones, 36px (`h-9 px-4`) for `pill` — so the step down is taken with
 * those same values here:
 *
 *   - `max-h-11` (44px) is the next height down that a caller can actually reach.
 *     `h-9` cannot: `cn()` is a join, not a merge, and the compiled sheet emits
 *     `.h-9` BEFORE the recipe's `.h-12`, so the recipe wins (`px-4` loses to
 *     `px-7` the same way). `max-height` is the one property the recipe does not
 *     set, so it is the one a caller can cap. Padding, which the recipe sets with
 *     `px-7`, is reduced with the longhands — Tailwind emits shorthand before
 *     longhand, so `pl-4 pr-4` (the pill's own 16px) is what lands.
 *   - 44px is the floor anyway: `min-touch`, already on the recipe and repeated
 *     here so the target is stated where it can be changed, holds the tappable
 *     area at 44x44. The design's next step down is 36px, and min-height wins over
 *     it, so 44 is the smallest a `secondary` button can be and still be a button
 *     you can hit.
 *
 * The result is 44px tall against the 48px it was, on 16px of side padding against
 * 28px — which is what lets the three fit one row on a 320px phone, the shrink's
 * real point.
 */
export function StatementFormats({ pending, onDownload }: StatementFormatsProps) {
  return (
    <div role="group" aria-label={STATEMENT_COPY.groupLabel} className="flex flex-wrap gap-2">
      {STATEMENT_FORMATS.map((format) => {
        const loading = pending === format;
        const waiting = pending !== null && !loading;

        return (
          <Button
            key={format}
            variant="secondary"
            className="min-touch max-h-11 pl-4 pr-4"
            loading={loading}
            disabled={waiting || undefined}
            onClick={() => onDownload(format)}
          >
            {STATEMENT_FORMAT_LABEL[format]}
          </Button>
        );
      })}
    </div>
  );
}
