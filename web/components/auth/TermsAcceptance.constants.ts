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

/**
 * The whole sentence, as one element the input can be named by.
 *
 * The input's accessible name comes from this rather than from its `<label>`s,
 * because the sentence's two text runs are separate labels either side of the
 * `/terms` link (so both tick the box while the link stays clickable). Two labels
 * concatenate into a name that drops the link's own words, so naming by the
 * sentence is what keeps "Terms of Use" in the announced name.
 */
export const TERMS_SENTENCE_ID = `${TERMS_CHECKBOX_ID}-sentence`;

export const TERMS_LABEL_PREFIX = 'I am 18 or over, and I accept Seti’s';

export const TERMS_LINK_LABEL = 'Terms of Use';

export const TERMS_LABEL_SUFFIX = ', and I understand that Seti never holds my money.';

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
    focusRing: 'focus-visible:ring-offset-canvas-light',
  },
  dark: {
    label: 'text-on-dark-mute',
    link: 'font-semibold text-on-dark underline underline-offset-4 transition-colors hover:text-on-dark-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark',
    hint: 'text-caption text-on-dark-mute',
    focusRing: 'focus-visible:ring-offset-canvas-dark',
  },
} as const;
