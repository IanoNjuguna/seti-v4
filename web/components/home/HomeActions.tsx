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
 * No icons. The strip had an `add` and a `send` glyph, and at this size a glyph
 * beside a two-word label is decoration competing with the label; the words are
 * short enough to be the whole control.
 */
export function HomeActions({ actions = HOME_ACTIONS }: HomeActionsProps) {
  return (
    <nav aria-label={HOME_PAGE_COPY.actionsLabel} className="flex gap-3">
      {actions.map((action) => (
        <HomeAction key={action.key} action={action} />
      ))}
    </nav>
  );
}
