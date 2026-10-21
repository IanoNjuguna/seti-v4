import type { ReactNode } from 'react';
import type { IconName } from '@/components/ui/icon-paths.constants';

/**
 * One row of the profile page.
 *
 * `intro` is optional because the legal row is a heading and its links with nothing
 * to explain; every other row carries the page's own one-line sentence about what
 * the row is.
 */
export interface ProfileSectionProps {
  /**
   * The row's mark, when the row benefits from being recognised before it is read.
   *
   * Optional: a row whose heading is already a proper noun (`Security`) does not need
   * one, and a page of medallions is noise where a page of rows is a list.
   */
  icon?: IconName;
  /** The row's heading — the page's word for what the row is. */
  title: string;
  /** One line under the heading, in the page's voice, or omitted when there is none. */
  intro?: string;
  /** The control, or the account's own facts, that the row exists to show. */
  children?: ReactNode;
}
