import type { HandleKind } from '@/lib/api';

/**
 * Where a person goes to claim the name for a HANDLE KIND.
 *
 * One surface (`/app/merchant`) claims both — the kind selects the copy and the
 * purpose signed — so this is a link builder, not a second route. `?kind=person` is
 * what lets a business-first account still claim a username: without it the intent
 * switch would only work one way, which is the one-way door the feature forbids.
 *
 * Read by `useRailIdentity` for the Receive page's name half. The Profile page no
 * longer offers a claim: the gate already sends an account with no handle to
 * onboarding, so a claim panel here was a second front door on a settings page.
 */
export function claimHref(kind: HandleKind): string {
  return kind === 'person' ? '/app/merchant?kind=person' : '/app/merchant';
}

export const PROFILE_INTENT_COPY = {
  /**
   * The row's name on the settings list.
   *
   * `Mode` rather than "How you use Seti": the row sits among other rows now, and
   * a row is a name and a fact, not a sentence about itself.
   */
  title: 'Mode',
  intro: 'Switch any time. Both can live on one account.',
  switchLabel: 'Account mode',
  emptyPersonalTitle: 'No username yet',
  emptyPersonalBody: 'A username lets anyone send you money by opening seti.live/u/<name>.',
  emptyPersonalAction: 'Claim a username',
  emptyBusinessTitle: 'No business name yet',
  emptyBusinessBody:
    'A business name gives you a link you can share and a QR code you can print for customers.',
  emptyBusinessAction: 'Claim a business name',
  errorTitle: 'Could not switch',
} as const;
