"use client";

import { Button, Text } from "@/components/ui";
import { SAVE_COPY } from "./Save.constants";
import type { SaveActionsProps } from "@/hooks/useSave.types";

/**
 * The two actions, Cash App's pair: a primary `Add money` and a secondary
 * `Withdraw`.
 *
 * `Withdraw` is disabled only when there is genuinely nothing to take out — no
 * position, or a vault that cannot redeem immediately — and the line underneath says
 * which of the two it is. A dead control that explains its condition is honest; a
 * dead control that just looks broken is a bug.
 *
 * When it is enabled it opens the same amount sheet as `Add money`, mirrored: the
 * withdrawal it signs is approve-the-shares → redeem → swap home, in one transaction.
 */
export function SaveActions({
  canWithdraw,
  withdrawReason,
  onAdd,
  onWithdraw,
}: SaveActionsProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* ONE pair, side by side from 380px and stacked below it (#427).

          The threshold is the system's own number, not a taste: a button carries 28px of side
          padding each side, so "Add money" needs 153px of track, and two tracks plus the 12px
          gap need 318px of a 24px-inset page. Under 380px the pair cannot sit level at the
          documented padding, and the choice there was two uneven buttons with one label wrapped
          onto a second line, which is worse than one column.

          `grid-cols` rather than two `flex-1` children because Tailwind's tracks are
          `minmax(0, 1fr)`: exactly equal by definition, where flex sized each to its own label
          and left the pair of them a pixel apart with their outer edges unaligned. */}
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <Button type="button" fullWidth onClick={onAdd}>
          {SAVE_COPY.addAction}
        </Button>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={!canWithdraw}
          onClick={onWithdraw}
        >
          {SAVE_COPY.withdrawAction}
        </Button>
      </div>

      {!canWithdraw && withdrawReason ? (
        <Text variant="micro" color="secondary" as="p" className="text-center">
          {withdrawReason}
        </Text>
      ) : null}

      <Text variant="micro" color="secondary" as="p" className="text-center">
        {SAVE_COPY.custodyNote}
      </Text>
    </div>
  );
}
