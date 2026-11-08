import { Text } from '@/components/ui';
import { PageBack } from './PageBack';

export interface PageHeaderProps {
  /** The page's own heading. It is the `h1` the surface is named by. */
  title: string;
  /** Where Back lands. The home tab by default. */
  href?: string;
  /** The accessible name of the back control. */
  label?: string;
  /**
   * `start` puts the control and the heading on one left-aligned row; `center` keeps the heading
   * centred with the control on the row's leading edge, which is the only way a centred heading
   * and a back control can share a line.
   */
  align?: 'start' | 'center';
}

/**
 * A full-page surface's title bar: the back control and the heading, on ONE row.
 *
 * This exists because the two used to be separate rows (#438). `PageBack` sat above the `h1` and
 * cost 44px of control plus the column's gap before the title appeared, on every page that is not
 * a tab: send, receive, invite, and save's signed-out state. The references put the two together,
 * and it is the only treatment that costs no vertical space: Kiwi.com's `( ← ) Request refund` and
 * Reddit's circle plus `Guides` are both one row.
 *
 * The control sits on the content's left edge and the heading follows it, which indents the heading
 * by the circle's width plus the gap. That is deliberate and it matches Kiwi: the rule being kept
 * is that the CONTROL aligns with the column, not that the heading does, because the control is the
 * thing a thumb reaches for and the heading moves down the page anyway.
 *
 * Centred layouts (`align="center"`) keep the heading optically centred and place the control on the
 * row's leading edge, absolutely, so the heading does not shift off-centre by the control's width.
 */
export function PageHeader({ title, href, label, align = 'start' }: PageHeaderProps) {
  if (align === 'center') {
    return (
      <div className="relative flex items-center justify-center">
        <div className="absolute left-0">
          <PageBack href={href} label={label} />
        </div>
        <Text variant="section" as="h1">
          {title}
        </Text>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <PageBack href={href} label={label} />
      <Text variant="section" as="h1">
        {title}
      </Text>
    </div>
  );
}
