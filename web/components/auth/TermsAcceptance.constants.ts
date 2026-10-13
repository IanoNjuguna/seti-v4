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
 * Shown, and only shown, while the box is unticked. It names the cause of the
 * blocked button and the fix, rather than leaving a dead control unexplained.
 */
export const TERMS_BLOCKED_HINT = 'Accept the Terms of Use to continue.';
