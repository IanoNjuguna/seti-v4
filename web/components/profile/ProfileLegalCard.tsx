'use client';

import Link from 'next/link';

const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
];

/**
 * The legal links of the profile screen.
 *
 * It is the LINKS, not a card: the heading belongs to the page's legal ROW
 * (`ProfileLegalSection`, the same treatment every other row's heading gets), and the
 * wrapper that drew a white box around three links is gone. A card whose whole content
 * is three anchors is a box around the anchors.
 *
 * The list carries no margin of its own: the row it sits in owns the gap between the
 * heading and the links, so there is exactly one place that decides that spacing.
 */
export function ProfileLegalCard() {
  return (
    <ul className="flex flex-col">
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
  );
}
