import type { YourCustomerCopy } from './YourCustomerSection.types';

/**
 * The same payment, from the payer's side of the counter.
 *
 * `how` says what the merchant's money does; this band says what the person paying has
 * to have and to do. That is the one asymmetry a merchant cannot see from their own
 * side of the payment, and it is the question a shop owner asks before signing up: what
 * do I have to ask my customer for. The answer is a phone, an account, and their
 * own dollars, in that order, because that is the order the payer meets them.
 *
 * IT NAMES A SIGN-IN AND PROMISES NO MORE THAN THE PRODUCT DOES. "Signing in takes an
 * email and a code. No password, no card." is true of the shipped sign-in, and the last
 * line is the payer's own assurance: the figure is on screen before anything leaves
 * their balance. Nothing here says the payer needs a bank account, a card or an app
 * store install, because none of that is what happens.
 *
 * "A SETI ACCOUNT" IS THE NOUN THE PRODUCT USES, not "wallet" and not "profile": the
 * voice rules keep "wallet" for what a merchant's money lands in and use "sign in" for
 * the act (see `seti-voice`), and a reader who has been told to sign in should meet the
 * same word here.
 *
 * THE COPY IS THE OWNER'S, REPRODUCED.
 */
export const YOUR_CUSTOMER_COPY: YourCustomerCopy = {
  eyebrow: 'What your customer does',
  heading: 'Three taps and a code.',
  items: [
    {
      title: 'A phone',
      body: 'They pay from a phone, at the counter or from the link you send.',
    },
    {
      title: 'A Seti account',
      body: 'Signing in takes an email and a code. No password, no card.',
    },
    {
      title: 'Their own dollars',
      body: 'The money leaves their balance, so they see the figure before they confirm.',
    },
  ],
};
