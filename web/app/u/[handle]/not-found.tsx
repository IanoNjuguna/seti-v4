import Link from 'next/link';
import { Card, Text } from '@/components/ui';

/**
 * The 404 behind an unknown `seti.live/u/<handle>`.
 *
 * Rendered by `notFound()` in the page, so the response is a real 404 rather than
 * a 200 with an empty body — a link that goes nowhere has to say so, to the
 * customer and to anything checking it. Same public shell as the page it stands
 * in for: no session, no app chrome.
 */
export default function PersonNotFound() {
  return (
    <main className="min-h-dvh bg-canvas-light text-ink">
      <div className="mx-auto w-full max-w-md px-5 py-10">
        <Card className="space-y-3">
          <Text variant="section" as="h1">
            No one here
          </Text>
          <Text variant="body" color="secondary" as="p">
            That link does not point at a Seti handle. Check the spelling, or ask for a fresh one.
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
