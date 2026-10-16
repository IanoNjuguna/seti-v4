import { SITE, LEGAL_EFFECTIVE_DATE, PRIVACY_URL, TERMS_URL } from "./site";
import type { LegalSection } from "./LegalDocument";

/**
 * Cookie Notice, adapted from the General Legal CC0 Cookie Notice template for
 * Seti.
 *
 * Most of the template is inapplicable and was cut rather than left in as
 * inaccurate boilerplate: Flash and Flash LSOs (Flash is dead), FullStory
 * session replay (never deployed), the Advertising / Analytics / Social cookie
 * categories with their vendor columns (no such cookies exist), and the
 * Network Advertising Initiative / Digital Advertising Alliance / AppChoices
 * opt-out instructions (there is no interest-based advertising to opt out of).
 *
 * What remains is the one category that is real — essential cookies — plus the
 * device storage the site's own session lives in, which is named below because
 * the rules cover storage and not only cookies.
 *
 * NO CDN VIDEO. This notice used to disclose "one video asset from Amazon
 * CloudFront". There is no such asset: the landing page's backdrop is CSS only
 * (`app/components/landing/LandingBackdrop.tsx` replaced the stock coin video
 * with two transform-only layers), `public/` holds no video file, and no source
 * file requests a third-party media host. Disclosing a request the site does not
 * make is not the safe direction — it describes a data flow that does not exist
 * and hides the ones that do.
 *
 * DEVICE STORAGE, NOT JUST COOKIES. The rules cover cookies and similar
 * technologies, and this site keeps its session in `localStorage` rather than in
 * a cookie (`web/lib/auth/auth.storage.ts`), so the notice names that storage
 * explicitly. The earlier wording claimed the site did not "use local or session
 * storage to identify you", which was false — the stored token and user object do
 * exactly that — and a notice that denies what a browser's storage inspector
 * plainly shows is worse than one that says nothing.
 *
 * LEGAL REVIEW REQUIRED before publishing.
 */

const intro = [
  `This Cookie Notice explains what cookies and similar technologies ${SITE.legalName} ("Seti", "we", "us") uses on the website at ${SITE.domain} and in the Seti mobile application (together, the "Service").`,
  `The short version: Seti does not use advertising, analytics, or tracking cookies, and does not run third-party advertising or tracking scripts. There is nothing here for you to opt out of, because there is nothing tracking you across sites.`,
  `Adapted from a public legal template published by General Legal under CC0 1.0. Not reviewed by a Kenyan attorney.`,
];

const sections: LegalSection[] = [
  {
    title: "What we actually set",
    paragraphs: [
      "The website sets no cookies of its own: we do not write cookies and we do not read them.",
      "The site does keep a session on your device, and it is not a cookie. When you sign in, the token that keeps you signed in, and a copy of the account details that go with it, are stored in your browser's local storage. That storage is strictly necessary — without it you would be signed out on every page load — and it identifies your account to the site, so we are naming it here rather than leaving it out.",
      "Two preferences you choose are remembered the same way: whether sound is muted, and whether your balance is hidden. Both are set by you, on your device, and are used only to render the site the way you asked for it.",
      "The Service also relies on Privy, which manages authentication and your embedded wallet. Privy may set cookies or similar storage on the website when you sign in. These are set by Privy, not by Seti, and they are necessary to authenticate you and keep you signed in. Privy describes its own processing in its privacy policy.",
      "That is the complete list. If you have checked a cookie-reading tool on our site and found nothing advertising-shaped, that is correct and intended.",
    ],
  },
  {
    title: "Third-party requests the website makes",
    paragraphs: [
      "The marketing website loads no video and no media from a third-party content delivery network. Its background is drawn in CSS by the page itself, so there is no media request to disclose and no provider receiving an IP address for one.",
      "The website loads no third-party scripts, no fonts from third-party providers — the typefaces are served from this domain — no embedded maps, no social media widgets, and no advertising tags. The requests a visitor's browser makes to read the marketing pages are for files served from the domain they are already on.",
    ],
  },
  {
    title: "The mobile application",
    paragraphs: [
      "The app does not track you across other apps or websites, and contains no advertising or analytics SDK.",
    ],
  },
  {
    title: "Your choices",
    paragraphs: [
      "Because Seti does not set advertising or analytics cookies, there is no consent banner to interact with and no preference dashboard to manage. If you see a cookie banner on our site in future, that is a sign we have added non-essential tracking and have not yet updated this notice — please tell us.",
      "Browser controls. You can still block or delete cookies and site storage through your browser settings. Because we set no cookies ourselves, doing so will not prevent you from reading the marketing site — but deleting the site's local storage will sign you out, because that is where your session is kept.",
      "Blocking images. You can configure your browser to block images, which will remove the artwork on the marketing pages. There is no video to block: the landing page's backdrop is drawn in CSS by the page itself.",
    ],
  },
  {
    title: "Changes to this notice",
    paragraphs: [
      "If Seti adds any non-essential cookie, SDK, or tracking technology, we will update this notice and, where the law requires it, ask for your consent before deploying it. You do not currently need to consent to anything on our site.",
    ],
  },
  {
    title: "Related documents",
    paragraphs: [
      `Our Privacy Policy is available at ${PRIVACY_URL} and our Terms of Use at ${TERMS_URL}. Both describe the personal information the Service handles, including the transaction records that are permanent and public on the blockchain.`,
      `Questions about this notice: ${SITE.email}.`,
    ],
  },
];

const footnote = `Adapted from legal templates by General Legal, used under CC0 1.0 Universal. This document is a draft and has not been reviewed by a qualified Kenyan attorney. It accurately describes the site as built at the effective date above; it is not a commitment about future changes.`;

export const cookiesContent = {
  title: "Cookie Notice",
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro,
  sections,
  footnote,
};
