/**
 * Every word the personal-information screen renders.
 *
 * The screen exists because the profile page showed the name an account goes by as a fact
 * nobody could change (#536). What it may change is exactly one thing, and most of this file
 * is about saying which — a screen that lists four facts without saying which are writable is
 * a screen people tap at random.
 *
 * The rows follow the shape Wise and N26 use: the current VALUE is the row's own right-hand
 * fact, and the reason it is or is not editable sits under the label. Nothing here is a card.
 */
export const PERSONAL_COPY = {
  title: 'Personal information',
  /** The back control's accessible name: it lands on the profile page it came from. */
  backLabel: 'Profile',

  /** The one writable row. */
  nameLabel: 'Your name',
  nameNote: 'How you appear in Seti.',
  nameAction: 'Change',
  namePlaceholder: 'Ian Mwangi',
  /** Refused before any request, because a round trip to hear "empty" is not needed. */
  nameRequired: 'Enter the name you want to go by.',
  save: 'Save',
  cancel: 'Cancel',
  saving: 'Saving…',
  saveFailed: 'Could not save your name. Try again.',
  saved: 'Name saved.',

  /**
   * The Seti name, which is NOT editable.
   *
   * It is signed, it is what people pay this account by, and it is immutable. The row states
   * that rather than hiding the fact behind an absent control: a screen that simply shows a
   * handle with no edit looks like an oversight, and someone will ask for the button.
   */
  handleLabel: 'Seti name',
  handleNote: 'A Seti name is set once and cannot be changed.',
  handleNone: 'Not set yet',

  /** Contact facts: shown with the reason they are not edited here. */
  emailLabel: 'Email',
  emailNote: 'This is how you sign in.',
  emailNone: 'Not added',
  phoneLabel: 'Phone',
  /**
   * NO NOTE, on purpose.
   *
   * It used to say "Set by the number you sign in with", and sign-in is email only: nothing
   * sets this, so the sentence explained a mechanism that does not exist (#548). A row that
   * carries a value and no sentence is honest; a sentence describing a flow we do not have is
   * the kind of claim this product cannot make. When a number can arrive — a phone login
   * method, or a verified number for a payout leg — this row gets a note that is true.
   */
  phoneNone: 'Not added',
} as const;
