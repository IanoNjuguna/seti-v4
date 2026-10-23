import { cn } from '@/lib/cn';
import { SectionEyebrow } from './SectionEyebrow';
import type { SectionHeaderProps } from './SectionHeader.types';

/**
 * Every band's first three lines: the marker, the heading, and one sentence.
 *
 * The heading is `text-display-md` (40px, weight 500) from `sm` up, which is the
 * same 40px cash.app sets its section headings in. The step down to 32px on a
 * phone is this system's `heading-lg`; the reference drops its headings on small
 * screens too, and 40px of Poppins at 360px with a 24px gutter is a heading that
 * fills its line and loses its rag.
 *
 * The lede is `text-body-lg` (18px), the reference's own body size for a band's
 * one-line intro, and it is capped at `max-w-xl` so it stays one or two lines
 * instead of running the width of the band and reading as a paragraph of
 * marketing.
 *
 * `trailing` is the slot for whatever a band wants on its right edge at the same
 * baseline as the lede (`md:items-end` puts both on the band's bottom margin).
 * An empty slot costs nothing because nothing renders in it.
 */
export function SectionHeader({
  eyebrow,
  title,
  lede,
  onDark = false,
  trailing,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-12">
      <div className="max-w-2xl">
        <SectionEyebrow label={eyebrow} onDark={onDark} />

        <h2
          className={cn(
            'mt-6 font-brand text-heading-lg font-medium sm:text-display-md',
            onDark ? 'text-on-dark' : 'text-ink'
          )}
        >
          {title}
        </h2>

        {lede ? (
          <p
            className={cn(
              'mt-4 max-w-xl text-body-lg',
              onDark ? 'text-on-dark-mute' : 'text-mute'
            )}
          >
            {lede}
          </p>
        ) : null}
      </div>

      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
