'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import type { ActivityRowActionProps } from './Activity.types';

/**
 * The one action a row can offer: pay this person again.
 *
 * It is a button rather than a link because the row beside it is already a button
 * — the pair is two controls in one row, and a `<button>` inside a `<button>` is
 * invalid HTML that browsers silently restructure. Pressing it does not open the
 * receipt: it sits outside the row's own control, so the two cannot fire together.
 *
 * `min-touch` is here because `button-pill-sm` is 36px and the design system bumps
 * the chip to a 44px target on mobile (`design/revolut.md`, target sizes). The
 * label is the visible word plus who it pays, because "Try again" on its own does
 * not say what is being tried again out of a list of rows.
 */
export function ActivityRowAction({ href, merchant }: ActivityRowActionProps) {
  const router = useRouter();

  return (
    <Button
      variant="pill"
      className="min-touch"
      onClick={() => router.push(href)}
      aria-label={`Try again: pay ${merchant}`}
    >
      Try again
    </Button>
  );
}
