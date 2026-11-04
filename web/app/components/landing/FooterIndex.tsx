import { cn } from '@/lib/cn';
import type { FooterIndexProps } from './LandingFooter.types';

/**
 * The page's own table of contents, at the foot of the page.
 *
 * Numbered rows, each a link back to a band, each 44px tall (`min-touch`) so it is a
 * target and not a wordmark. The dotted leader is `aria-hidden` and grows to fill the
 * row: it is what makes four short labels read as one set rather than as a list, and
 * it is the same device a printed contents page uses. The number is mono
 * (`font-tabular`) so `01` and `04` are the same width and the labels start on one
 * edge — the alignment is the whole effect, and a proportional numeral breaks it.
 *
 * The rows brighten together on hover (`group`), label to `on-dark` and leader from
 * `hairline-dark` to `on-dark-mute`, over `--duration-quick`. No lift, no scale: this
 * is chrome, and `design/motion.md` keeps the landing's hover to a hairline and a 2px
 * lift at most.
 */
export function FooterIndex({ rows }: FooterIndexProps) {
  return (
    <nav aria-label="Sections" className="flex flex-col">
      {rows.map((row, index) => (
        <a
          key={row.id}
          href={`#${row.id}`}
          className={cn(
            'group flex min-touch items-center gap-4 rounded-sm py-2',
            'transition-colors duration-(--duration-quick) ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark'
          )}
        >
          <span aria-hidden className="font-tabular text-caption text-stone">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-body-md text-on-dark-mute transition-colors duration-(--duration-quick) group-hover:text-on-dark">
            {row.label}
          </span>
          <span
            aria-hidden
            className="h-px flex-1 bg-hairline-dark transition-colors duration-(--duration-quick) group-hover:bg-on-dark-mute"
          />
        </a>
      ))}
    </nav>
  );
}
