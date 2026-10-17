import {
  LEGAL_EFFECTIVE_DATE,
  PRIVACY_URL,
  CONTACT_EMAIL,
  LEGAL_ENTITY,
  REGISTERED_ADDRESS,
} from "./site";
import type { LegalSection } from "./LegalDocument";

/**
 * Terms of Use, written for Seti.
 *
 * Not an adaptation of a template. Every factual claim below is one this
 * repository can be held to:
 *
 *  - The money going from the customer's own wallet straight to the payee's, and
 *    Seti never holding it: `AGENTS.md`, `README.md`, and the batch signed
 *    through Privy's `useSendTransaction` (`backend/src/services/transactions.ts`).
 *  - The 2% fee, attributed to the recipient and funded by the payer, no floor
 *    and no cap: `backend/src/config/env.ts` (`MERCHANT_FEE_PERCENT` 2,
 *    `MERCHANT_FEE_MIN_KES` 0, `MERCHANT_FEE_MAX_PERCENT` 0) and
 *    `backend/src/services/fees.ts`.
 *  - One transaction carrying both legs: `FEE_ROUTING_MODE=batch` is the
 *    default, and the batch is proved by `npm run prove:batch`.
 *  - Practice and Live as two networks on Tempo, mainnet 4217 and testnet
 *    42431, with a deployment serving one of them and saying so:
 *    `web/lib/chain/chain.assets.ts`, `web/lib/network/network.constants.ts`,
 *    `web/components/profile/ProfileNetworkSection.tsx`.
 *  - The receipt check that fails closed before a payment is recorded:
 *    `recordPayment` / `recordSend`, and `backend/src/services/payout.check.ts`.
 *  - What is recorded, including the IP on an audit row: `AuditLog` in
 *    `backend/prisma/schema.prisma`.
 *  - No self-serve account deletion in this build: there is no delete route in
 *    `backend/src/routes/` and no control in `web/app/app/`, so section 8 tells
 *    the reader to ask instead of promising a button that is not there.
 *  - No licence, registration or regulatory approval is claimed anywhere, and
 *    section 13 says so outright.
 *
 * DELIBERATELY UNSTATED, marked with a placeholder rather than invented: the
 * operating entity, its registered address, a contact address, and the law and
 * forum for a dispute. `./site.ts` holds the placeholders so they are greppable
 * and cannot drift between the documents.
 *
 * LEGAL REVIEW REQUIRED before this is treated as final.
 */

const intro = [
  "These Terms apply to the Seti app and the Seti website. You accept them by ticking the box when you sign up, and they apply from then on. If you do not accept them, do not use Seti.",
  "Seti is a payments app. You pay a person or a business in digital dollars, and the money goes from your account straight to theirs. Seti never holds your money. Section 3 and section 4 are the two worth reading before you pay anyone: how a payment works, and the 2% fee you pay on it.",
  "You must be 18 or older. We ask you to confirm that when you sign up, and we do not ask for your date of birth.",
  `What we record about you, and why, is in the Privacy Policy at ${PRIVACY_URL}.`,
];

const sections: LegalSection[] = [
  {
    title: "1. What Seti is",
    paragraphs: [
      "Seti is a payments app for paying people and businesses in digital dollars. You scan a Seti code or open a Seti link, the app shows you who is being paid and what it will cost, and you approve the payment on your own device.",
      "The money goes from your account to the other person's own wallet. Seti is not part of the transfer and does not hold your funds at any point in it.",
      "Seti is not a bank and does not take deposits. It does not owe you a balance, does not lend your money, and does not earn anything on it.",
      "There is no cash-out in this version. Nothing is converted into cash, and nothing is paid out to an account in your name, by Seti or by anyone on its behalf.",
    ],
  },
  {
    title: "2. Your account, your wallet and your name",
    paragraphs: [
      "You sign in with your email address and a one-time code we email you. Sign-in and the wallet that holds your digital dollars are provided by Privy. Seti never holds, copies or stores the keys to that wallet.",
      "Your wallet is yours. If you lose access to your email or your device, Seti cannot restore the wallet, and cannot reverse a payment you have already approved.",
      "Seti will never ask for your private key, your recovery phrase, or the code we email you. Anyone who asks is not Seti.",
      "You choose one name: a username, or a business name if you take payments as a business. The name is public. It is tied to the address that receives your money by a signature your wallet makes, and that tie is re-checked every time anyone looks the name up. Keep your sign-in to yourself: what happens under your account is yours.",
    ],
  },
  {
    title: "3. How a payment works",
    paragraphs: [
      "The app shows you who is being paid, the amount in KES, the fee, and the total that leaves your account. Nothing moves until you approve it on your device.",
      "The digital dollars go from your account to the other person's wallet. Seti does not hold them in between.",
      "Before a payment appears in your Activity, Seti checks it against the public record on Tempo. If that record does not support the payment, Seti records nothing.",
      "A payment on Tempo is final. Once it is confirmed, no one, including Seti, can cancel it, reverse it or refund it. Check the name, the amount and the total before you approve, because that is the last moment anything can change.",
    ],
  },
  {
    title: "4. The fee",
    paragraphs: [
      "Seti charges 2% of each payment. There is no monthly fee, no minimum charge and no cap.",
      "The fee is attributed to the business being paid, but you pay it. It is added to the total, so the person or business receives the full amount you sent, not that amount minus the fee. Paying a person costs the same 2%.",
      "The payment and the fee travel in one transaction, so the fee cannot be charged twice, and if the payment does not go through, no fee is charged.",
      "You see the exact fee before you approve. It is charged in the digital dollars you pay with. The KES figure beside it is a label on that charge, converted at the rate shown in the preview: the digital dollars leave your account, the KES number does not.",
      "We may change the fee. If we do, we say so in the app, and the fee shown before you approve is the fee you pay.",
    ],
  },
  {
    title: "5. Practice and Live",
    paragraphs: [
      "Seti runs on Tempo, in one of two modes, and the app says which. Live uses Tempo's main network (chain 4217), where the digital dollars are real. Practice uses a separate test network, where they are not: nothing sent there has any value, and no one can pay it out.",
      "Both modes work the same way and charge the same 2%. A payment made in Practice has no effect on Live.",
      "Do not read a figure in Practice as money you own.",
    ],
  },
  {
    title: "6. What Seti records",
    paragraphs: [
      "For each payment we record the amount, the digital dollar used, the fee, the address paid, the KES figure shown, the exchange rate and where it came from, the transaction hash, the block it settled in, and when and how it ended. Nothing is written until the payment has been checked against the public record.",
      "We record the name you claim, the address it points to, whether it is a person or a business, and the signature that claimed it.",
      "We keep a security log of the actions that matter, including signing in: what happened, when, and the IP address the request came from.",
      "Our servers also keep request logs, which include IP addresses. We use them to run and to secure the service.",
    ],
  },
  {
    title: "7. What is public and permanent",
    paragraphs: [
      "Tempo keeps a public record of every payment. Anyone can read the addresses, the amounts and the time of each transfer, permanently.",
      "Seti cannot delete that record, and neither can you. That is how the network works, not a choice Seti makes.",
      "The name you claim is public as well: anyone with the link can see the name and the address it pays to.",
    ],
  },
  {
    title: "8. Ending your account",
    paragraphs: [
      `You can ask us to close your account. There is no close button in the app in this version: write to ${CONTACT_EMAIL} from the email address on the account, and we will close it.`,
      "Closing removes the account details we are not required to keep. It does not remove payment records we must keep for accounting and for disputes, and it cannot remove anything already written to Tempo's public record.",
      "We may suspend or end your access if you break these Terms, if the law requires it, or if your account is being used in a way that puts other people or the service at risk. Where we can, we tell you why.",
    ],
  },
  {
    title: "9. Rules of use",
    paragraphs: [
      "Use Seti lawfully. Do not use it to defraud anyone, to launder money, to move the proceeds of a crime, or to get around sanctions. Do not attack, overload or disrupt the service, or interfere with anyone else's use of it.",
      "A Seti code carries an address, not a promise. Seti reads the address out of the code and cannot tell you who wrote it. Treat an unfamiliar request for money the way you would treat any other.",
    ],
  },
  {
    title: "10. The services behind Seti",
    paragraphs: [
      "Seti runs on other people's services: Privy for sign-in and the wallet, Cloudflare for hosting the website and for reaching our API, AWS for the servers, and Tempo and its node providers for the network. Seti does not control them, and their own terms apply to them.",
      "We fetch publicly available exchange rates from open.er-api.com to show a KES figure. That request carries nothing about you.",
      "Seti is the app, not the network. If Tempo is down, or a provider fails, Seti cannot step in and complete a transfer for you.",
    ],
  },
  {
    title: "11. Availability, and the limits of what Seti owes you",
    paragraphs: [
      "Seti is provided as it is and as it is available. We do not promise it will always be up, or that every figure it shows will be right at the moment you look.",
      "Because Seti never holds your money, it cannot give it back. Seti is not responsible for money lost because you lost access to your wallet or your email, because you gave your sign-in to someone else, or because you approved a payment to a name, an address or an amount you did not mean.",
      "Where the app and the public record disagree, the public record is right.",
      "Nothing here limits a responsibility that cannot lawfully be limited, including for fraud by Seti.",
    ],
  },
  {
    title: "12. Changes to these Terms",
    paragraphs: [
      "When these Terms change, we publish the new version here with a new date. If a change matters to you, we say so in the app before it takes effect. Using Seti after that means you accept the new version.",
    ],
  },
  {
    title: "13. Who operates Seti, and the law that applies",
    paragraphs: [
      "Nothing in these Terms is a claim that Seti holds a licence, a registration or an approval from any regulator, or that Seti is regulated anywhere.",
      "These Terms also do not yet name the company that operates Seti, its registered address, where to send a formal notice, or the law that would govern a dispute. Those are marked here rather than guessed at:",
    ],
    clauses: [
      `Operator: ${LEGAL_ENTITY}`,
      `Registered address: ${REGISTERED_ADDRESS}`,
      `Formal notices: ${CONTACT_EMAIL}`,
      "Governing law and the forum for a dispute: not yet published",
    ],
  },
];

const footnote =
  "These Terms describe how Seti is built: a payments app on Tempo that never holds your money. They were written from the product itself and still need a lawyer's review before they are treated as final. They are not legal advice. Where a fact about the business cannot be stated yet, section 13 marks it rather than inventing one.";

export const termsContent = {
  title: "Terms of Use",
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro,
  sections,
  footnote,
};
