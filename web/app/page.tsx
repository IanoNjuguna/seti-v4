import { LandingBackdrop } from './components/landing/LandingBackdrop';
import { LandingNav } from './components/landing/LandingNav';
import { HeroSection } from './components/landing/HeroSection';
import { HowSection } from './components/landing/HowSection';
import { MoneySection } from './components/landing/MoneySection';
import { PartnersSection } from './components/landing/PartnersSection';
import { FeesSection } from './components/landing/FeesSection';
import { ClosingSection } from './components/landing/ClosingSection';
import { LandingFooter } from './components/landing/LandingFooter';

/**
 * The landing page: five bands, each its own component under
 * `components/landing/`, plus the two fixed layers the ambient motion spec
 * asks for.
 *
 * Bands alternate black → white → black → white → black so the word "band"
 * means something; the field shows through the three dark ones because none of
 * them paints a background of its own (the black canvas is the `body`).
 *
 * The page itself has no logic: every section owns its layout, its copy and its
 * tokens, and `page.tsx` is the order they are in.
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
