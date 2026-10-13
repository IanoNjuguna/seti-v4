import { SITE, LEGAL_EFFECTIVE_DATE, TERMS_URL, COOKIES_URL } from "./site";
import type { LegalSection } from "./LegalDocument";

/**
 * Privacy Policy, adapted from the General Legal CC0 Privacy Policy template for
 * Seti — kept structurally, rewritten to match what the product actually does.
 *
 * Deviations from the template, all deliberate:
 *  - The template's "Notice to European users" annex is dropped. Seti has no
 *    deployment or customer base in the EU, so the annex described a jurisdiction
 *    the product does not operate in.
 *  - The template's Google Analytics, advertising, and AI-training passages are
 *    cut. Seti runs no analytics or ad-tracking and trains no models on user
 *    data; leaving the template's boilerplate would be inaccurate.
 *  - Section 2 is written from the Prisma schema (`backend/prisma/schema.prisma`)
 *    and the onboarding flow (`web/components/onboarding/`), not from the
 *    template's generic list. Onboarding asks for a username and nothing else:
 *    there is no date-of-birth field, no first/last name field and no phone
 *    field, so the document names the data the database actually holds.
 *
 * DELIBERATELY UNPUBLISHED — these are legal decisions, not facts this repository
 * can settle, and section 13 says so in the document rather than inventing them:
 *   - the registered entity that operates Seti, and its registered address;
 *   - a dedicated data-protection contact address;
 *   - the governing law and the forum for a dispute.
 * The retention periods in section 6 are left unstated for the same reason: how
 * long a record must be kept is a legal decision, not an engineering one.
 *
 * LEGAL REVIEW REQUIRED before publishing.
 */

const intro = [
  `This Privacy Policy explains what personal information Seti collects, why we collect it, who we share it with, and what you can do about it. It applies to the Seti app and the website at ${SITE.domain}.`,
  `Seti is a non-custodial wallet application. We do not hold your funds, and we hold very little about you: the email address you sign in with, the name you claim, the wallet address you pay from, and the record of what you pay. This policy sets out exactly that.`,
  `This policy is adapted from a public legal template published by General Legal under CC0 1.0. It has not been reviewed by a Kenyan attorney and requires review before Seti is offered to the public.`,
];

const sections: LegalSection[] = [
  {
    title: "1. Who we are",
    paragraphs: [
      `Seti is a non-custodial way to pay and to be paid with stablecoins. The company that operates Seti, and its registered details, are not yet published — section 13 says so plainly rather than filling the gap with a placeholder. The operator of Seti is the controller of the personal information described in this policy: it decides what is collected and why. Seti is not a bank and is not a licensed financial institution.`,
    ],
  },
  {
    title: "2. Personal information we collect",
    paragraphs: [
      "Your email address. You sign in with an email address, and that address identifies your account: it is how we recognise you when you return, and it is the only channel we have for reaching you about your account. We do not use it for marketing, and we do not sell it or share it with anyone except the sign-in provider below, which processes it to run sign-in and to create your wallet. We store the address itself and the identifier the sign-in provider issues for it. We will not ask you for a password, and we will never ask you for your private key, your recovery phrase, or the credential you sign in with.",
      "The name you claim. When you sign up you choose one thing: a username, or — if you take payments as a business — a business name. We store that name, the lowercased handle it reduces to, whether it is a person or a business, the wallet address it is bound to, and the signature your wallet made to claim it. We re-check that signature every time the name is looked up, so the binding cannot be altered after the fact.",
      "Your wallet. We store the wallet address created for you, the chain it is on, and the asset the record names. The keys that control the wallet belong to you and are held for you by Privy, on your device; Seti stores no private key, no recovery phrase and no raw credential — at most an opaque reference to key material.",
      "The currency you are shown figures in. We store the fiat currency the app prices and displays in. In this version it is KES. It is a setting only: we hold no bank account number and no payment-card number.",
      "Your payment records. For every payment you authorise we record the amount and the asset, the fee, the recipient's address, the fiat figure shown beside it, the exchange rate used and where it came from and when, the transaction hash, the block it settled in, and its status and timestamps. Nothing is written until the transfer has been checked against its on-chain receipt, so the record follows the chain, not the figure your device supplied.",
      "Security records. When you sign in, and when you take an action that matters, we write an audit entry: the action, the time, and the IP address the request came from, tied to your account. We keep it to detect unauthorised access and to answer a dispute about a payment.",
      "What we do not collect. We do not ask for your date of birth, your first or last name, your phone number, your government identification number, or a copy of any identity document, and we hold no biometric data. There is no name field to fill in and no date-of-birth field to fill in. We will never ask you for your private key, your recovery phrase, or the credential you sign in with, and anyone who does is not Seti.",
    ],
  },
  {
    title: "3. How we use your personal information",
    paragraphs: [
      "Service delivery. To sign you in, to create and secure your wallet, to claim and resolve your handle so that people can pay you by name, to price a payment in your currency, to carry out the payment you authorise, to show your Activity, and to calculate the fee on it.",
      "Security and fraud prevention. To detect unauthorised access, to watch for anomalous payment activity, and to investigate a dispute about a payment. The audit entries described in section 2 are what we use for this.",
      "Legal and regulatory compliance. To meet our record-keeping obligations, to establish or defend legal claims, and to answer a lawful request from a competent authority.",
      "Service improvement. To find where the Service fails or is slow, and to fix it. We do not use your personal information for advertising, and we do not sell it.",
      "Machine learning. We do not train machine learning models on your personal information, and we have no opt-out to offer, because we do not do it.",
    ],
  },
  {
    title: "4. Legal bases for processing",
    paragraphs: [
      "Where the Kenya Data Protection Act, 2019 applies to the processing described here, we rely on the following bases: your consent, for anything optional such as marketing you have asked to receive; contract, to provide the Service and to perform the payment you authorise; legal obligation, to keep the records we are required to keep; and legitimate interests, to secure the Service, deter fraud, and improve it. Where we rely on legitimate interests we have assessed that they do not override your rights and freedoms.",
      "Because the payment records we keep are transaction records, we hold them for as long as we are obliged to, whether or not you withdraw consent to anything else.",
    ],
  },
  {
    title: "5. How we share personal information",
    paragraphs: [
      "Service providers. Vendors operate parts of the Service for us and receive only what they need: Privy, which runs sign-in and the embedded wallet; blockchain RPC and indexing providers, which supply chain data — and from which your wallet address and transaction history are publicly readable in any case; and our hosting, database and email providers. Each is bound to use what it receives only for us.",
      "The exchange-rate provider. To show a fiat figure for a payment we fetch a table of USD exchange rates from a public rate provider (open.er-api.com). That is a plain request for a table of rates: it carries nothing that identifies you — no account, no wallet address, no amount — and the provider sees only that our server asked it for a rate.",
      "At the recipient's direction. When you pay someone, the transfer itself shows them the address you paid from and the amount; that is inherent in paying them, not a report we send. We do not share your handle with them by default.",
      "On-chain transparency. Every payment you make is recorded on the Tempo blockchain and is permanently public. Your wallet address, the amount, the asset, the recipient's address and the timing are visible to anyone. This is a property of the blockchain, not a choice by Seti, and neither Seti nor you can delete it.",
      "Legal disclosure. We may disclose personal information where the law requires it, to a competent authority, or to establish or defend a legal claim.",
      "Corporate events. If Seti is reorganised, merged or acquired, personal information may transfer to the successor under the same protections described here.",
      "We do not sell personal information, and we do not share it for cross-context behavioural advertising.",
    ],
  },
  {
    title: "6. Retention",
    paragraphs: [
      "We keep the account records described in section 2 for as long as your account is active. Payment records are kept for a further period, both to answer a dispute and to meet the record-keeping obligations that apply to us; how long that period is has not been fixed here, and when it is it will be stated in this section.",
      "Two things survive the deletion of an account. The public binding of a handle — a name and the address it resolves to — is a claim anyone can already read, so removing it from our database hides it without unwriting it. And the on-chain record of a payment cannot be deleted at all, by us or by anyone, because it is held on a public blockchain.",
      "Security and audit entries are kept for as long as they are useful for fraud investigation and dispute resolution, and are then removed.",
    ],
  },
  {
    title: "7. Your rights",
    paragraphs: [
      "Under the Kenya Data Protection Act, 2019 you have the right to be told what personal information we hold about you, to be given a copy of it, to have inaccurate information corrected, to ask us to delete it or to object to our processing it, to withdraw consent where we rely on it, and to lodge a complaint with the Office of the Data Protection Commissioner of Kenya.",
      "Access and correction. What the app shows you — your handle, your wallet, your Activity — is the information we hold about you. For a copy of anything beyond that, contact us as section 13 describes.",
      "Deletion. You can delete your account from inside the app. That removes the account data we are not required to keep. It does not remove payment records we must keep, and it cannot remove anything already written to the blockchain.",
      "Withdrawal of consent. Where we rely on your consent — for example, if you ever ask to receive marketing — you may withdraw it at any time. Withdrawing it does not undo processing that was lawful before you withdrew.",
      "Complaints. If you are not satisfied with how we have handled your information, you may complain to the Office of the Data Protection Commissioner, Nairobi.",
      "Not every right is absolute. Where a right conflicts with a legal duty to keep a record, the duty wins. That is why deleting your account does not erase your payment history.",
    ],
  },
  {
    title: "8. Security",
    paragraphs: [
      "We use technical and organisational safeguards, including encryption in transit, restricted database access, and an audit log of the actions that matter. Sign-in and the keys that control your wallet are handled by Privy; Seti holds no key material and no signing credential of yours.",
      "No system is perfectly secure, and some of this information is exposed by design. Because your wallet address and your payments are public on the blockchain, that part cannot be protected by us at all. If a security incident creates a material risk to your personal information, we will tell you and report it to the Data Protection Commissioner as the law requires.",
    ],
  },
  {
    title: "9. International transfers",
    paragraphs: [
      "Seti is built for Nairobi. Some of the providers that support the Service — including Privy and blockchain RPC providers — process information outside Kenya. Where personal information leaves Kenya we rely on appropriate safeguards for the transfer; the specific safeguards will be named here once they are settled.",
    ],
  },
  {
    title: "10. Cookies and tracking",
    paragraphs: [
      "The website does not use advertising or analytics cookies and does not run third-party advertising or tracking scripts. The app does not track you across other apps or websites. If that changes, we will update this policy and, where the law requires it, ask for consent before deploying non-essential tracking.",
      "The Service relies on Privy, which manages sign-in and your session and may set its own cookies or storage when you sign in. Those are set by Privy, not by Seti, and Privy describes its own processing in its privacy policy.",
      `The website loads one video asset from a content delivery network, which necessarily discloses your IP address and browser information to that provider. We do not load third-party advertising or tracking scripts. Our full Cookie Notice is available at ${COOKIES_URL}.`,
    ],
  },
  {
    title: "11. Children",
    paragraphs: [
      "The Service is not intended for anyone under 18. We ask you to confirm at sign-up that you are 18 or older; we do not ask for your date of birth and we do not store one. If you believe a child has used the Service, contact us and we will delete the account data we are not required to keep.",
    ],
  },
  {
    title: "12. Changes to this policy",
    paragraphs: [
      "We may update this policy. We will change the effective date above and post the new version on the Service, and where a change materially affects you we will say so in the app before it takes effect. Your continued use of the Service after a change means the updated policy applies.",
    ],
  },
  {
    title: "13. How to contact us",
    paragraphs: [
      "Seti has not yet published the name and registered address of the company that operates it, or a dedicated contact address for data-protection requests. Those are decisions for the operator, not facts this document can supply, and this section exists to say so instead of printing placeholder details that look real.",
      "Both will be published here, and users told when they are, before Seti is offered to the public generally. Until then, raise a privacy question or request through the app.",
      `Full terms of use are available at ${TERMS_URL}.`,
    ],
  },
];

const footnote = `Adapted from legal templates by General Legal, used under CC0 1.0 Universal. This document is a draft and has not been reviewed by a qualified attorney. It describes the data the product holds as built at the effective date above, and is not a commitment about future changes.`;

export const privacyContent = {
  title: "Privacy Policy",
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro,
  sections,
  footnote,
};
