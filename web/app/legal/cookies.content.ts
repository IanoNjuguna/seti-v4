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
 * CloudFront video request, which does disclose an IP address to a third party
 * and is disclosed here on that basis.
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
      "The website sets no cookies of its own. We do not write cookies, do not read cookies, and do not use local or session storage to identify you.",
      "The Service relies on Privy, which manages authentication and your embedded wallet. Privy may set cookies or similar storage on the website when you sign in. These are set by Privy, not by Seti, and they are necessary to authenticate you and keep you signed in. Privy describes its own processing in its privacy policy.",
      "That is the complete list. If you have checked a cookie-reading tool on our site and found nothing advertising-shaped, that is correct and intended.",
    ],
  },
  {
    title: "Third-party requests the website makes",
    paragraphs: [
      "The marketing website loads one video asset from Amazon CloudFront, a content delivery network. Making that request necessarily discloses your IP address and browser information to CloudFront, so we disclose it here. The video is not accompanied by any tracking script, pixel, or beacon.",
      "The website loads no third-party scripts, no fonts from third-party providers, no embedded maps, no social media widgets, and no advertising tags.",
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
      "Browser controls. You can still block or delete cookies through your browser settings. Because we set no cookies ourselves, doing so will not prevent you from reading the marketing site, though it may affect sign-in if you use Privy authentication on the website.",
      "Blocking images and video. You can configure your browser to block images and video from third-party providers. This will stop the CloudFront video request described above, at the cost of the background video on our landing page.",
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
