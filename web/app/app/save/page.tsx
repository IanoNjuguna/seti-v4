'use client';

import { SaveScreen } from '@/components/save/SaveScreen';

/**
 * Save — `/app/save`.
 *
 * Money set aside earns what a Tempo Earn vault pays, and stays the customer's: the
 * position is shares held by their own wallet, so Seti reads it and can never take
 * it out. The page is Cash App's shape — one figure, what it earns, two actions —
 * because that is the shape people already know for "money I am not spending".
 *
 * No query is read here, so there is no `Suspense` boundary: the screen decides
 * between the flow and the sign-in prompt once the session answers.
 */
export default function SavePage() {
  return <SaveScreen />;
}
