'use client';

import Link from 'next/link';
import { Card, Text } from '@/components/ui';

const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
];

/** The legal links block of the profile screen. */
export function ProfileLegalCard() {
  return (
    <Card>
      <Text variant="card-title" as="h2">
        Legal
      </Text>
      <ul className="mt-3 flex flex-col">
        {LEGAL_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-sm py-2 text-body-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
