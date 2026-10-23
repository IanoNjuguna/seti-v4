import { AUDIENCE_QUERY_KEY, parseAudience } from './components/landing/Audience.constants';
import { LandingBackdrop } from './components/landing/LandingBackdrop';
import { LandingNav } from './components/landing/LandingNav';
import { HeroSection } from './components/landing/HeroSection';
import { HowSection } from './components/landing/HowSection';
import { MoneySection } from './components/landing/MoneySection';
import { RefusalsSection } from './components/landing/RefusalsSection';
import { FeesSection } from './components/landing/FeesSection';
import { PartnersSection } from './components/landing/PartnersSection';
import { ClosingSection } from './components/landing/ClosingSection';
import { LandingFooter } from './components/landing/LandingFooter';

/**
 * The landing page: seven bands, each its own component under
 * `components/landing/`, plus the fixed layer the ambient spec asks for.
 *
 * IT NOW HAS TWO READERS, AND THE URL SAYS WHICH. `?for=business` renders the page
 * for a merchant and the bare path renders it for a person. This file's only job is
 * to read that answer ONCE, on the server, and hand it to the bands that change —
 * so no band reads a query string, no band can disagree with another about who the
 * page is for, and the copy a reader gets is decided before a byte of HTML is sent.
 *
 * WHY THE SERVER READS IT, rather than a client store or `useSearchParams`:
 *
 *  - **A shared link has to be correct for the person opening it.** `?for=business`
 *    pasted into a message must ARRIVE as business copy. A client-side read paints
 *    the personal variant first, then swaps, which is a visible flip on the exact
 *    visit that link was made for.
 *  - **There is nothing to hydrate differently.** The server renders markup for the
 *    URL it was asked for and the client hydrates that markup, so a mismatch is not
 *    something to be careful about: it cannot occur. Nothing here reads `window` or
 *    a clock during render.
 *  - **The alternative that keeps the page static does not exist safely.** This
 *    repo has already paid for the opposite mistake: `app/app/merchant/page.tsx`
 *    records that on a prerendered route the `searchParams` prop "is resolved once
 *    at build time and arrives EMPTY", and a `?kind=person` link silently claimed a
 *    business name. Awaiting it here is what makes the route dynamic, which is what
 *    makes the value real.
 *
 * WHAT THAT COSTS, stated plainly: `/` is `ƒ (Dynamic)` in the build output instead
 * of `○ (Static)`, so the page is rendered per request rather than served as a
 * prerendered file. The render is a constant tree with no I/O (every section is
 * static markup; the only client components are the nav, the reveals and the QR),
 * so the cost is the render itself and it buys a shareable, reload-safe audience.
 * The rejected option is in the PR: keep `/` static and resolve the audience in the
 * browser with `useSyncExternalStore`, at the price of one frame of the wrong
 * variant on exactly the visits that asked for business.
 *
 * The refusals band (`#refusals`) is the newest, between the integrations row and
 * the close: it says what Seti will not do, which is the one part of the trust
 * argument a screenshot of the product working cannot show (#133). It takes no
 * audience, because none of the three refusals changes with who is reading.
 *
 * The command palette's sections (`SEARCH_SECTIONS`) are the same seven ids in both
 * variants, so a jump works whichever reader is on the page.
 */
interface HomePageProps {
  /** The query string, as Next provides it: a Promise of the parsed params. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const audience = parseAudience(params[AUDIENCE_QUERY_KEY]);

  return (
    <div className="relative flex flex-1 flex-col">
      <LandingBackdrop />
      <LandingNav audience={audience} />

      <main className="relative flex flex-1 flex-col">
        <HeroSection audience={audience} />
        <HowSection audience={audience} />
        <MoneySection audience={audience} />
        <FeesSection audience={audience} />
        <PartnersSection />
        <RefusalsSection />
        <ClosingSection audience={audience} />
      </main>

      <LandingFooter />
    </div>
  );
}
