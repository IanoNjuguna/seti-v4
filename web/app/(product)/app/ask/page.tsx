import { AskScreen } from '@/components/ask/AskScreen';

/**
 * Ask for money — `/app/ask` (#465).
 *
 * A link with an amount in it, paid by any Seti account. The screen decides between the sign-in
 * prompt, the form and the finished link once the session answers, so there is no query to read and
 * no `Suspense` boundary here.
 */
export default function AskPage() {
  return <AskScreen />;
}
