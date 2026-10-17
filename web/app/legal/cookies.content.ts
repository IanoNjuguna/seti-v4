import { SITE, LEGAL_EFFECTIVE_DATE, PRIVACY_URL, TERMS_URL } from "./site";
import type { LegalSection } from "./LegalDocument";

/**
 * Cookie Notice, written from what the site actually stores.
 *
 * NOT an adaptation of a template. The cookie categories a template carries
 * (advertising, analytics, social, Flash, session replay, the ad-industry
 * opt-out lists) do not exist here, and disclosing them would describe data
 * flows the product does not have. What is left is one real category, plus the
 * device storage the app's own session lives in.
 *
 * Every entry below is a key in this repository, not a guess:
 *
 *  - `seti-auth-token`, `seti-auth-user` — `web/lib/auth/auth.constants.ts`,
 *    written by `auth.storage.ts`.
 *  - `seti-sound-muted` — `web/lib/sound.ts`.
 *  - Balance visibility is NOT stored: `web/components/home/useBalanceVisibility.ts`
 *    keeps it in memory on purpose, so it resets on reload. The previous version
 *    of this notice listed it as a stored preference. It is not one.
 *  - No third-party media: the landing backdrop is CSS
 *    (`app/components/landing/LandingBackdrop.tsx`) and `public/` holds no video.
 *  - Typefaces are served from this domain by `next/font`, not fetched from a
 *    font host by the browser (`web/app/layout.tsx`).
 *
 * LEGAL REVIEW REQUIRED before this is treated as final.
 */

const intro = [
  `This notice says what Seti stores in your browser, and what it does not. It covers the website at ${SITE.domain} and the Seti app.`,
  "The short version: we set no cookies of our own, run no analytics, and load nothing that follows you across other sites.",
];

const sections: LegalSection[] = [
  {
    title: "1. What we set",
    paragraphs: [
      "Nothing. Seti sets no cookies on the website and reads none. There is no analytics cookie, no advertising cookie and no social media cookie.",
      "There is also no analytics product, no session recorder, no heat map and no advertising pixel on this site.",
    ],
  },
  {
    title: "2. What stays in your browser",
    paragraphs: [
      "Your browser's local storage holds three things, and nothing else is kept. Hiding your balance is not remembered: it goes back to shown the next time you load the page. Signing out clears the first two entries. These are the keys, exactly as they are stored:",
    ],
    clauses: [
      "seti-auth-token: the token that keeps you signed in. Strictly necessary; without it you would be signed out on every page.",
      "seti-auth-user: a copy of the account details that go with that session. It is only a cache, and it is checked with the server on every load.",
      "seti-sound-muted: whether you muted the app's sound. Your choice, used only to decide whether to play it.",
    ],
  },
  {
    title: "3. The one thing that is not ours",
    paragraphs: [
      "Signing in runs on Privy, and Privy keeps its own session in its own storage. That is Privy's, not yours to find here, and Privy describes it in its own privacy policy.",
      "It is strictly necessary to sign in: without it you could not stay signed in at all.",
    ],
  },
  {
    title: "4. What the site loads",
    paragraphs: [
      "No third-party scripts, and no fonts fetched from another domain: the typefaces are served from this site.",
      "No video, no embedded map, no social media widget, no advertising tag. The background on the home page is drawn by the page itself, so there is no media request to anyone else.",
      "The requests your browser makes for these pages go to the site you are already on.",
    ],
  },
  {
    title: "5. Your choices",
    paragraphs: [
      "There is no consent banner, because there is nothing non-essential to consent to. If you ever see one on this site, something has been added that this notice has not caught up with. Tell us.",
      "You can block or clear cookies and site storage in your browser. Reading the marketing pages still works, but clearing the site's storage signs you out, because that is where your session lives.",
      "Blocking images removes the artwork on the marketing pages. There is no video to block.",
    ],
  },
  {
    title: "6. Changes to this notice",
    paragraphs: [
      "If we add a cookie, a tracking script or an analytics product, we update this notice and ask for your consent first where the law requires it. Until then, there is nothing here to opt out of.",
    ],
  },
  {
    title: "7. Related documents",
    paragraphs: [
      `Our Privacy Policy is at ${PRIVACY_URL} and our Terms of Use at ${TERMS_URL}. Both describe what the service handles, including the payment records that are permanent and public on Tempo.`,
      `Questions about this notice: ${SITE.email}.`,
    ],
  },
];

const footnote =
  "This notice lists what the site stores as built at the date above: three local storage entries, no cookies of its own, and no tracking. It was written from the product itself and still needs a lawyer's review before it is treated as final.";

export const cookiesContent = {
  title: "Cookie Notice",
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro,
  sections,
  footnote,
};
