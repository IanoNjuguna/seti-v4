import { Text } from '@/components/ui';
import { EMPTY_ACTIVITY_COPY } from './EmptyActivity.constants';

/**
 * The empty state: one sentence, on the canvas. No card.
 *
 * An empty state has no object to plate, so there is nothing for a surface to
 * hold. It used to be a `surface-soft` well (`rounded-md`, 40px of padding) with
 * a round icon medallion, a title and a paragraph inside — a card drawn around
 * words, under a heading ("Recent activity" / "Activity") that already said what
 * the list was. Two treatments of one idea is how the two drift, so the well,
 * the medallion and the title are gone and `EMPTY_ACTIVITY_COPY.message` stands
 * as page text (`body` + `secondary`, the same roles every other caption on the
 * page uses).
 *
 * It stays `secondary` and 16px rather than `micro`/`stone`: this is the only
 * prose a brand-new account reads, and `stone` on white is 2.9:1 — below AA for
 * body text, and it made the one explanation on the screen look like metadata.
 *
 * It is the SAME block both screens render, imported by `ActivityStates` rather
 * than re-drawn, because "nothing has moved yet" is one idea with one voice: on
 * the home screen it sits under the "Recent activity" heading, on Activity under
 * "Activity". It carries no margin of its own — the section's header-to-content
 * step belongs to whichever page stacks it.
 */
export function EmptyActivity() {
  return (
    <Text variant="body" color="secondary" as="p">
      {EMPTY_ACTIVITY_COPY.message}
    </Text>
  );
}
