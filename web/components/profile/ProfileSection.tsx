import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import type { ProfileSectionProps } from './ProfileSection.types';

/**
 * One row of the profile page: a heading, one line under it, then the control or the
 * account's own facts.
 *
 * The page is ROWS on the canvas, never cards. The rows are grouped by the system's
 * own hairline (`border-t border-hairline-light`) rather than by a bordered, rounded,
 * filled wrapper around a heading and a sentence — that wrapper is a surface drawn
 * around the page's own words, and this system has no shadow language to imply depth
 * with anyway (`design/revolut.md` §Elevation & Depth). Every row starts at the same
 * left edge, so the page reads as one column and never as a centred stack.
 *
 * The heading is `card-title` and the line under it is `micro` at the dim `secondary`
 * role, so the row's own words step down and whatever FIGURE the row carries — the
 * deposit address, the handle — is the one thing left at full contrast.
 */
export function ProfileSection({ icon, title, intro, children }: ProfileSectionProps) {
  return (
    <section className="border-t border-hairline-light pt-6">
      <div className="flex items-start gap-3">
        {/*
          * A 40px well, the same diameter the transaction rows use for their
          * medallion, so a mark on this page and a mark in Activity are the same
          * object at the same size. Decorative: the heading beside it is the name.
          */}
        {icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <Text variant="card-title" as="h2">
            {title}
          </Text>

          {intro ? (
            <Text variant="micro" as="p" color="secondary" className="mt-1">
              {intro}
            </Text>
          ) : null}
        </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
