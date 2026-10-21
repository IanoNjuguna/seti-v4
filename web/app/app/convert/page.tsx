'use client';

import { ConvertScreen } from '@/components/convert/ConvertScreen';

/**
 * Convert — `/app/convert`.
 *
 * One screen, by the owner's call: the pair, the amount, what arrives, and the
 * button that signs. There is no review step, so the button IS the confirmation —
 * which is why the floor under it says "at least", and why the amount that gets
 * signed is re-quoted the moment it is pressed rather than trusted from a figure
 * that has been on screen for a while.
 *
 * No query is read here, so there is no `Suspense` boundary and no loading
 * fallback: the route renders the screen, and the screen decides between the flow
 * and the sign-in prompt once the session answers.
 */
export default function ConvertPage() {
  return <ConvertScreen />;
}
