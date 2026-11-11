import { faqSchemas } from '@/lib/faq-schema';
import { LandingBackdrop } from './components/landing/LandingBackdrop';
import { LandingNav } from './components/landing/LandingNav';
import { HeroSection } from './components/landing/HeroSection';
import { HowSection } from './components/landing/HowSection';
import { WhoItsForSection } from './components/landing/WhoItsForSection';
import { YourCustomerSection } from './components/landing/YourCustomerSection';
import { MoneySection } from './components/landing/MoneySection';
import { FeesSection } from './components/landing/FeesSection';
import { SetupSection } from './components/landing/SetupSection';
import { FaqSection } from './components/landing/FaqSection';
import { PartnersSection } from './components/landing/PartnersSection';
import { ClosingSection } from './components/landing/ClosingSection';
import { LandingFooter } from './components/landing/LandingFooter';

/**
 * The landing page: nine bands, each its own component under
 * `components/landing/`, plus the fixed layer the ambient spec asks for.
 *
 * THE ORDER IS THE READER'S ORDER, AND `who` SITS NEXT TO `how` ON PURPOSE: a reader who
 * has just understood the mechanics needs to know whether this is for them, so the two new
 * bands (`who it is for`, `what your customer does`) run between `how` and `money`, and the
 * questions follow the price list because the fee is the next thing a reader asks about.
 * The bands in order are hero, how, who it is for, what your customer does, money, fees,
 * questions, partners, close.
 *
 * THE TWO NEW BANDS ARE LIGHT, and that is what keeps `MoneySection`'s own record true: it
 * is the first dark band after the hero, so painting either new band `canvas-dark` would
 * have put a black band directly above another black one and made that sentence false.
 * The run from `how` to `what your customer does` is therefore one catalogue stretch,
 * separated by the same top hairline each of those bands carries.
 *
 * THE QUESTIONS BAND IS THE PAGE'S ONLY MACHINE-READABLE BAND: its `h2`, its `h3`s and its
 * answers are in the server HTML, and `web/lib/faq-schema.ts` builds the `FAQPage` node for
 * the layout's `@graph` out of the same constants. See `FaqSection` and `FaqItem` for why
 * nothing there is a disclosure.
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
 * WHAT THE DELETION COST, AND WHAT #540 DID ABOUT IT. The band was `canvas-light`
 * between two dark ones, so the page ran dark into dark at the foot: Partners and the
 * close shared a canvas with no hairline between them. That was recorded rather than
 * patched, because repainting the close or hanging a border off it is a design decision
 * about the page's last two bands and not a side effect a deletion gets to make on its
 * own. #540 is that decision, taken deliberately: both bands now carry
 * `border-t border-hairline-dark`, so the foot of the page is separated the way every
 * other boundary is. The page's rhythm is no longer "one band per slide" either: `how`
 * opens on its object, `who` opens on its sentence at display scale, `customer` opens on a
 * margin note, `fees` is an inset panel and `money`'s row runs wider than every other band.
 * The band order, the copy and the palette are unchanged.
 *
 * The command palette's sections (`SEARCH_SECTIONS`) are the same six ids the bands
 * render, so a jump lands on a band whichever way the reader got here. The three new
 * bands carry ids of their own (`#who`, `#customer`, `#questions`) that any link can
 * reach; their absence from the palette's list is deliberate, because adding a row there
 * is a navigation decision and not a side effect of a copy change.
 */
export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      {/* `landing-page-design` B10: a keyboard user reaches the content without tabbing
          the nav. First focusable element on the page, invisible until focused, and it
          targets the `main` below, which carries the matching id. The landing had none. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-canvas-light focus:px-4 focus:py-3 focus:text-body-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <LandingBackdrop />
      <LandingNav />

      <main id="main" tabIndex={-1} className="relative flex flex-1 flex-col outline-none">
        <HeroSection />
        <HowSection />
        <WhoItsForSection />
        <YourCustomerSection />
        <MoneySection />
        <FeesSection />
        <SetupSection />
        <FaqSection />
        <PartnersSection />
        <ClosingSection />
      </main>

      {/* The FAQ node belongs to THIS document, not to the root layout: it describes the
          nine questions the band above renders, and publishing it from `layout.tsx` put it
          on every route, including the pages that show no questions at all (#306). The
          strings are the band's own constants, so the two cannot drift. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': faqSchemas }),
        }}
      />

      <LandingFooter />
    </div>
  );
}
