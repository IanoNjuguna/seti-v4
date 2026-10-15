import type { IconName } from '@/components/ui/icon-paths.constants';

export interface QuickAction {
  key: string;
  label: string;
  icon: IconName;
  /**
   * Required, deliberately: every tile goes somewhere real. A destination that is
   * not built yet does not get a tile at all, because an inert tile reads as a
   * broken tap rather than as an unbuilt feature.
   */
  href: string;
}

/**
 * The action strip: the things the home screen sends you away for.
 *
 * Deposit and Send live here rather than on the balance card. They used to be
 * buttons on the hero that opened panels *inside* it, which made the card two
 * things at once — the balance, and a menu — and made the panel responsible for its
 * own exit because the row that opened it was hidden while it was open. As tiles
 * they each sit on a page of their own with a Back control, and the hero is one
 * thing again.
 *
 * The first tile is RECEIVE, which was `Deposit` until the two ways money arrives
 * were put on one page (`/app/receive`, by name and by address). The label follows
 * what the page answers: a person is not depositing this month's takings into
 * anything, they are being paid.
 *
 * Pay is the third tile. Paying a merchant is the premise the product is built on
 * and the first thing a funded account reaches for, so it belongs beside Receive
 * and Send rather than only behind a card further down — the strip is the row a
 * thumb finds without reading.
 *
 * `scan`, not `qr`, for that tile. The QR mark is the set's *illustration* glyph
 * (`EmptyActivity` at 56px, the receive card's code plate), and a copy of it on a
 * tile would read as the same object repeated rather than as a destination. The
 * viewfinder — corner brackets around a scan line — is a distinct silhouette next
 * to a plus and a paper plane, and it is the mark people already read as "scan to
 * pay". It is the set's existing `scan` glyph (`icon-paths.constants.ts`); no icon
 * markup was added for this tile.
 *
 * Recorded trade-off, now resolved the other way: a pay card used to sit on the
 * home screen explaining this tile's job, so Pay was kept out of this strip for a
 * while (two controls for one job). The owner asked for the tile, then moved the
 * card to the screen the tile opens, then deleted the card and folded its words
 * into that page's heading. Home has the action and nothing else; the explanation
 * lives on `/app/pay`, in the page's own voice.
 *
 * Activity is still not here: it is a tab in the app's own nav (`AppNav` /
 * `AppRail`), so a tile for it duplicated a tab on the same screen.
 */
export const QUICK_ACTIONS: QuickAction[] = [
  { key: 'receive', label: 'Receive', icon: 'add', href: '/app/receive' },
  { key: 'send', label: 'Send', icon: 'send', href: '/app/send' },
];
