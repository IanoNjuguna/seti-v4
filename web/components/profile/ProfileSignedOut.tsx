import { ButtonLink } from '@/components/ui';
import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { SIGN_IN_PATH } from '@/lib/routes';
import { PROFILE_INTENT_COPY } from './ProfileIntent.constants';
import { PROFILE_NETWORK_COPY } from './ProfileNetwork.constants';
import { PROFILE_PAGE_COPY } from './ProfilePage.constants';
import { ProfileLegalSection } from './ProfileLegalSection';
import { ProfileSection } from './ProfileSection';
import type { ProfileSignedOutProps } from './ProfileSignedOut.types';
import type { NoAccountWhat, NoIdentityView } from '@/components/app/no-account.types';

/** The sentence for a row with no account behind it, in the app's one voice. */
function missingLine(view: NoIdentityView, what: NoAccountWhat): string {
  return view === 'anonymous' ? NO_ACCOUNT_COPY.anonymous(what) : NO_ACCOUNT_COPY.restoring;
}

/**
 * Profile for a visitor with no account — the DEMO surface.
 *
 * The page keeps its SHAPE: the same rows as `ProfileScreen`, in the same order, with
 * one sentence in the app's own no-account voice where each fact would be
 * (`NO_ACCOUNT_COPY`, shared with Home) — never a zero, never a greyed-out control
 * implying something is arriving, never a placeholder name. Same shape, same voice,
 * same reasoning as `HomeSignedOut`.
 *
 * It used to be `SignInCard`: a full sign-in surface standing where the account's own
 * facts belong — the app's front door inside one of its rooms. The ask belongs at the
 * door, so the only control here is the one link to `/signin`, where the terms
 * control and the email and code steps live.
 *
 * That link sits where the signed-in page has its `Sign out` button — the last row on
 * the page. The shape is the same either way; only the direction of the door changes.
 */
export function ProfileSignedOut({ view }: ProfileSignedOutProps) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileSection
        title={PROFILE_NETWORK_COPY.title}
        intro={missingLine(view, 'which network you are on')}
      />

      <ProfileSection title={PROFILE_INTENT_COPY.title} intro={missingLine(view, 'your name')} />

      <ProfileLegalSection />

      <div className="border-t border-hairline-light pt-6">
        <ButtonLink href={SIGN_IN_PATH} variant="primary">
          {PROFILE_PAGE_COPY.signedOutAction}
        </ButtonLink>
      </div>
    </div>
  );
}
