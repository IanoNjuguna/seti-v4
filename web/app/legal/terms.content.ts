import { LEGAL_EFFECTIVE_DATE, PRIVACY_URL } from "./site";
import type { LegalSection } from "./LegalDocument";

/**
 * Terms of Use, written for Seti.
 *
 * These are NOT an adaptation of a template, and they carry no template
 * placeholders. Every factual claim below is one this repository can be held to:
 *
 *  - Non-custodial settlement and the "customer's wallet signs, the recipient's
 *    address receives" flow: `AGENTS.md`, `README.md` ("Payments are
 *    non-custodial — the customer's embedded wallet signs, the merchant's own
 *    address receives the principal").
 *  - The fee: a flat 2%, attributed to the merchant but funded by the customer,
 *    charged once inside the same atomic transaction as the principal
 *    (`README.md` §Fee model; `backend/src/services/fees.ts` is the source of
 *    truth).
 *  - The network being Tempo's TEST network, Moderato, with nothing defaulting
 *    to mainnet (`web/lib/chain/chain.constants.ts`, `NEXT_PUBLIC_ALLOW_MAINNET`).
 *  - The two assets in this version: pathUSD and OUSD (`SUPPORTED_ASSETS`).
 *  - The wallet keys living on the customer's device through Privy, and the
 *    backend never signing without an authorization the customer gives on their
 *    device (`AGENTS.md` §Blockchain & security guardrails).
 *  - The receipt check that fails closed before a payment is recorded
 *    (`recordPayment` / `recordSend` in the backend).
 *
 * DELIBERATELY UNPUBLISHED — section 13 says so in the document itself rather
 * than inventing any of it. These cannot be verified from this repository:
 *
 *  1. the registered legal entity that operates the Service, and its registered
 *     address (`web/app/legal/site.ts` holds `[Registered address]`);
 *  2. a contact address for formal notices (`legal@seti.example` there is a
 *     placeholder, not a working address);
 *  3. the governing law and the forum that would hear a dispute — the repo says
 *     the product is built for Nairobi, which is a market, not a choice of law,
 *     and the earlier draft's Kenyan governing law, JAMS arbitration and
 *     KES 1,000 liability cap were all template text, not facts about Seti;
 *  4. any licence, registration or regulatory approval.
 *
 * The age statement is the 18+ confirmation the customer gives at sign-up. There
 * is deliberately no date-of-birth field and no birth year collected anywhere:
 * a self-declaration carries the same legal weight at zero PII, and a real age
 * gate belongs at the age-restricted product when one exists.
 *
 * LEGAL REVIEW REQUIRED before publishing.
 */

const intro = [
  "These Terms of Use govern your use of the Seti app and the Seti website (together, the “Service”). You accept them by ticking the box when you sign up, and they apply from then on. If you do not accept them, do not use the Service.",
  "Seti is a non-custodial way to pay with stablecoins on Tempo: your own wallet signs every payment, and the funds go straight from you to the person you are paying. Seti never takes possession of your money. Section 5 (the fee) and section 6 (the network) are the two parts of this document most likely to surprise you, so read those before you pay anyone.",
  "You must be at least 18 years old to use the Service. We ask you to confirm that when you sign up. We do not ask for your date of birth.",
  `What Seti records about you, and why, is set out in the Privacy Policy at ${PRIVACY_URL}.`,
];

const sections: LegalSection[] = [
  {
    title: "1. What Seti is",
    paragraphs: [
      "Seti is a technology product for paying people and businesses with stablecoins on the Tempo network. You scan or enter a Seti-enabled QR code, the app reads the recipient's payout address and the asset to send from the code, and you authorize the transfer from your own wallet.",
      "Seti is not a bank, not a deposit-taker, and not a payment institution. It does not hold your money, does not owe you a balance, and does not lend, invest or earn anything on what you hold. It is not a party to any transfer: the stablecoins move from your wallet to the recipient's own address when you sign.",
      "There is no fiat off-ramp in this version of Seti. Nothing is converted into bank money or paid out to a bank account, by Seti or by anyone on its behalf.",
    ],
  },
  {
    title: "2. Your wallet, and who can move money from it",
    paragraphs: [
      "Your wallet is created for you when you sign up, through Privy's embedded wallet infrastructure. The keys that control it are held on your device. Seti never holds, receives, copies or stores your keys.",
      "You are responsible for your own access to that wallet: your device, and the credentials you sign in with. If you lose them, Seti cannot restore your access to the wallet or to anything in it, and cannot reverse a payment you have already authorized. Nobody at Seti can recover a wallet for you, because nobody at Seti holds the means to do so.",
      "Seti cannot move funds from your wallet on its own. Every payment is a transaction you authorize on your device, and the app is built so that the backend never signs on your behalf.",
      "Seti will never ask you for a recovery phrase, a private key, or your sign-in credentials. Anyone who asks you for any of them is not Seti.",
    ],
  },
  {
    title: "3. Signing up, and your username",
    paragraphs: [
      "Signing up creates an account and a wallet. The one thing we ask you to choose is a username: the name other people use to pay you, subject to the rules shown in the app when you claim it. That is the whole of what this version asks for.",
      "The age statement is yours to give. By ticking the box at sign-up you confirm that you are 18 or older. We do not ask for your date of birth and we do not store one: your confirmation is the statement Seti relies on.",
      "Keep your sign-in credentials to yourself. You are responsible for what happens under your account.",
      "You can delete your account from inside the app. Section 8 explains what that does and does not remove.",
    ],
  },
  {
    title: "4. How a payment works",
    paragraphs: [
      "The app shows you the recipient, the amount, the asset, and the total that will leave your wallet — the payment plus Seti's fee. You then authorize the transfer from your own wallet. Nothing is sent, and no fee is charged, until you do.",
      "The stablecoins move directly from your wallet to the recipient's address. Seti is not a party to that transfer and never holds the funds at any point in it.",
      "After the transfer is confirmed, Seti checks it against the on-chain receipt before recording it in your Activity: the amount, the asset and the destination must match what was claimed. If they do not match, Seti refuses the record rather than write down a payment it cannot verify.",
      "Transfers on Tempo are final. Once a transfer is confirmed on-chain, no one — including Seti — can reverse it, cancel it or refund it. Check the recipient, the amount and the asset before you authorize, because that is the last moment at which anything can be changed.",
    ],
  },
  {
    title: "5. The fee, and who pays it",
    paragraphs: [
      "Seti charges a platform fee of 2% of each payment. The fee is attributed to the recipient business, but it is funded by you: it is added to what you sign for, and the recipient receives exactly the payment amount, not the payment less the fee.",
      "The fee is charged once, inside the same transaction as the payment itself. One atomic transfer carries the principal to the recipient and the fee to the address Seti publishes as its treasury. It cannot be charged separately, it cannot be charged twice, and if the transfer does not go through, no fee is charged.",
      "The exact fee is shown to you before you authorize anything. The charge itself is in the stablecoin you pay with — pathUSD or OUSD in this version — and the fiat figure shown beside it is a label on that charge, converted at the rate displayed in the preview. The asset leaves your wallet; the fiat number does not.",
      "Seti may change the fee. If it does, it will tell you in the app, and the fee shown to you before you authorize a payment is the fee that applies to it.",
    ],
  },
  {
    title: "6. Which network this version runs on",
    paragraphs: [
      "Seti is built on Tempo. This version is configured for Tempo's test network (Moderato), and nothing in it defaults to mainnet.",
      "Test networks carry test assets. Amounts held there have no real-world value, and nothing in this version should be read as Seti holding money for you, owing you money, or being able to pay you money out. Do not use it to move value you cannot afford to lose, and do not treat a balance shown in the app as a bank balance.",
      "Before Seti operates on a network where the assets do carry real value, the app and these Terms will be updated to say which network that is. Until then, the network in use is the test network named above.",
    ],
  },
  {
    title: "7. What Seti records, and what is public",
    paragraphs: [
      "To show your Activity and to keep its own records, Seti records each payment: the amount, the asset, the fee charged, the recipient's address, the transaction hash, the block it settled in, and when it settled. Section 8 says how long that record lives, including after you delete your account.",
      "The blockchain record is public and permanent. Anyone can read the addresses, the amounts and the timing of a payment on Tempo's block explorer. Seti cannot delete that record, and neither can you. This is a property of the network, not a choice Seti makes.",
    ],
  },
  {
    title: "8. Accounts, suspension, and deletion",
    paragraphs: [
      "You may delete your account from inside the app. Deletion removes the account data Seti is not required to keep. It does not remove the transaction records Seti keeps for its own accounting and for disputes, and it cannot remove anything already written to the blockchain.",
      "Seti may suspend or end your access if you break these Terms, if the law requires it, or if your account is being used in a way that puts other people, the recipients you pay, or the Service at risk. Where it does, it will tell you why unless it is not allowed to.",
      "A wallet address you have used is not deleted by any of this: addresses and the payments to them remain on the chain permanently.",
    ],
  },
  {
    title: "9. Acceptable use",
    paragraphs: [
      "Use Seti lawfully. Do not use it to defraud anyone, to launder money, to move the proceeds of a crime, or to evade sanctions. Do not use it to attack, overload or disrupt the Service, or to interfere with anyone else's use of it.",
      "Payment requests can come from anyone. A QR code carries an address, not a promise: Seti reads the address out of the code it scans and cannot verify who issued that code. Treat an unfamiliar payment request with the same care you would treat any other unfamiliar request for money.",
    ],
  },
  {
    title: "10. The services Seti depends on",
    paragraphs: [
      "Seti is built on other people's infrastructure: Privy, which manages authentication and the embedded wallets; Tempo and its RPC providers, which supply the chain and its data; and the recipients you pay, whose own systems you are transacting with. Seti does not control those services and is not responsible for them. Their own terms and privacy practices apply to your use of them.",
      "Seti is an app, not the network. If Tempo is unavailable, if a recipient's address does not accept what you send, or if a third-party provider fails, Seti cannot intervene on your behalf in the transfer itself.",
    ],
  },
  {
    title: "11. Availability, and the limits of Seti's responsibility",
    paragraphs: [
      "The Service is provided as it is and as it is available. Seti does not promise that it will be uninterrupted or error-free, or that the on-chain data it displays will be complete or correct at every moment.",
      "Seti does not hold your funds, so it cannot return them. Seti is not responsible for money lost because you lost access to your wallet or your credentials, because you gave your credentials or keys to someone else, or because you authorized a payment to an address, an asset or an amount you did not intend.",
      "Where the Service records a payment, that record follows the on-chain receipt, not the app's display: if the two ever disagree, the chain governs.",
      "Nothing in these Terms limits responsibility that cannot lawfully be limited, including for fraud by Seti.",
    ],
  },
  {
    title: "12. Changes to these Terms",
    paragraphs: [
      "Seti will publish a new version of these Terms here, with a new effective date, whenever they change. Where a change materially affects you, Seti will say so in the app before it takes effect. Continuing to use the Service after a change takes effect means you accept the updated Terms.",
    ],
  },
  {
    title: "13. The operator, the governing law, and notices — not yet published",
    paragraphs: [
      "Seti has not yet published the name and registered address of the legal entity that will operate the Service, an address for formal notices, or the law and the forum that will govern a dispute about these Terms. Section 13 exists to say so plainly instead of filling those gaps with placeholder text that pretends to be a fact.",
      "All four will be published in this section, and users told when they are, before Seti is offered to the public generally. Until then, raise anything about these Terms or the Service through the app.",
      "Nothing in these Terms is a claim that Seti holds a licence, registration or regulatory approval, or that the Service is regulated anywhere.",
    ],
  },
];

const footnote =
  "These Terms were written for Seti from how the product is actually built, and they describe the version running on Tempo's test network. They are a draft: they have not been reviewed by a lawyer, and that review is required before Seti is offered to the public. They are not legal advice. Where a fact about the business cannot be stated yet — the operating entity, a notices address, the governing law, a jurisdiction — section 13 names it as unpublished rather than inventing one.";

export const termsContent = {
  title: "Terms of Use",
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro,
  sections,
  footnote,
};
