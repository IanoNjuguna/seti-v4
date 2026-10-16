import { Text } from '@/components/ui';
import { SIGN_IN_DEV_COPY } from './SignInScreen.constants';
import { SignInTextButton } from './SignInTextButton';
import type { SignInDevPreviewProps } from './SignInScreen.types';

/**
 * The way to look at the sent screen on a local build.
 *
 * `dev` is the source a browser without `NEXT_PUBLIC_PRIVY_APP_ID` uses, and it
 * signs in on the first press without mailing anything — so on that build the sent
 * screen is otherwise unreachable, and the one screen that says what happens after
 * you press the button could not be reviewed at all. It is shown only when
 * `previewAvailable` (dev source, an address typed), so a Privy build can neither
 * render the control nor reach the state it shows.
 *
 * The same rule the page's own local-build note follows: a local build is not the
 * product path, and nothing about it should look like one.
 */
export function SignInDevPreview({ onPreviewSent }: SignInDevPreviewProps) {
  return (
    <Text variant="micro" color="inverse-muted" as="p" className="mt-6">
      {SIGN_IN_DEV_COPY.note}{' '}
      <SignInTextButton onClick={onPreviewSent}>{SIGN_IN_DEV_COPY.preview}</SignInTextButton>
    </Text>
  );
}
