import type { SetupSectionCopy } from './SetupSection.types';

/**
 * What a merchant does in the first hour, in the order they do it.
 *
 * WHY THIS BAND EXISTS: the page says what Seti is, who it is for and what it costs, and
 * answered none of that for a reader who had decided and was looking for the first move.
 * A page that stops at the price leaves the reader to guess whether there is paperwork
 * behind it, and the honest answer here is that there is not: a name, a code, a customer.
 *
 * EVERY STEP IS TRUE OF THE SHIPPED PRODUCT. Claiming a name is `POST /handles/claim`
 * behind an email and a code (`/signin`), the code is the merchant QR on
 * `seti.live/m/<name>`, and the money lands in the merchant's own balance with the
 * payment in Activity. No step mentions a card, a bank account, a contract or a waiting
 * period, because none of those is part of it.
 */
export const SETUP_COPY: SetupSectionCopy = {
  eyebrow: 'Getting started',
  closing:
    'That is the whole setup: a name, a code, and a customer who already trusts you. There is no terminal to buy, nothing to install, and no monthly fee to keep paying.',
  steps: [
    {
      index: '1',
      title: 'Claim your name',
      body: 'Pick the name your customers will type and the one your code carries. Claiming it takes an email and a code, and there is nothing to install.',
    },
    {
      index: '2',
      title: 'Print the code',
      body: 'Put it on the counter where a customer already looks for the price. The code opens your payment page, so nothing needs explaining at the till.',
    },
    {
      index: '3',
      title: 'Take the first payment',
      body: 'Ask a regular to pay you by name, and watch it land. The dollars are in your balance, the payment shows in Activity, and the counter works the way it did before.',
    },
  ],
};
