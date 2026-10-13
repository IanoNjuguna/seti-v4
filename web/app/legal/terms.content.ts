import { SITE, LEGAL_EFFECTIVE_DATE, PRIVACY_URL } from "./site";
import type { LegalSection } from "./LegalDocument";

/**
 * Website Terms of Use, adapted from the General Legal CC0 template
 * (https://github.com/General-Legal/legal-templates) for Seti.
 *
 * Deviations from the template, all deliberate:
 *  - "Site" is defined as the website AND the mobile application, since the
 *    payment flow happens in the app.
 *  - Governing law moved from California to Kenya; the template's US
 *    state-specific notices are dropped as inapplicable.
 *  - The arbitration clause keeps JAMS (Option A) and drops DecisionLayer
 *    (Option B), which assumes a US-hosted process.
 *  - A new section covers the stablecoin payment flow, which the template has
 *    no equivalent for. This is the load-bearing section: Seti is
 *    non-custodial, so the app never takes possession of the funds.
 *
 * LEGAL REVIEW REQUIRED before publishing.
 */

const intro = [
  `These Terms of Use ("Terms") govern your use of the Seti mobile application and the website at ${SITE.domain} (together, the "Service"). By creating an account, scanning a merchant QR code, or otherwise using the Service, you agree to these Terms on behalf of yourself and confirm you have the authority to do so. You must be at least 18 years old to use the Service. If you do not agree to these Terms, do not use the Service.`,
  `These Terms were adapted from a public legal template published by General Legal under CC0 1.0. They have not been reviewed by a Kenyan attorney and require review before Seti is offered to the public.`,
  `Your use of the Service is also governed by our Privacy Policy, available at ${PRIVACY_URL}, which is incorporated into these Terms by reference.`,
];

const sections: LegalSection[] = [
  {
    title: "1. Accounts",
    paragraphs: [
      "Creating an account. The Service uses Privy to manage authentication and your wallet keys. When you create an account you agree to provide accurate and complete information and to keep it current.",
      "Account security. You are responsible for all activity under your account and for keeping your authentication credentials confidential. If you believe your account has been accessed without your authority, contact us immediately at the address in section 12.",
    ],
  },
  {
    title: "2. Wallet custody and control",
    paragraphs: [
      "Seti is non-custodial. Your wallet is created for you and its keys are held on your device through Privy's embedded wallet infrastructure. Seti does not hold, own, or take possession of the stablecoins in your wallet, and Seti cannot transfer funds from your wallet without a transaction that you authorize on your device.",
      "This has consequences you should understand before using the Service. If you lose access to your device or your authentication credentials and cannot recover them, nobody — including Seti — can restore access to your wallet or the funds in it. Seti will never ask you for your recovery phrase, private key, or authentication credentials. If anyone does, it is not us.",
      "Seti is a technology provider. It is not a bank, and it does not offer deposit accounts, hold customer funds, or guarantee any return on funds you hold.",
    ],
  },
  {
    title: "3. Stablecoin payments",
    paragraphs: [
      "How a payment works. When you scan a merchant QR code, the Service reads the merchant's payout address and asset from the code. You authorize the transfer on your device. The stablecoins move directly from your wallet to the merchant's address on the Tempo blockchain. Seti records the transaction after verifying it against the on-chain receipt; Seti is not a party to the transfer itself.",
      "Fees. The amount shown to you before you authorize is the total that leaves your wallet. This includes the merchant's fee, which Seti discloses in the confirmation screen. The fee rate and any minimum or maximum that applies are shown to you before each payment. Seti may change the fee model with notice in the app.",
      "Irreversibility. Stablecoin transfers on Tempo are final. Once a transfer is confirmed on-chain it cannot be reversed by Seti or by any party. You are responsible for verifying the merchant, the amount, the asset, and the payout address before you authorize any payment.",
      "Your responsibility for payment details. If you authorize a transfer to an incorrect, expired, or malicious address, or to an asset you did not intend to send, the loss is yours. Seti verifies that the amount claimed for a payment matches the on-chain receipt, but it cannot verify that the address you paid was the address you intended.",
      "Exchange rates. Where the Service shows a fiat equivalent of a stablecoin amount, it is an estimate derived from a third-party exchange-rate source and is provided for information only. It is not an offer, a quote, or a guaranteed rate. Merchants determine their own prices in fiat terms.",
      "No investment advice. Nothing in the Service is financial, investment, tax, or legal advice. Stablecoin values can fall as well as rise, and you can lose some or all of the value you hold. You decide what to pay, to whom, and when.",
      "Prohibited use. You may not use the Service to violate Kenyan law, to fund activity that is unlawful or fraudulent, to evade sanctions, to launder proceeds of crime, or to attack, overload, or disrupt the Service or another user's use of it.",
    ],
  },
  {
    title: "4. Access to the Service",
    paragraphs: [
      "License. Subject to these Terms, Seti grants you a limited, non-exclusive, non-transferable, revocable licence to use the Service for your own personal, non-commercial purposes.",
      "Ownership. All intellectual property rights in the Service and its content belong to Seti or its licensors. These Terms grant you no ownership rights except the limited access rights above. The Seti name and marks are our property.",
      "Availability. The Service relies on third-party infrastructure including Privy for authentication and wallets and public blockchain RPC providers for chain data. We may modify, suspend, or discontinue any part of the Service at any time. We do not guarantee uninterrupted availability.",
      "Feedback. If you send us feedback or suggestions, you grant us a perpetual, irrevocable, worldwide, non-exclusive, royalty-free licence to use it without attribution. Please do not send anything you consider confidential.",
    ],
  },
  {
    title: "5. Third-party services",
    paragraphs: [
      "The Service integrates with and links to third-party services, including Privy, Tempo, and merchants you pay. We do not control, endorse, or take responsibility for third-party services. You use them at your own risk, and their own terms and privacy practices apply to your use of them.",
      "QR code content. The Service reads merchant details from QR codes it scans. It cannot guarantee that a QR code was issued by the merchant it identifies. Treat QR codes from untrusted sources with the same caution you would apply to any unfamiliar payment request.",
    ],
  },
  {
    title: "6. Suspension and termination",
    paragraphs: [
      "You may delete your account from within the Service. Deleting your account does not delete the transaction records Seti is required to retain, and it does not affect wallet addresses you previously used, which remain recorded on the blockchain permanently.",
      "Seti may suspend or terminate your access if you breach these Terms, if we are required to do so by law or by a competent authority, or if we detect activity that creates a material risk to Seti, its users, or the integrity of the Service. Where we suspend for legal reasons, we will tell you why.",
      "Provisions that by their nature should survive termination do survive, including sections 2, 3, 7, 8, and 9.",
    ],
  },
  {
    title: "7. Disclaimers",
    paragraphs: [
      "The Service is provided on an \"as is\" and \"as available\" basis. To the fullest extent permitted by law, Seti disclaims all warranties, express or implied, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement.",
      "Seti does not warrant that the Service will be error-free or uninterrupted, that the on-chain data it displays is complete or accurate, or that your wallet will be available at any particular time.",
      "Third-party wallets, blockchains, and stablecoin issuers are outside Seti's control. Seti is not responsible for the failure of any third party, including a merchant's failure to honour a payment you made.",
    ],
  },
  {
    title: "8. Limitation of liability",
    paragraphs: [
      "To the fullest extent permitted by law, Seti and its officers, employees, and agents will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or funds, arising out of or in connection with your use of the Service, however caused and regardless of the theory of liability.",
      "Seti is not liable for lost funds or lost wallet access resulting from your loss of device, your loss of authentication credentials, your disclosure of credentials to a third party, or your authorization of a transfer to an incorrect address.",
      "Where liability cannot be excluded, Seti's total aggregate liability to you for all claims arising out of the Service is limited to KES 1,000 (one thousand Kenyan shillings). This does not limit liability that cannot lawfully be limited, including for fraud.",
    ],
  },
  {
    title: "9. Indemnification",
    paragraphs: [
      "You agree to defend, indemnify, and hold harmless Seti and its officers, employees, and agents from claims and reasonable costs arising out of your use of the Service, your breach of these Terms, or your violation of any applicable law. Seti may assume control of the defence of any such claim, and you agree to cooperate. You agree not to settle any such claim without Seti's prior written consent.",
    ],
  },
  {
    title: "10. Kenya regulatory disclosures",
    paragraphs: [
      "Seti operates a technology platform that facilitates transfers of digital assets between users and merchants. Whether Seti requires a licence, registration, or approval under the Payment Service Providers Act, the Central Bank of Kenya Act, or the Capital Markets Act, and the treatment of digital assets under Kenyan law, is a question of legal interpretation that has not been settled for this business. This section is a disclosure, not a representation that Seti holds any licence or registration.",
      "Seti is not a deposit-taker. Seti does not hold your funds, does not owe you a balance, and does not bear responsibility for the value of any asset.",
    ],
  },
  {
    title: "11. Governing law and dispute resolution",
    paragraphs: [
      "Governing law. These Terms and any dispute arising out of or relating to them or the Service are governed by the laws of Kenya. For any claim or dispute not subject to arbitration, you and Seti consent to the exclusive jurisdiction of the courts of Kenya.",
      "Arbitration. Before starting arbitration, the parties agree to try to resolve the dispute informally. The party raising the dispute must send written notice to Seti. Within 45 days of receiving that notice, the parties will meet by phone or video in good faith to try to resolve it. If the process does not resolve the dispute within 60 days, either party may start arbitration.",
      "Arbitration will be administered by JAMS under its Comprehensive Arbitration Rules and Procedures, before a single arbitrator. Judgment on the award may be entered in any court of competent jurisdiction. The arbitrator may award reasonable costs and legal fees. All proceedings, including the existence of the dispute, the terms of these Terms, and any award, are confidential, except as required to enforce this clause.",
      "Arbitration is on an individual basis. Neither you nor Seti may bring claims as a plaintiff or class member in any class, representative, or collective proceeding. If a court finds this class waiver unenforceable as to a specific claim, that claim may be litigated in court, and all other claims remain subject to arbitration.",
      `Opt-out. You may opt out of this arbitration agreement within 30 days of first accepting these Terms by sending written notice to Seti at ${SITE.email} with your name, your email address associated with your account, and a clear statement that you wish to opt out. Opting out does not affect any other part of these Terms.`,
    ],
  },
  {
    title: "12. General",
    paragraphs: [
      "Entire agreement. These Terms, together with our Privacy Policy, are the entire agreement between you and Seti regarding the Service and supersede any earlier statement about it.",
      "Changes. Seti may update these Terms. Seti will notify you of material changes in the app or on the website before they take effect. Continuing to use the Service after a change takes effect means you accept the updated Terms.",
      `Notices. Notices to Seti under these Terms must be sent to ${SITE.email} and must include your name, your email address associated with your account, and the substance of your notice.`,
      "Assignment. You may not assign these Terms without our consent. Seti may assign these Terms to a successor of the business.",
      "Severability. If any provision is found unenforceable, the remaining provisions stay in effect.",
      "No waiver. A failure to enforce any provision is not a waiver of it.",
      `Contact information. Seti, ${SITE.address}. Email: ${SITE.email}. Made in Thika, Kenya.`,
    ],
  },
];

const footnote = `Adapted from legal templates by General Legal, used under CC0 1.0 Universal. This document is a draft and has not been reviewed by a qualified Kenyan attorney. It is not legal advice, and it does not establish that Seti holds any licence, registration, or regulatory approval. Have it reviewed before publishing.`;

export const termsContent = {
  title: "Terms of Use",
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro,
  sections,
  footnote,
};
