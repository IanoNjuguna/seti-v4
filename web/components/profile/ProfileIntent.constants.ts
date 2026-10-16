import type { HandleKind } from '@/lib/api';

/**
 * Where a person goes to claim the name for a HANDLE KIND.
 *
 * One surface (`/app/merchant`) claims both — the kind selects the copy and the
 * purpose signed — so this is a link builder, not a second route. `?kind=person` is
 * what lets a business-first account still claim a username: without it the intent
 * switch would only work one way, which is the one-way door the feature forbids.
 */
export function claimHref(kind: HandleKind): string {
  return kind === 'person' ? '/app/merchant?kind=person' : '/app/merchant';
}

export const PROFILE_INTENT_COPY = {
  title: 'How you use Seti',
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
