/**
 * The Terms of Use version in force — the ONE source both sides read.
 *
 * Two places must agree about which terms version a customer accepted, and they
 * are in different packages:
 *
 *   1. the terms copy the customer reads before ticking the box at sign-up, and
 *   2. the server, which records the accepted version on the account's audit row.
 *
 * If those two are separate constants they drift the first time the terms are
 * revised — the page starts showing one version while the server keeps recording
 * the other, and the audit trail silently becomes a record of an agreement
 * nobody was shown. So there is one file, here, and the web app imports it
 * rather than restating it (see `web/app/legal/site.ts`).
 *
 * WHY IT LIVES IN `backend/src`: this module is compiled into the backend image
 * (`backend/Dockerfile` copies `backend/` and `backend/dist` only) and read at
 * runtime by `services/consent.ts`, so it MUST ship inside the backend. The web
 * app is the side that reaches across, because it already builds from the repo,
 * whereas a backend process reaches nothing outside its own directory in the
 * deployed image.
 *
 * THIS MODULE MUST STAY A LEAF. It is imported into the web bundle, so it may
 * import nothing — no `env`, no prisma, no node built-ins. A dependency here
 * would drag the backend's runtime into the browser build.
 *
 * BUMPING THE TERMS means editing `version` and `effectiveDate` together here
 * and nowhere else. The version is what is RECORDED; the date is what is
 * DISPLAYED on the legal pages. Both are stated together so a revision cannot
 * update one and forget the other.
 */

/**
 * The machine-readable version of the terms in force.
 *
 * An ISO date rather than a counter: a revision of the terms is a date, and a
 * stored date says when the text a customer accepted was in force without a
 * second lookup. This is the value written to `audit_logs.metadata.termsVersion`.
 */
export const TERMS_VERSION = '2026-02-05';

/**
 * The same revision as it is printed on the legal pages ("Effective <date>").
 *
 * Deliberately not derived from `TERMS_VERSION` by formatting: a legal document
 * renders its effective date as it was published, and an `Intl` format would put
 * a locale- and timezone-dependent string in a place that must be byte-stable
 * across every render, SSR and prerender included.
 */
export const TERMS_EFFECTIVE_DATE = '5 February 2026';
