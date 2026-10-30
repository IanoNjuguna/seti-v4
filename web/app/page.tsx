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
 * ONE READER, AND NO CONTROL TO CHOOSE ANOTHER. The page used to serve two readings
 * from one URL — `?for=business` for a merchant, the bare path for a person — with a
 * Personal | Business switcher in the navbar, and this file's whole job was to read
 * that answer ONCE, on the server, and hand it to the bands that changed. The owner
 * took the switcher out: a visitor is deciding whether to use the product, not which
 * of two brochures to read, and the merchant's reading is the one that names what the
 * page is for. So the bands take no reader, no band reads a query string, and there is
 * nothing on the page that can disagree with another band about who is reading.
 *
 * WHAT THAT BUYS BACK: `/` is a static route again (`○` in the build output) instead
 * of being rendered per request for a parameter nothing reads. The old comment here
 * recorded the opposite trade — a shareable `?for=business` at the cost of a dynamic
 * render — and both halves of it are gone together. A stale `?for=business` in an old
 * link still opens this page: an unread query parameter is not an error.
 *
 * The refusals band (`#refusals`) is the newest, between the integrations row and
 * the close: it says what Seti will not do, which is the one part of the trust
 * argument a screenshot of the product working cannot show (#133).
 *
 * The command palette's sections (`SEARCH_SECTIONS`) are the same seven ids the bands
 * render, so a jump lands on a band whichever way the reader got here.
 */
export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      <LandingBackdrop />
      <LandingNav />

      <main className="relative flex flex-1 flex-col">
        <HeroSection />
        <HowSection />
        <MoneySection />
        <FeesSection />
        <PartnersSection />
        <RefusalsSection />
        <ClosingSection />
      </main>

      <LandingFooter />
    </div>
  );
}
