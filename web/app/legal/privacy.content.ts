import {
  SITE,
  LEGAL_EFFECTIVE_DATE,
  TERMS_URL,
  COOKIES_URL,
} from "./site";
import type { LegalSection } from "./LegalDocument";

/**
 * Privacy Policy, written for Seti from what the code actually holds.
 *
 * Each claim below has a source in this repository:
 *
 *  - The collected fields: `User`, `Wallet`, `Handle`, `Transaction` and
 *    `AuditLog` in `backend/prisma/schema.prisma`. `phone` is nullable and
 *    written only when the sign-in provider returns one (`services/auth.ts`,
 *    `services/signup.ts`); there is no date-of-birth, identity-document or
 *    card column, and no KYC call site.
 *  - Nothing else is collected: the web app contains no analytics, advertising
 *    or session-replay SDK, and `package.json` pulls in none. The only mentions
 *    of those products in `web/` are in this document.
 *  - Browser storage: `seti-auth-token` and `seti-auth-user`
 *    (`web/lib/auth/auth.constants.ts`) and `seti-sound-muted`
 *    (`web/lib/sound.ts`).
 *  - One cookie: `seti-invite` (`web/lib/invite/invite.constants.ts`), set by the
 *    `/i/<handle>` route when the link is live and read by the `/signin` render.
 *  - Invitation attribution: `Referral` in `backend/prisma/schema.prisma`, written
 *    at `POST /auth/verify` for a NEW account only. It holds the two account ids,
 *    the inviter's handle as a snapshot, and the time — no email, no address, no
 *    amount. Amount privacy is deliberately NOT persisted: it is
 *    held in memory by `web/lib/privacy/amount-privacy.context.tsx` for the
 *    session, so it survives navigation between app screens and resets when the
 *    page is reloaded. This policy says so instead of listing a preference that is
 *    not stored.
 *  - Processors: Privy (sign-in, embedded wallet), Cloudflare (hosting, the API
 *    tunnel, R2 backups under `deploy/`), AWS Lightsail eu-west-1 (the server
 *    and its Postgres). The rate table is fetched server-side from
 *    `open.er-api.com` (`backend/src/services/payments.ts`) and carries no user
 *    data.
 *  - Public and permanent: the customer's wallet signs and the recipient's
 *    address receives (`AGENTS.md`), so the addresses and amounts are on a
 *    public chain for good.
 *  - No self-serve deletion in this build: no delete route in
 *    `backend/src/routes/`, no control under `web/app/app/`. The policy asks the
 *    reader to write in rather than describing a button that does not exist.
 *  - Shared receipts are an unauthenticated page behind an expiring signed token
 *    (`web/app/r/[id]/page.tsx`, `routes/receipts.ts`).
 *
 * DELIBERATELY UNSTATED: the operator and its registered address, the contact
 * address, and how long payment records are kept. Those are marked as gaps
 * rather than invented; `./site.ts` holds the placeholders.
 *
 * LEGAL REVIEW REQUIRED before this is treated as final.
 */

const intro = [
  `This policy says what Seti records about you, why, who else handles it, and what you can do about it. It covers the Seti app and the website at ${SITE.domain}.`,
  "Seti is a payments app, and we hold very little about you: the email you sign in with, the name you choose, the wallet addresses tied to your account, and the record of what you paid. That is the whole list, and this policy sets it out.",
  "One thing here cannot be undone, so it comes first. A payment you make is written to Tempo's public record and stays there. Section 6 is the part to read if you read nothing else.",
];

const sections: LegalSection[] = [
  {
    title: "1. Who we are",
    paragraphs: [
      `Seti is a payments app. It runs on Tempo and never holds your money. The company that operates it is ${SITE.legalName}, and its registered details are marked in section 12 rather than invented.`,
      "That company decides what is collected and why, so it is the controller of the information described here.",
    ],
  },
  {
    title: "2. What we collect",
    paragraphs: [
      "Your email address. You sign in with it and a one-time code, so it identifies your account and is how we reach you about it. We do not use it for marketing.",
      "A phone number, only if your sign-in gives us one. It is optional: we never ask for it, and the app works without it.",
      "The wallet addresses tied to your account, and the network each one is on. The keys to those wallets are held for you by Privy; Seti holds no private key and no recovery phrase.",
      "The names you choose: a username, or a business name. We store the name as you typed it, the handle it reduces to, whether it is a person or a business, the address it pays to, and the signature that claimed it.",
      "What you paid. For each payment: the amount, the digital dollar used, the fee, the address paid, the KES figure shown, the exchange rate and its source and time, the transaction hash, the block, the status and the times. Nothing is written until the payment has been checked against the public record.",
      "The currency your figures are shown in. In this version that is KES. It is a setting only.",
      "Whether an account invited you. If you open someone's invite link and then sign up, we record that the two accounts are connected: the account that invited you can see that you joined, by the username you chose, and the date. It never sees your email address, your wallet address, or what you spend. Nothing is recorded if you only open the link and do not sign up.",
      "Security records. When you sign in, or take an action that matters, we write an entry: what happened, when, and the IP address the request came from. Our servers also keep request logs, which include IP addresses. We use both to run and to secure the service.",
    ],
  },
  {
    title: "3. What we do not collect",
    paragraphs: [
      "No analytics product, no advertising pixel, no session recording and no third-party cookie is loaded in the app or on the website. There is nothing to opt out of, because nothing here follows you across other sites.",
      "No date of birth, no national ID number, no copy of an identity document, no selfie and no biometric data. No identity check runs in this version.",
      "No bank details and no card number. There is no cash-out in this version, so we never ask for them.",
      "No location, no contacts list and no camera. Nothing leaves your device except the address you type or scan.",
      "We do not sell your information and we do not use it for advertising.",
    ],
  },
  {
    title: "4. Why we use it",
    paragraphs: [
      "To give you the service: to sign you in, to keep your wallet working, to look up the name you are paying, to price a payment in KES, to carry out the payment you approve, and to show your Activity and receipts.",
      "To keep it safe: to spot unauthorised access, to investigate a payment someone disputes, and to keep the security log described above.",
      "To meet the law: to keep the records we are required to keep, and to answer a lawful request from an authority entitled to make it.",
      "The Kenya Data Protection Act 2019 applies to this. We rely on our contract with you to run your account and carry out the payments you approve, on our legal obligations to keep records, and on our legitimate interests in keeping the service secure. Where we ask for your consent, we ask first, and you can take it back at any time.",
      "We do not train machine learning models on your information.",
    ],
  },
  {
    title: "5. What your browser keeps",
    paragraphs: [
      `The website keeps your sign-in in your browser's local storage, and remembers whether you muted the sound. It sets one cookie of its own: when you open an invite link, it stores a signed cookie for up to 30 days recording that you arrived from that invitation. Only our server can read it, no script can, and it is discarded once you have signed up. The cookie notice at ${COOKIES_URL} lists every entry, by name.`,
    ],
  },
  {
    title: "6. What is public and permanent",
    paragraphs: [
      "A payment you make is written to Tempo's public record. Anyone can read the address you paid from, the address you paid, the amount and the time.",
      "You cannot delete it, and neither can we. Nor can we restrict who reads it. This is how Tempo works, and it is the one part of your record that no request to us can reach.",
      "The name you claim is public too: anyone with the link can see the name, whether it is a person or a business, and the address it pays to.",
      "If you share a receipt, the link carries the payment details and works for anyone who has it until it expires.",
    ],
  },
  {
    title: "7. Who else handles it",
    paragraphs: [
      "Privy runs sign-in and holds the keys to your wallet. It sees your email address and the wallet it created for you.",
      "Cloudflare hosts the website and carries requests to our API. It sees the traffic, which includes IP addresses.",
      "AWS runs our server and database, in Ireland (eu-west-1). Your account and payment records are stored there.",
      "Tempo and its node providers see the addresses and amounts in a transfer, because those are public.",
      "We fetch public exchange rates from open.er-api.com to show a KES figure. That request carries nothing about you.",
      "Nobody else. We do not sell your information and we do not share it for advertising.",
      "Because our server and these providers sit outside Kenya, your information is processed outside Kenya. The Data Protection Act 2019 sets the conditions for sending personal data out of the country, and those conditions apply to the transfers described here.",
    ],
  },
  {
    title: "8. How long we keep it, and closing your account",
    paragraphs: [
      "We keep your account details while your account is open.",
      "We keep payment records after that. We need them to answer a dispute and to meet record-keeping duties. How long is not fixed in this version, and this section will state it when it is.",
      `You can ask us to close your account and to delete what we are not required to keep. Write to ${SITE.email}. There is no delete button in the app in this version.`,
      "Three things survive that: payment records we must keep, the public record on Tempo, and a name that was already public. We cannot remove any of them, and we will not pretend to.",
    ],
  },
  {
    title: "9. Your rights",
    paragraphs: [
      `Under the Kenya Data Protection Act 2019 you can ask what we hold about you and get a copy of it. You can have anything wrong corrected. You can ask us to delete what we are not required to keep. You can object to how we use it. You can take back any consent you gave. Ask by writing to ${SITE.email}, and we answer within the time the Act allows.`,
      "Your Activity in the app is most of what we hold about you. For a copy of the rest, ask.",
      "If we get it wrong, you can complain to the Office of the Data Protection Commissioner (ODPC), which regulates data protection in Kenya. You do not have to complain to us first.",
      "No right is absolute. Where the law requires us to keep a record, that duty wins. That is why closing your account does not erase your payment history.",
    ],
  },
  {
    title: "10. Security",
    paragraphs: [
      "Sign-in and the keys to your wallet are handled by Privy. Seti holds no key material of yours.",
      "Traffic to Seti is encrypted in transit. Our database is not reachable from the internet: only our API talks to it. The actions that matter are written to an audit log.",
      "No system is perfectly secure, and part of your record is public by design: the addresses and amounts on Tempo cannot be protected by us.",
      "If a breach puts your information at risk, we will tell you and report it to the ODPC, as the Act requires.",
    ],
  },
  {
    title: "11. Children",
    paragraphs: [
      "Seti is for people aged 18 and over. We ask you to confirm your age when you sign up, and we do not store a date of birth. If you think a child has an account, write to us and we will close it.",
    ],
  },
  {
    title: "12. Contact, and who operates Seti",
    paragraphs: [
      `Write to ${SITE.email} about anything in this policy: a request, a correction, a complaint, or a question about what we hold. Our Terms of Use are at ${TERMS_URL}.`,
      "The company that operates Seti, and its registered address, are marked here rather than invented:",
    ],
    clauses: [
      `Operator: ${SITE.legalName}`,
      `Registered address: ${SITE.address}`,
      `Privacy requests, corrections and complaints: ${SITE.email}`,
    ],
  },
  {
    title: "13. Changes to this policy",
    paragraphs: [
      "When this policy changes we publish the new version here with a new date, and where a change matters to you we say so in the app before it takes effect. The date at the top tells you which version you are reading.",
    ],
  },
];

const footnote =
  "This policy describes the data Seti holds as built at the date above: what is collected, what is not, who processes it, and what is public on Tempo. It was written from the product itself and still needs a lawyer's review before it is treated as final. It is not legal advice. Where a fact about the business cannot be stated yet, section 12 marks it rather than inventing one.";

export const privacyContent = {
  title: "Privacy Policy",
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro,
  sections,
  footnote,
};
