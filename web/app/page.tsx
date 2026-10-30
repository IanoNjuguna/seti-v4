import { LandingBackdrop } from './components/landing/LandingBackdrop';
import { LandingNav } from './components/landing/LandingNav';
import { HeroSection } from './components/landing/HeroSection';
import { HowSection } from './components/landing/HowSection';
import { MoneySection } from './components/landing/MoneySection';
import { FeesSection } from './components/landing/FeesSection';
import { PartnersSection } from './components/landing/PartnersSection';
import { ClosingSection } from './components/landing/ClosingSection';
import { LandingFooter } from './components/landing/LandingFooter';

/**
 * The landing page: six bands, each its own component under
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
 * THE REFUSALS BAND IS OUT (#267). It was the newest band, between the integrations
 * row and the close, and it was the page's one argument by absence — what Seti will
 * not do — which cost a band of scroll, a menu entry and a palette jump to say three
 * things the rest of the page already says in its own voice. The component, its copy
 * and the two navigation entries that reached it are gone together, and
 * `npm run check:refusals --workspace web` keeps only the half of itself that was
 * never about the band: the backend holds no key that can move a customer's money,
 * and the sentences the product still shows hold the voice.
 *
 * WHAT THE DELETION COSTS, RECORDED RATHER THAN PATCHED. The band was `canvas-light`
 * between two dark ones, so the page now runs dark into dark at the foot: Partners
 * and the close share a canvas and no hairline separates them. Nothing in a
 * neighbouring band was restyled to cover it — repainting the close, or hanging a
 * border off it, is a design decision about the page's last two bands and not a
 * side effect this deletion gets to make on its own.
 *
 * The command palette's sections (`SEARCH_SECTIONS`) are the same six ids the bands
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
        <ClosingSection />
      </main>

      <LandingFooter />
    </div>
  );
}
