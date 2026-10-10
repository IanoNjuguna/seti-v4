/**
 * Plain-language summaries of the Terms and Privacy Policy shown inside the app.
 *
 * These are summaries, not the binding documents. Each block is a short,
 * accurate statement of what the corresponding clause in the full Terms or
 * Privacy Policy actually says. Keep them in sync with the web documents.
 */

export interface LegalSummaryBlock {
  title: string;
  body: string;
}

export interface LegalSummary {
  /** Full document title, e.g. "Terms of Use". */
  title: string;
  /** One-line description of what the document covers. */
  description: string;
  blocks: LegalSummaryBlock[];
  /** Callout shown at the top of the Terms summary. */
  callout?: string;
}

export const termsSummary: LegalSummary = {
  title: 'Terms of Use',
  description: 'How you can use Seti, and what we are responsible for.',
  callout:
    'Seti does not hold your funds. Your wallet keys stay on your device and transfers go straight from your wallet to the merchant.',
  blocks: [
    {
      title: 'Your wallet is yours',
      body: 'Seti is not a bank and does not hold your money. If you lose your device or sign-in details, nobody, including Seti, can restore access to your wallet. Seti will never ask for your recovery phrase or private key.',
    },
    {
      title: 'Payments cannot be reversed',
      body: 'Stablecoin transfers are final once confirmed. Check the merchant, amount, asset and payout address before you authorise a payment. If you authorise a transfer to the wrong address, the loss is yours.',
    },
    {
      title: 'Fees are shown before you pay',
      body: 'The amount shown on the confirmation screen is the total that leaves your wallet, including the merchant fee. We disclose the fee before every payment.',
    },
    {
      title: 'Exchange rates are estimates',
      body: 'Any fiat amount shown is an estimate from a third-party rate source, provided for information only. It is not a quote or a guaranteed rate.',
    },
    {
      title: 'Not investment advice',
      body: 'Nothing in Seti is financial, investment, tax or legal advice. Stablecoin values can fall as well as rise and you can lose part or all of what you hold.',
    },
    {
      title: 'Ending your account',
      body: 'You can delete your account from the app. Deleting it does not remove the transactions we are required to keep, and it cannot remove payments recorded on the public blockchain.',
    },
  ],
};

export const privacySummary: LegalSummary = {
  title: 'Privacy Policy',
  description: 'What we collect, why, and what we do not collect.',
  callout:
    'Every payment you make is recorded on a public blockchain and cannot be deleted by anyone, including us.',
  blocks: [
    {
      title: 'What we collect',
      body: 'Your email, name, phone number, wallet address, and the details of every payment you make — amount, asset, fee, merchant address, and the transaction hash on the Tempo blockchain. We also record your IP address and sign-in activity in a security log.',
    },
    {
      title: 'What we never collect',
      body: 'We do not collect your government ID, biometrics, or identity documents. We never store your private key or recovery phrase.',
    },
    {
      title: 'Who we share it with',
      body: 'Privy, which manages sign-in and wallets; blockchain providers, from which your wallet and transaction history are publicly readable; and our hosting and email providers. When you pay a merchant, that merchant sees the address you paid from and the amount.',
    },
    {
      title: 'Why we use it',
      body: 'To sign you in, run and secure the Service, and meet our legal obligations under Kenyan law. We do not use your data for advertising and we do not sell it.',
    },
    {
      title: 'Cookies',
      body: 'Seti sets no advertising or analytics cookies and runs no third-party tracking. There is nothing to opt out of.',
    },
    {
      title: 'Your rights',
      body: 'Under Kenyan law you can ask for a copy of what we hold, correct it, or object to how we use it, and you can complain to the Data Protection Commissioner. Deleting your account does not remove records we must keep, or the on-chain record of your payments.',
    },
  ],
};
