import Link from 'next/link';
import { Card, Text } from '@/components/ui';
import { PAY_COPY, PAY_LINK_CLASS } from '@/components/pay-public/PayPublic.constants';

/**
 * The 404 behind an id that names no charge.
 *
 * It says only what is true: this link does not open a payment request. It does not
 * claim the request expired (an expired request is a page with its own state, not a
 * 404) and it does not say who might have sent it — a mistyped id and a withdrawn
 * request have to read the same, or the page becomes a way to test whether a guessed id
 * exists.
 *
 * Plain shell, no session, `noindex` for the same reason the page is.
 */
export default function PayChargeNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas-light px-5 py-10">
      <div className="w-full max-w-md">
        <Card className="space-y-3">
          <Text variant="section" as="h1">
            No payment request here
          </Text>

          <Text variant="body" color="secondary" as="p">
            This link does not open a payment request. It may have been mistyped, or the
            request may have been withdrawn. Ask the person who sent it for a fresh link.
          </Text>

          <Link href="/app" className={PAY_LINK_CLASS}>
            {PAY_COPY.goToApp}
          </Link>
        </Card>
      </div>
    </main>
  );
}
