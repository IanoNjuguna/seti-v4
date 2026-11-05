import { Text } from '@/components/ui';
import { HomeAction } from './HomeAction';
import { HOME_ACTIONS } from './HomeActions.constants';
import { HOME_PAGE_COPY } from './HomePage.constants';
import type { HomeActionsProps } from './HomeActions.types';

/**
 * Home's action pair: `Pay` and `Receive`, equal halves, full width.
 *
 * They replace a strip of icon wells, and the reason is hierarchy rather than
 * taste. A 48px well with a 13px label under it is the shape of a SHORTCUT — an
 * app's secondary furniture — and these two are the only things an account is
 * opened for. Equal widths, one row, at the system's button height: the geometry
 * says "these are the two doors" before a word is read.
 *
 * A `<nav>` with its own name, because this is a set of destinations and it is the
 * second navigation on the screen (the rail is the first); an unlabelled group of
 * links is announced as links with no context.
 *
 * THE ICONS ARE BACK, and the paragraph that removed them stays here because it was
 * right about its own case (#328). With two doors and short labels, a glyph beside the
 * word competed with it. With four — pay, receive, save, swap — the row is a set, and a
 * set is what a glyph is for: it separates an exchange from a verb at a glance, which
 * four words in one weight cannot. What did NOT come back is the strip's other habit:
 * the label stays under every glyph, because at 20px `send`, `scan` and two arrows do not
 * distinguish paying from receiving from exchanging, so the meaning stays in the word.
 */
export function HomeActions({ actions = HOME_ACTIONS }: HomeActionsProps) {
  return (
    <nav aria-label={HOME_PAGE_COPY.actionsLabel} className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <HomeAction key={action.key} action={action} />
      ))}
    </nav>
  );
}
