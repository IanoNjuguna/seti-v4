import type { ByAudience } from './Audience.types';
import type { HowSectionCopy } from './HowSection.types';

/**
 * The mechanic, one block per reader.
 *
 * STEP ONE IS THE ONLY STEP THAT DIFFERS, and it is the whole point of the
 * selector: how somebody else's money reaches you is a different sentence for a
 * person than for a business. A person is found by a username and by a link at
 * `seti.live/u/<name>`; a business by its name and by the code it prints for the
 * counter (`seti.live/m/<name>`, which is what `components/merchant/MerchantQr.tsx`
 * renders and what the onboarding wizard tells a merchant to print).
 *
 * STEPS TWO AND THREE ARE SHARED, because the mechanic under them IS shared: the
 * payer's dollars leave the payer's own balance and land in the payee's, in one
 * payment, with nobody holding them in between. Writing two versions of a true
 * sentence would be two chances to drift.
 *
 * THE BUSINESS STEP ONE IS THE OWNER'S OWN STRING, kept word for word from before
 * this change. The personal one is new, and it names the link because a person's
 * shareable link is the one thing a merchant's counter code does not have.
 *
 * One line of the second step DID change for both: "From their own wallet" became
 * "From their own balance". A wallet is the thing the product is not, and the
 * sentence is truer without it: what a payer spends is the balance they hold.
 */
export const HOW_COPY: ByAudience<HowSectionCopy> = {
  personal: {
    title: 'How people pay you.',
    lede: 'Your username is what they type. Your link is the same name, ready to share.',
    steps: [
      {
        index: '1',
        title: 'They choose how to pay you.',
        body: 'Your username, or your link at seti.live/u/<your name>.',
      },
      {
        index: '2',
        title: 'They pay in dollars.',
        body: 'From their own balance, in one go.',
      },
      {
        index: '3',
        title: 'It lands in your balance.',
        body: 'Nobody holds your money in between, and nothing waits in a queue.',
      },
    ],
  },

  business: {
    title: 'How people pay you.',
    lede: 'Your name is what customers type. Your code is the same name, printed for the counter.',
    steps: [
      {
        index: '1',
        title: 'They choose how to pay you.',
        body: 'Your code on the counter, your name, or a link you send them.',
      },
      {
        index: '2',
        title: 'They pay in dollars.',
        body: 'From their own balance, in one go.',
      },
      {
        index: '3',
        title: 'It lands in your balance.',
        body: 'Nobody holds your money in between, and nothing waits in a queue.',
      },
    ],
  },
};
