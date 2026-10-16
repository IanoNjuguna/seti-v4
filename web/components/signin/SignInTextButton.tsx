import { SIGN_IN_LINK_BUSY_CLASSES, SIGN_IN_LINK_CLASSES } from './SignInScreen.constants';
import type { SignInTextButtonProps } from './SignInScreen.types';

/**
 * A secondary action, drawn as a link rather than a button.
 *
 * Two classes, chosen in JS rather than joined: `cn()` concatenates, so a
 * `text-on-dark` and a `text-on-dark-mute` on one element would leave the winner
 * to Tailwind's emission order instead of to the code. Here the state picks ONE
 * string.
 *
 * It is a real `<button>`, so it is reachable by Tab and fires on Enter and Space
 * like the actions around it; `disabled` is only ever set while the action it
 * names is already in flight, and the copy that goes with it says so.
 *
 * Its press is answered on pointer-DOWN by the underline tucking in and the label
 * dimming (`SIGN_IN_LINK_CLASSES`), which is the one state a text control has to
 * carry itself: a link with hover and nothing else gives a touch user no feedback
 * at all until the action fires.
 */
export function SignInTextButton({
  children,
  onClick,
  disabled = false,
}: SignInTextButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={disabled ? SIGN_IN_LINK_BUSY_CLASSES : SIGN_IN_LINK_CLASSES}
    >
      {children}
    </button>
  );
}
