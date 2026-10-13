'use client';

import Link from 'next/link';
import { Card, Text } from '@/components/ui';

/**
 * The way into the claim surface from the account screen.
 *
 * A link rather than a fifth tab: the tab bar mirrors the mobile app's four
 * destinations, and claiming a name is something a merchant does once, not a
 * place they live. The cobalt `link` token is the system's reserved colour for
 * links, so this reads as navigation and not as a primary action.
 */
export function ProfileClaimCard() {
  return (
    <Card>
      <Text variant="card-title" as="p">
        Business name
      </Text>
      <Text variant="micro" as="p" className="mt-1">
        Sign once to attach your business name to the wallet that receives your payments.
      </Text>
      <Link
        href="/app/merchant"
        className="mt-3 inline-flex rounded-sm text-body-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Claim a business name
      </Link>
    </Card>
  );
}
