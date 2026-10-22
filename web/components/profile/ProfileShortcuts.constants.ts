import type { ProfileShortcut } from './ProfileShortcuts.types';

/**
 * The one route onto the security screen built in #100.
 *
 * A literal here rather than a second copy in a component: it is the address a
 * support reply names, so it is written once.
 */
export const PROFILE_SECURITY_PATH = '/app/profile/security';

/**
 * The two rows between the person and the settings: the things a customer does
 * with an account that are not a settings change.
 *
 * TWO rows, and the second one is not `Invite friends`. That row is in issue #145
 * and `/app/invite` does not exist yet; every merge to `main` deploys, so a row
 * pointing at it today would ship a 404. When that route lands it joins this array
 * and nothing else changes.
 *
 * `Get paid` rather than `Receive`, and `Account safety` rather than `Security`.
 * The first is the same call `HomeActions` makes for the same destination (the
 * panel asks for the money, the page answers with the verb the customer thinks
 * in), and the second says what the screen is FOR, which is a word a person can
 * act on where "Security" is a category.
 */
export const PROFILE_SHORTCUTS: readonly ProfileShortcut[] = [
  {
    key: 'paid',
    title: 'Get paid',
    subtitle: 'Your link, or your address.',
    href: '/app/receive',
    icon: 'add',
  },
  {
    key: 'safety',
    title: 'Account safety',
    subtitle: 'How you sign in, and what protects it.',
    href: PROFILE_SECURITY_PATH,
    icon: 'shield',
  },
];
