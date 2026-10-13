import Link from 'next/link';
import { Card, Text } from '@/components/ui';

/**
 * The one 404 behind every refused shared receipt.
 *
 * Deliberately identical for an unknown id, a missing token, a forged token and
 * an expired one: the backend makes those indistinguishable on purpose, and the
 * page must not undo that by saying which it was. So it says the only thing that
 * is true and useful — this link does not open a receipt — and offers the app.
 *
 * Same plain public shell as the page it stands in for: no session, no app chrome.
 * It is `noindex` for the same reason the page is: a dead capability link must not
 * become a search result.
 */
export default function SharedReceiptNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas-light px-5 py-10">
      <div className="w-full max-w-md">
        <Card className="space-y-3">
          <Text variant="section" as="h1">
            No receipt here
          </Text>
          <Text variant="body" color="secondary" as="p">
            This link does not open a receipt. It may have expired, or the code may have been
            mistyped. Ask the person who sent it for a fresh one.
          </Text>
          <Link
            href="/app"
            className="inline-flex rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Go to Seti
          </Link>
        </Card>
      </div>
    </main>
  );
}
