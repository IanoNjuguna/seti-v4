import type { FooterLegalProps } from './LandingFooter.types';

/**
 * The legal links, right-aligned on the desktop grid and stacked under the index on
 * a phone.
 *
 * THE LINKS ARE TAP TARGETS, NOT WORDMARKS, and that finding survives the rebuild: they
 * rendered at their text height once (20px, measured), under the 44px floor the design
 * system keeps everywhere else. `min-touch` and `inline-flex items-center` give each one
 * a 44px box without moving its label, and the display has to change with `min-height`
 * because an inline `<a>` ignores it (ui-skills review, #274).
 *
 * Privacy, terms and cookies are the three that are legally load-bearing; the `legal/`
 * routes they point at are the same three the rest of the site links.
 */
export function FooterLegal({ links }: FooterLegalProps) {
  return (
    <nav aria-label="Legal" className="flex flex-col gap-1 md:items-end">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-on-dark-mute underline-offset-4 transition-colors duration-(--duration-quick) ease-out hover:text-on-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
