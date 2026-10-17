import { TERMS_EFFECTIVE_DATE } from '@/lib/legal/terms';
import { SITE_ORIGIN } from '@/lib/site';

/**
 * Canonical metadata for Seti's legal pages.
 *
 * `domain` is READ from `lib/site.ts`, which resolves it from
 * `NEXT_PUBLIC_SITE_ORIGIN` and falls back to the origin the product is served
 * from. It used to be a `seti.example` placeholder, which the Privacy Policy
 * printed to every reader: a legal document naming a domain that does not exist
 * is worse than one naming none.
 *
 * The three below cannot be derived from this repository, so they are marked
 * with a bracketed placeholder instead of being invented. They are collected
 * here so the gap is greppable, visible on the rendered page, and the same in
 * every document.
 */

/** Placeholder: the registered company that operates Seti. */
export const LEGAL_ENTITY = "[[LEGAL ENTITY]]";

/** Placeholder: that company's registered address. */
export const REGISTERED_ADDRESS = "[[REGISTERED ADDRESS]]";

/** Placeholder: the address for privacy requests, formal notices and account closure. */
export const CONTACT_EMAIL = "[[CONTACT EMAIL]]";

export const SITE = {
  /**
   * The company name, which is the placeholder above. It is NOT the product
   * name: `Seti` is what the app is called, and a document that prints "Operator:
   * Seti" has answered a question about a register with a brand.
   */
  legalName: LEGAL_ENTITY,
  /** Placeholder — the App is operated by this entity. */
  entitySuffix: "",
  /** Placeholder — registered address. */
  address: REGISTERED_ADDRESS,
  /** Placeholder — contact address for privacy requests and disputes. */
  email: CONTACT_EMAIL,
  /** The origin this deployment is served from. Read, not restated. */
  domain: SITE_ORIGIN,
} as const;

/**
 * Effective date of the currently published version of all three documents.
 *
 * READ, not restated: it comes from `@/lib/legal/terms`, the web app's single
 * import of `backend/src/legal/terms.ts`. That module is also what the backend
 * records as the accepted version at sign-up, so the date printed on this page
 * and the version on the audit row are the same value by construction — a
 * revision cannot update one and leave the other behind.
 */
export const LEGAL_EFFECTIVE_DATE = TERMS_EFFECTIVE_DATE;

/** Contact address for formal notices under the Terms. */
export const NOTICES_EMAIL = CONTACT_EMAIL;

export const PRIVACY_URL = "/privacy";
export const TERMS_URL = "/terms";
export const COOKIES_URL = "/cookies";
