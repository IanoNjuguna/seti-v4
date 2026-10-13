/**
 * Canonical company + document metadata for Seti's legal pages.
 *
 * LEGAL REVIEW REQUIRED: `legalName`, `address`, `email`, and `domain` are
 * placeholders. They must be replaced with the registered entity details
 * before these pages are published. They are collected here so the placeholder
 * is greppable and cannot drift between the Terms and the Privacy Policy.
 */

export const SITE = {
  /** Placeholder — registered legal entity name. */
  legalName: "Seti",
  /** Placeholder — the App is operated by this entity. */
  entitySuffix: "",
  /** Placeholder — registered address. Required for Kenyan notice provisions. */
  address: "[Registered address]",
  /** Placeholder — public contact address for privacy requests and disputes. */
  email: "legal@seti.example",
  /** Placeholder — canonical production domain, used for internal links. */
  domain: "https://seti.example",
} as const;

/** Effective date of the currently published version of both documents. */
export const LEGAL_EFFECTIVE_DATE = "5 February 2026";

/** Contact address for formal notices under the Terms. */
export const NOTICES_EMAIL = "legal@seti.example";

export const PRIVACY_URL = "/privacy";
export const TERMS_URL = "/terms";
export const COOKIES_URL = "/cookies";
