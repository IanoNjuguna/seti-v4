import type { HowSectionCopy } from './HowSection.types';

/**
 * The mechanic, as the merchant lives it.
 *
 * THE LEDE NAMES THE CATEGORY AND THE AUDIENCE (#276). It used to restate the hero's
 * own sentence — "Your name is what customers type. Your code is the same name, printed
 * for the counter" — which told a visitor who already understood the product what they
 * had just read. A visitor arriving from a shared link does not know what Seti is or
 * whether it is for them, and nothing else on the page says so: the hero is a promise
 * and a code, and the bands below are mechanics. So the first line of the first
 * explanatory band says what this is, who it is for, and how they pay, in one breath.
 *
 * THE COPY IS THE BUSINESS VARIANT'S, unchanged. It was one of two blocks — the other
 * was a person's — chosen by the navbar's Personal | Business control. That control is
 * gone (`HeroCopy.constants.ts` records why), so this band carries the reading whose
 * subject the page is: a merchant who is found by a name and a printed code.
 *
 * STEP ONE IS THE STEP THAT NAMED THE DIFFERENCE: how somebody else's money reaches
 * you. A business is found by its name and by the code it prints for the counter
 * (`seti.live/m/<name>`, which is what `components/merchant/MerchantQr.tsx` renders and
 * what the onboarding wizard tells a merchant to print), and the hero's own code above
 * this band is the same object.
 *
 * STEPS TWO AND THREE ARE THE ONES THAT WERE ALWAYS SHARED, because the mechanic under
 * them IS shared: the payer's dollars leave the payer's own balance and land in the
 * payee's, in one payment, with nobody holding them in between.
 *
 * STEP THREE NAMES THE RAIL (#278). The page said "Tempo" once, as a wordmark with an
 * "In use now" caption, and in no sentence anywhere: a reader who wants to know what the
 * settlement runs on, which is what makes a same-wallet transfer possible instead of a
 * custodial ledger entry, could not find out. It goes here and not in the hero, because
 * a shop owner reading the promise in five seconds has no frame for a chain name. Once
 * is enough: the Integrations row above carries the mark for anyone scanning for it.
 *
 * STEP THREE NO LONGER SAYS WHO HOLDS THE MONEY (#280). Adding the rail pushed the
 * paragraph to three lines, and the third held one word and a full stop — "in a queue."
 * — so the clause that pushed it over came out: "Nobody holds it in between". The cut
 * stands on its own terms: this step says what it is for, the rail the money settles on
 * and the fact that nothing queues. The alternative was a typesetting fix
 * (`text-wrap: pretty`) that leaves three lines on browsers that honour it and none of
 * the words on the browsers that do not; the copy is the thing that wanted cutting.
 *
 * WHEN THE HERO STILL CARRIED THAT SENTENCE, this note said the claim was "stated above
 * the fold where the merchant decides" and that a reader met it once, in the place that
 * matters. That is no longer where it is: the hero's proof line went (#288) and so did
 * the money band's tile (#286), so the landing page states nothing about who holds the
 * money. The step does not get it back to fill the gap — a reader who needs the claim
 * meets it on the pay page and at the Terms checkbox — and `HeroCopy.constants.ts` keeps
 * the record of what went with it.
 *
 * One line of the second step changed once and stays changed: "From their own wallet"
 * became "From their own balance". A wallet is the thing the product is not, and the
 * sentence is truer without it: what a payer spends is the balance they hold.
 */
export const HOW_COPY: HowSectionCopy = {
  lede: 'Seti is a payment app for shops and traders. Customers pay by your name, or by the code on your counter.',
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
      body: 'It settles on Tempo, into your own balance. Nothing waits in a queue.',
    },
  ],
};
