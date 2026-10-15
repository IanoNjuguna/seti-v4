'use client';

import { Text } from '@/components/ui';
import type { TextColor } from '@/components/ui';
import { APP_FRAME_COPY } from './AppFrame.constants';
import { useAppNetwork } from './useAppNetwork';

export interface PracticeNoteProps {
  /**
   * Which surface the line is drawn on. The send panel prices on black and the
   * merchant step prices in a light well (`FeeQuote`, one table with a `tone`), so
   * the same sentence has to be told which half of the palette it is sitting on —
   * `Text` resolves exactly one colour role and a caller cannot fix it afterwards.
   */
  surface?: 'dark' | 'light';
}

const SURFACE_COLOR: Record<NonNullable<PracticeNoteProps['surface']>, TextColor> = {
  dark: 'inverse-muted',
  light: 'secondary',
};

/**
 * The line the money itself carries, on the screen where it is about to move.
 *
 * The chrome says which network the app is on; this says what the payment in
 * front of the customer is. It sits under the figures on the send and pay
 * screens, because that is the screenshot people actually take and the moment a
 * person decides — a strip at the top of a page is read for a day and then never
 * again.
 *
 * Renders nothing on live: real money needs no caption, and the sentence exists
 * only to stop a practice payment being mistaken for a live one.
 */
export function PracticeNote({ surface = 'light' }: PracticeNoteProps) {
  const { practice } = useAppNetwork();

  if (!practice) return null;

  return (
    <Text variant="micro" as="p" color={SURFACE_COLOR[surface]}>
      {APP_FRAME_COPY.commitNote}
    </Text>
  );
}
