import type { ReactNode } from 'react';
import type { IconName } from '@/components/ui/icon-paths.constants';

/**
 * One dense row of the profile page.
 *
 * The row is the page's only list unit: a settings row, a shortcut, a legal
 * document and a business all use it, so they share one left edge, one height
 * rhythm and one chevron position. Nothing here draws a card or a border of its
 * own. The hairlines BETWEEN rows belong to the list that holds them, which is
 * what keeps the separators from doubling at every seam.
 */
export interface ProfileRowProps {
  /** The row's own word: what this row is about. */
  title: string;
  /** The single fact the row carries, set down and to the right. */
  value?: string;
  /** One line under the title, when the row has to explain itself. */
  subtitle?: string;
  /** A destination. A row without one is a statement, and draws no chevron. */
  href?: string;
  /** The 40px mark a shortcut wears; settings rows carry none. */
  icon?: IconName;
  /** A control that belongs to the row, stacked under its words. */
  children?: ReactNode;
}
