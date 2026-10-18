import { BrandMark } from '@/components/ui';
import { FOOTER_COPYRIGHT, FOOTER_LINKS, FOOTER_ORIGIN } from './LandingFooter.constants';

/**
 * The footer — `footer` from `design/revolut.md`: dark canvas, `on-dark-mute`
 * copy, `body-sm`, a hairline above it.
 *
 * Three parts on one line: the mark and the copyright on the left, "Made in
 * Thika" on the band's exact centre, the legal links on the right. The centre
 * item is deliberate placement this time, not the stranded middle of the
 * `justify-between` row this footer used to be, where the middle item's
 * position moved with the width of the two outer ones. A three-column grid
 * gives the middle column a real address, and the mark, the centre line and the
 * links all sit on one vertical centre (`items-center`).
 *
 * The single row starts at `md`, not `sm`: at 640px a third of the container is
 * about 197px and the three legal links alone want most of that, so the band
 * stays stacked until 768px, where a third is 240px.
 *
 * THE TREASURY BLOCK IS GONE. The address block that used to sit at the bottom of
 * this footer — and the fee band's link down to it — were both deleted. It was
 * the page's one independently checkable claim (the address the 2% is collected
 * to, verifiable on chain), and removing it costs the page the only thing a
 * reader could go and confirm for themselves; the fee statement in the band above
 * now stands unverified. That was the owner's call, recorded here so the loss is
 * visible to whoever reads this next rather than discovered as a surprise.
 *
 * It stays on the black canvas rather than switching to white, and it is flushed
 * to `canvas-dark` — true #000 — so it joins the closing band as flat black
 * instead of showing the drift through it: the field's lift belongs to the hero
 * alone.
 */
export function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-hairline-dark bg-canvas-dark">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:grid md:grid-cols-3 md:items-center">
          <div className="flex items-center gap-4">
            <BrandMark expression="neutral" canvas="dark" label="Seti" className="h-8" />
            <p className="text-body-sm text-on-dark-mute">{FOOTER_COPYRIGHT}</p>
          </div>

          <p className="text-body-sm text-on-dark-mute md:text-center">{FOOTER_ORIGIN}</p>

          <nav aria-label="Legal" className="flex gap-6 md:justify-end">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-sm text-body-sm font-semibold text-on-dark-mute underline-offset-4 transition-colors duration-(--duration-quick) ease-out hover:text-on-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
