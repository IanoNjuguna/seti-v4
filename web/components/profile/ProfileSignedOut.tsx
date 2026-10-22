import { ButtonLink, Text } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { PROFILE_PAGE_COPY } from './ProfilePage.constants';

/**
 * Profile for a visitor with no account: ONE sentence and the way in.
 *
 * One sentence, in the place the identity block stands, not two, which is what it
 * said before ("Sign in to see which network you are on" over "Sign in to see your
 * name"), and not the settings list either. Every row on this page is a fact about
 * an account, so there is no shape to keep for someone who has none: a list of
 * empty rows would be three ways of saying "you are not signed in".
 *
 * The action is the same `SIGN_IN_PATH` the rail and the landing page use, so the
 * front door has one address. It is the primary button because, on this page, it is
 * the only thing to press.
 */
export function ProfileSignedOut() {
  return (
    <div className="flex flex-col items-start gap-5">
      <Text variant="body" as="p" color="secondary">
        {PROFILE_PAGE_COPY.signedOutLine}
      </Text>

      <ButtonLink href={SIGN_IN_PATH} variant="primary">
        {PROFILE_PAGE_COPY.signedOutAction}
      </ButtonLink>
    </div>
  );
}
