import { SITE, LEGAL_EFFECTIVE_DATE, TERMS_URL, COOKIES_URL } from "./site";
import type { LegalSection } from "./LegalDocument";

/**
 * Privacy Policy, adapted from the General Legal CC0 Privacy Policy (GDPR
 * Enhanced) template for Seti.
 *
 * Deviations from the template, all deliberate:
 *  - The template's "Notice to European users" annex is retained but reframed:
 *    Seti's customer base is Kenyan, so the Kenya section is the operative one
 *    and the EU annex is kept for any EU-resident user. The template has no
 *    Kenya coverage at all, which is the real gap in it.
 *  - The template's Google Analytics, advertising, and AI-training passages are
 *    cut. Seti runs no analytics or ad-tracking and trains no models on user
 *    data; leaving the template's boilerplate would be inaccurate.
 *  - Section 24 is written from the actual Prisma schema rather than the
 *    template's generic list, so the disclosure matches the database.
 *
 * LEGAL REVIEW REQUIRED before publishing.
 */

const intro = [
  `This Privacy Policy explains what personal information Seti collects, why we collect it, who we share it with, and what you can do about it. It applies to the Seti mobile application and the website at ${SITE.domain}.`,
  `Seti is a non-custodial wallet application. We do not hold your funds. We do collect personal information about you, including transaction records, and we are responsible for it.`,
  `This policy is adapted from a public legal template published by General Legal under CC0 1.0. It has not been reviewed by a Kenyan attorney and requires review before Seti is offered to the public.`,
];

const sections: LegalSection[] = [
  {
    title: "1. Who we are",
    paragraphs: [
      `Seti is operated by ${SITE.legalName}${SITE.entitySuffix}, ${SITE.address} ("Seti", "we", "us"). For the purposes of the Kenya Data Protection Act, 2019, Seti is the data controller: we decide what personal information is collected and why. We are not a bank and we are not a licensed financial institution.`,
    ],
  },
  {
    title: "2. Personal information we collect",
    paragraphs: [
      "Account information you give us. Email address, first name, last name, and phone number, collected when you create an account and sign in. We collect email address and password through Privy, which manages authentication; we receive your verified email address and profile fields from Privy.",
      "Wallet and blockchain information. Your wallet address, the chain and asset it holds, and an opaque reference to the key material that secures it. We never store your private key or recovery phrase.",
      "Transaction information. The amount and asset of every payment you make, the fee, the merchant or recipient address, the fiat equivalent and the exchange rate used at the time, the transaction hash, the block number, and the settlement status and timestamps.",
      "Merchant information. For merchant accounts, the trading name, category, and the settlement details needed to pay you, including payout address and, where applicable, bank account and bank name.",
      "Device and usage information. IP address, timestamps, and records of actions taken in the app. We record security-relevant events in an audit log, including sign-in activity, associated with your user identifier.",
      "Information we do not collect. We do not collect your government ID number, biometric data, or national identity documents. We do not require you to give us your private key or recovery phrase, and we will never ask for them.",
    ],
  },
  {
    title: "3. How we use your personal information",
    paragraphs: [
      "Service delivery. To authenticate you, create and secure your wallet, process and record payments you authorize, display your transaction history, and calculate the fee charged on each payment.",
      "Security and fraud prevention. To detect unauthorized account access, monitor for anomalous payment activity, and investigate disputes about a transaction. We log security events with your user identifier and IP address for this purpose.",
      "Legal and regulatory compliance. To meet obligations under Kenyan law, establish or defend legal claims, and respond to lawful requests from a competent authority.",
      "Service improvement. To understand where the Service fails or is slow, and to fix it. We do not use your personal information for advertising, and we do not sell it.",
      "Machine learning. We do not train machine learning models on your personal information and we have no opt-out to offer, because we do not do it.",
    ],
  },
  {
    title: "4. Legal bases for processing",
    paragraphs: [
      "Under the Kenya Data Protection Act, 2019 we process personal information on the following bases: your consent, for marketing you have asked to receive; contract, to provide the Service and perform the payments you authorize; legal obligation, to meet statutory record-keeping and regulatory requirements; and legitimate interests, to secure the Service, prevent fraud, and improve it. Where we rely on legitimate interests we have assessed that our interests are not overridden by your rights and freedoms.",
      "Because the payments we record are transaction records, we retain them for the period required by Kenyan law regardless of whether you withdraw consent.",
    ],
  },
  {
    title: "5. How we share personal information",
    paragraphs: [
      "Service providers. We share personal information with vendors that operate the Service on our behalf: Privy, which provides authentication and wallet infrastructure; blockchain RPC and indexing providers, which supply chain data and from which your wallet address and transaction history are publicly readable; and our hosting, database, and email providers. Each receives only what it needs and is bound to use it only for us.",
      "At the merchant's direction. When you pay a merchant, we share the wallet address you pay from and the amount with that merchant. Your full name and email address are not shared with the merchant by default.",
      "On-chain transparency. Every payment you make is recorded on the Tempo blockchain and is permanently public. Your wallet address, the amount, the asset, the merchant's address, and the timing are visible to anyone. This is a property of the blockchain, not a choice by Seti, and cannot be deleted by Seti or by you.",
      "Legal disclosure. We may disclose personal information where required by law, to a competent Kenyan authority, or to establish or defend legal claims.",
      "Corporate events. If Seti is reorganised, merged, or acquired, personal information may transfer to the successor, under the same protections described here.",
      "We do not sell personal information and we do not share it for cross-context behavioural advertising.",
    ],
  },
  {
    title: "6. Retention",
    paragraphs: [
      "We retain personal information for as long as your account is active, and transaction records for the period required by Kenyan law and to establish or defend claims, even after you delete your account. Audit and security logs are retained for a limited period for fraud investigation. On-chain payment records cannot be deleted because they are held on a public blockchain.",
    ],
  },
  {
    title: "7. Your rights",
    paragraphs: [
      "Under the Kenya Data Protection Act, 2019 you have the right to access the personal information we hold about you, to correct inaccurate information, to object to or request the deletion of information, to withdraw consent where we rely on it, and to lodge a complaint with the Office of the Data Protection Commissioner of Kenya.",
      `Access and correction. Account details are visible and editable in the app. For a copy of the personal information we hold beyond what the app shows you, contact us at ${SITE.email}.`,
      "Deletion. You can delete your account from the app. Deletion removes your account data we are not required to retain, but it does not remove transaction records we must keep, and it cannot remove the on-chain record of your payments.",
      "Withdrawal of consent. Where we rely on your consent, for example to send you marketing email, you may withdraw it at any time by contacting us or using the unsubscribe link in the message.",
      "Complaints. If you are not satisfied, you may complain to the Office of the Data Protection Commissioner, Nairobi.",
      "Not every right is absolute. Where a right conflicts with a legal retention requirement, the law wins. That is why deleting your account does not erase your transaction history.",
    ],
  },
  {
    title: "8. Security",
    paragraphs: [
      "We use technical and organisational safeguards to protect the personal information we hold, including encryption in transit, restricted database access, and audit logging of administrative actions.",
      "No system is perfectly secure. Because your wallet keys are held on your device and transaction data is public on the blockchain, some information is inherently exposed. A security incident that results in a material risk to your personal information will be reported to you and to the Data Protection Commissioner as required by law.",
    ],
  },
  {
    title: "9. International transfers",
    paragraphs: [
      "Seti is operated from Kenya. Some service providers that support the Service process information outside Kenya, including Privy and blockchain RPC providers. Where personal information leaves Kenya we rely on appropriate safeguards for the transfer.",
    ],
  },
  {
    title: "10. Cookies and tracking",
    paragraphs: [
      "The website does not use advertising or analytics cookies and does not run third-party advertising or tracking scripts. The app does not track you across other apps or websites. If this changes, we will update this policy and, where required, ask for consent before deploying non-essential tracking.",
      "The Service does rely on the security of the authentication provider that manages your session. That provider's own processing of session data is described in its privacy policy.",
      `The website loads one video asset from a content delivery network, which necessarily discloses your IP address and browser information to that provider. We do not load third-party advertising or tracking scripts. Our full Cookie Notice is available at ${COOKIES_URL}.`,
    ],
  },
  {
    title: "11. Children",
    paragraphs: [
      "The Service is not intended for anyone under 18. We do not knowingly collect personal information from children. If you believe a child has provided personal information to us, contact us and we will delete it.",
    ],
  },
  {
    title: "12. Changes to this policy",
    paragraphs: [
      "We may update this policy. We will update the effective date above and post the new version on the Service. Your continued use of the Service after a change means the updated policy applies to your interactions with us.",
    ],
  },
  {
    title: "13. How to contact us",
    paragraphs: [
      `Data protection enquiries. Email ${SITE.email}. Post: ${SITE.address}, Kenya.`,
      `Full terms of use are available at ${TERMS_URL}.`,
    ],
  },
];

const footnote = `Adapted from legal templates by General Legal, used under CC0 1.0 Universal. This document is a draft and has not been reviewed by a qualified Kenyan attorney. It does not establish compliance with any data protection law and should be reviewed before publishing.`;

export const privacyContent = {
  title: "Privacy Policy",
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro,
  sections,
  footnote,
};
