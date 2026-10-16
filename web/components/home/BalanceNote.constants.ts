/**
 * Copy for the balance card when there is no account behind it.
 *
 * The LABEL is the same two words the real card uses ("Available balance") on
 * purpose: a visitor is being shown the shape of the product, so the card they
 * see has to be the card a signed-in customer sees, with a sentence where the
 * figure would be. The sentence itself is the app's shared one
 * (`NO_ACCOUNT_COPY`), so this card cannot drift into a second voice for the
 * same idea.
 */
export const BALANCE_NOTE_COPY = {
  label: 'Available balance',
  what: 'your balance',
} as const;
