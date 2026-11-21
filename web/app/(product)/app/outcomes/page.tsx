import { OutcomesScreen } from '@/components/outcomes/OutcomesScreen';

/**
 * Outcomes — `/app/outcomes` (#597).
 *
 * The dock's third destination, and its page for now says one thing: it is not open yet. No
 * query is read and nothing is fetched, so there is no `Suspense` boundary here and no signed-in
 * branch — `AppGate` decides who may see the product shell at all, and the screen behind it is
 * identical for everyone.
 */
export default function OutcomesPage() {
  return <OutcomesScreen />;
}
