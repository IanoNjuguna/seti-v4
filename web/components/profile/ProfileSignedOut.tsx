import { ButtonLink, Text } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { PROFILE_PAGE_COPY } from './ProfilePage.constants';

/**
 * Profile for a visitor with no account: the page's name, ONE sentence and the way in.
 *
 * One sentence, in the place the identity block stands, not two, which is what it
 * said before ("Sign in to see which network you are on" over "Sign in to see your
 * name"), and not the settings list either. Every row on this page is a fact about
 * an account, so there is no shape to keep for someone who has none: a list of
 * empty rows would be three ways of saying "you are not signed in".
 *
 * The h1 is the exception, and it is a fix rather than decoration (#562). Signed in, the
 * person IS the heading — `ProfileIdentity` draws it — so the route needs no title. Signed
 * out there is no person, and the page shipped a heading-less document: one sentence, a
 * button, and no `h1` at all, where Activity's visitor state has opened with "Activity"
 * since it was written. `title` in `PROFILE_PAGE_COPY` exists for exactly this state.
 *
 * There is no back control here, and that is not the same bug: Profile is a destination in
 * the dock, and a tab does not have a way back to itself.
 *
 * The action is the same `SIGN_IN_PATH` the rail and the landing page use, so the
 * front door has one address. It is the primary button because, on this page, it is
 * the only thing to press.
 */
export function ProfileSignedOut() {
  return (
    <div className="flex flex-col items-start gap-5">
      <Text variant="section" as="h1">
        {PROFILE_PAGE_COPY.title}
      </Text>

      <Text variant="body" as="p" color="secondary">
        {PROFILE_PAGE_COPY.signedOutLine}
      </Text>

      <ButtonLink href={SIGN_IN_PATH} variant="primary">
        {PROFILE_PAGE_COPY.signedOutAction}
      </ButtonLink>
    </div>
  );
}
