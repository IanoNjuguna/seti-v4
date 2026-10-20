/**
 * Copy and id wiring for the sign-up terms checkbox.
 *
 * The label is written for Seti and says the two things the customer is agreeing
 * to: the age statement, and Seti's own Terms of Use. It avoids "the Company"
 * and template language, and it names the non-custodial point, which is the one
 * fact about Seti a customer should not be able to miss.
 *
 * The ids are fixed strings rather than `useId()` values so the relationship
 * between the input, its label and its hint is greppable in the DOM and in a
 * browser test.
 */

export const TERMS_CHECKBOX_ID = 'terms-acceptance';

/** Describes the disabled state, and is only rendered while it is disabled. */
export const TERMS_CHECKBOX_HINT_ID = `${TERMS_CHECKBOX_ID}-hint`;

export const TERMS_LABEL_PREFIX = 'I am 18 or over, and I accept Seti’s';

export const TERMS_LINK_LABEL = 'Terms of Use';

export const TERMS_LABEL_SUFFIX = ', and I understand that Seti never holds my money.';

/**
 * The drawn box, and the indent its hint inherits from it.
 *
 * 24px, because the statement beside it is 14px and the box should read as the size of
 * the line, not as a button — and because 24 is the smallest square the system's own
 * `rounded-sm` (8px) does not turn into a circle: at 20px the corner radius is half the
 * side and an empty box reads as a radio. `TERMS_BOX_INDENT` is the box plus the row's
 * `gap-3` (24 + 12 = 36 = `pl-9`), so the hint starts on the statement's own edge
 * instead of the column's — both numbers are computed here rather than hand-picked, so
 * changing the box cannot leave the hint behind.
 */
export const TERMS_CHECKBOX_SIZE = 'h-6 w-6';

/** See `TERMS_CHECKBOX_SIZE`: box (24) + row gap (12). */
export const TERMS_BOX_INDENT = 'pl-9';

/**
 * Shown, and only shown, while the box is unticked. It names the cause of the
 * blocked button and the fix, rather than leaving a dead control unexplained.
 */
export const TERMS_BLOCKED_HINT = 'Accept the Terms of Use to continue.';

/**
 * The control's token classes, per canvas — the same recipe as `Input`'s two tones.
 *
 * On the dark canvas the link steps up to `on-dark` at full contrast with the
 * underline carrying the affordance (`design/revolut.md`: inline links on the dark
 * canvas do not use the cobalt accent, which has no contrast there), and the focus
 * ring offsets to the black canvas so the ring is not drawn in the wrong colour.
 */
export const TERMS_TONE_CLASSES = {
  light: {
    label: 'text-mute',
    link: 'font-semibold text-link underline underline-offset-4 transition-colors hover:text-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light',
    hint: 'text-caption text-stone',
    box: 'border-mute',
    tick: 'text-on-dark',
    focusRing: 'focus-visible:ring-offset-canvas-light',
  },
  dark: {
    label: 'text-on-dark-mute',
    link: 'font-semibold text-on-dark underline underline-offset-4 transition-colors hover:text-on-dark-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark',
    hint: 'text-caption text-on-dark-mute',
    /* The empty box's own edge: `on-dark-mute` (0.72 white) because a 12% hairline on
       black is an invisible control, and full `on-dark` reads as a filled selected box
       at 20px. An empty control has to look empty AND findable. */
    box: 'border-on-dark-mute',
    tick: 'text-on-dark',
    focusRing: 'focus-visible:ring-offset-canvas-dark',
  },
} as const;
