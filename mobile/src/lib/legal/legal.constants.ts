/**
 * Canonical legal constants for the mobile app.
 *
 * The full Terms and Privacy Policy live on the website at /terms and /privacy.
 * The app shows a plain-language summary (see legal.constants.ts) plus a link to
 * the full text, because the full documents are too long to usefully render in a
 * phone screen and a summary that silently differs from the binding document is
 * a compliance risk in itself.
 *
 * LEGAL REVIEW REQUIRED: `company`, `address`, `contactEmail` and `legalBaseUrl`
 * are placeholders and must be replaced with the registered entity details.
 */

export const LEGAL = {
  company: 'Seti',
  address: '[Registered address]',
  contactEmail: 'legal@seti.example',
  /** Base URL of the website hosting the full documents. */
  legalBaseUrl: 'https://seti.example',
  effectiveDate: '5 February 2026',
  termsPath: '/terms',
  privacyPath: '/privacy',
  cookiesPath: '/cookies',
} as const;

export const TERMS_URL = `${LEGAL.legalBaseUrl}${LEGAL.termsPath}`;
export const PRIVACY_URL = `${LEGAL.legalBaseUrl}${LEGAL.privacyPath}`;
export const COOKIES_URL = `${LEGAL.legalBaseUrl}${LEGAL.cookiesPath}`;

/** Storage key for the recorded consent record. */
export const CONSENT_STORAGE_KEY = 'seti-legal-consent';

/**
 * Version of the in-app summary. Bumping this re-prompts users whose recorded
 * consent is at an older version, so a material change to the documents forces
 * a fresh acceptance rather than relying on the old one.
 */
export const CONSENT_VERSION = 1;
