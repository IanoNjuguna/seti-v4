/**
 * The account chip's words and its two numbers (#592).
 *
 * The menu's three items are the three things the bar can do for a signed-in customer, and
 * they are named for what happens rather than for the surface: "Profile" navigates, "Copy
 * pay link" acts in place and then says so, "Sign out" ends the session.
 *
 * `HANDLE_CLIP` is a width, not decoration: the bar has three controls to fit, and a
 * 20-character handle beside an avatar and a chevron eats the bell's target at 640px.
 */
export const ACCOUNT_CHIP_COPY = {
  openLabel: 'Your account',
  menuLabel: 'Account menu',
  profile: 'Profile',
  copyPayLink: 'Copy pay link',
  copied: 'Pay link copied',
  signOut: 'Sign out',
} as const;

/** Characters of `@handle` the wide density prints before it truncates. */
export const HANDLE_CLIP = 12;

/** How long "Pay link copied" stays up before the item goes back to its own name. */
export const COPY_FEEDBACK_MS = 2000;
