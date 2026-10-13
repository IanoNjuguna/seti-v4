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
 * The action strip: the two things the home screen sends you away for.
 *
 * Deposit and Send live here rather than on the balance card. They used to be
 * buttons on the hero that opened panels *inside* it, which made the card two
 * things at once — the balance, and a menu — and made the panel responsible for its
 * own exit because the row that opened it was hidden while it was open. As tiles
 * they each sit on a page of their own with a Back control, and the hero is one
 * thing again.
 *
 * Pay is deliberately NOT here: `ScanPayCard` further down the home screen already
 * explains what a merchant link is and takes the name or the scan, so it is the
 * home screen's pay entry point and a second one would be two affordances for one
 * job. Activity is not here either — it is a tab in the app's own nav
 * (`AppNav` / `AppRail`), so a tile for it duplicated a tab on the same screen.
 */
export const QUICK_ACTIONS: QuickAction[] = [
  { key: 'deposit', label: 'Deposit', icon: 'add', href: '/app/deposit' },
  { key: 'send', label: 'Send', icon: 'send', href: '/app/send' },
];
