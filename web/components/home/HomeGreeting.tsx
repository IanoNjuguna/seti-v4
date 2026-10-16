'use client';

import { Text } from '@/components/ui';
import { GREETING_SMILE } from './greeting.constants';
import { useGreeting } from './useGreeting';
import type { HomeGreetingProps } from './HomeGreeting.types';

/**
 * The personal line above the balance: what the time is, what to call you, and a
 * smiley. The name is the one part set in `ink` and semibold, because naming the
 * account is the point of the line — as a single muted sentence it read as a
 * whisper above the card.
 *
 * The greeting is time-derived, so it is null on the server render (see
 * `useGreeting`). `h-6` is exactly the `body-md` line box, so the reserved height
 * is the height the real line takes and the card below does not move a pixel when
 * it lands; the flex centring keeps the null box from sitting high in the gap.
 *
 * The name is the primitive's `body-medium` role (16/600) in the `primary` colour
 * role, which is exactly what the hand-spelled `font-semibold text-ink` span it
 * replaces rendered — one spelling of that emphasis, not two.
 */
export function HomeGreeting({ username }: HomeGreetingProps) {
  const greeting = useGreeting(username);

  return (
    <div className="flex h-6 items-center">
      {greeting ? (
        <Text variant="body" as="p" color="secondary">
          {greeting.timeOfDay}{' '}
          <Text variant="body-medium" as="span" color="primary">
            {greeting.name} {GREETING_SMILE}
          </Text>
        </Text>
      ) : null}
    </div>
  );
}
