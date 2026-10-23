import type { RefusalRow } from './RefusalsSection.types';

/**
 * The three things Seti refuses to do (#133), in the customer's words.
 *
 * ## Why a refusal is here and not a feature
 *
 * Every other band on this page says what Seti does. These three say what it does
 * not do, and each one is the answer to a question a merchant actually asks
 * before moving money onto a new rail: who is holding it, do I have to sign up,
 * and how does it get back out. Those questions are answered by an absence, so
 * they cannot be answered by a screenshot of the product working. They are the
 * trust argument, and they belong in the page, not in a PR description.
 *
 * ## Each one is checkable, and this is the code that keeps it true
 *
 * A negative claim is only worth publishing if it can be tested, so each row is
 * written as a statement a reader can verify by using the product, and
 * `npm run check:refusals --workspace web` tests it against this repository:
 *
 * 1. **`custody`** — a payment goes from the payer's wallet to the payee's own
 *    wallet, and the balance the app shows is read from the chain at the
 *    account's own wallet (`services/balance.ts` calls `getOnChainBalance`), not
 *    from a Seti ledger. The backend holds no key that can move a customer's
 *    money: `check:refusals` scans `services/` and `routes/` for a signing
 *    client and fails if one appears. Settlement (`services/settlement.ts`) plans
 *    a swap and the customer's own wallet signs it.
 * 2. **`account`** — the charge API (`routes/public-charges.ts`) carries no
 *    session guard: the payee's wallet signs the charge and that signature is the
 *    credential, so a link and a wallet address are enough to be paid. The check
 *    fails if an auth guard is ever put in front of that route.
 * 3. **`fiat`** — there is no card and no bank rail in v1: no Stripe or Bridge
 *    call site (`config/env.ts` declares the two keys and nothing reads them),
 *    and the off-ramp audit actions exist in the taxonomy with nothing writing
 *    them. The integrations band above says the same thing in pictures, marking
 *    both fiat marks "Not in use yet".
 *
 * ## What must NOT happen here
 *
 * If a card rail, a bank payout, an escrow or an auth guard on receiving lands,
 * these sentences become false and the check goes red. That is the point: the
 * copy and the code are the same claim, and the day they disagree the build says
 * so rather than a customer finding out.
 *
 * ## Voice, as the page speaks it
 *
 * Second person, plain, no em dash, no exclamation, no jargon. No stablecoin
 * names (`check:asset-words`): the page calls the money dollars everywhere else
 * and this band does not break that. No "gas": the money that leaves is a
 * platform fee, and none of these three rows needs to mention it.
 */
export const REFUSALS_EYEBROW = 'What we refuse';

/**
 * The band's heading, and it COUNTS the rows. "Three" and `REFUSAL_ROWS.length`
 * are one claim: the check fails if a row is added or removed without the
 * heading moving with it, so the band cannot say three and show two.
 */
export const REFUSALS_HEADING = 'Three things Seti does not do.';

export const REFUSAL_ROWS: RefusalRow[] = [
  {
    id: 'custody',
    label: 'Seti never holds your money.',
    detail:
      'A payment goes from the payer’s wallet straight to yours, and the balance you see is your own wallet’s balance.',
  },
  {
    id: 'account',
    label: 'You do not need an account to get paid.',
    detail:
      'A link with your wallet address is enough, and your wallet signs it. That signature is the whole account.',
  },
  {
    id: 'fiat',
    label: 'No cards, no bank transfer.',
    detail:
      'You cannot add money with a card, and nothing pays out to a bank account. Money comes in from a wallet, and it goes back out to a wallet.',
  },
];
