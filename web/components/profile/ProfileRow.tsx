import Link from 'next/link';
import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { ProfileRowProps } from './ProfileRow.types';

/**
 * One row of the profile page, dense and on the canvas.
 *
 * The row is a NAME, at most one fact beside it, at most one line under it, and a
 * chevron only when it leads somewhere. That is the whole vocabulary: the previous
 * page repeated all four (heading, an explanatory sentence, a control, and a mark)
 * on every section, which is why its labels read like rows and the rows read like
 * cards. What the row leaves out is the point: the facts that are not here are in
 * the document behind the chevron.
 *
 * A row that navigates is the LINK, not a link wrapped around a row: one control
 * per destination, so a keyboard user tabs through it once. The inset padding is
 * on the link so its hover and focus box has an edge to sit inside, and the
 * negative margin gives the words back their shared left edge.
 */
export function ProfileRow({ title, value, subtitle, href, icon, children }: ProfileRowProps) {
  const content = (
    <>
      {icon ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col">
        <Text variant="card-title" as="span">
          {title}
        </Text>

        {subtitle ? (
          <Text variant="micro" as="span" color="secondary">
            {subtitle}
          </Text>
        ) : null}
      </span>

      {value ? (
        <Text variant="micro" as="span" color="secondary" className="max-w-[45%] shrink-0 break-words text-right">
          {value}
        </Text>
      ) : null}

      {href ? <Icon name="chevronRight" className="h-5 w-5 shrink-0" /> : null}

      {children ? <span className="mt-3 block w-full">{children}</span> : null}
    </>
  );

  const layout = 'flex flex-wrap items-center gap-x-3 gap-y-1 py-3.5';

  if (!href) {
    return <div className={layout}>{content}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        '-mx-2 rounded-md px-2 transition-colors hover:bg-surface-soft',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        layout
      )}
    >
      {content}
    </Link>
  );
}
