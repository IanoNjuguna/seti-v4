/**
 * The three documents, as rows.
 *
 * The order is the order a person looks for them: what they agreed to, what is
 * done with their data, and what is left on their device. The hrefs are the
 * routes the site already serves (`/terms`, `/privacy`, `/cookies`), so a document
 * is one tap from the settings list and never a second copy of the legal text.
 */
export const PROFILE_LEGAL_LINKS = [
  { href: '/terms', title: 'Terms of Service' },
  { href: '/privacy', title: 'Privacy Policy' },
  { href: '/cookies', title: 'Cookie Policy' },
] as const;
