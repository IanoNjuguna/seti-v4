import type { ReactNode } from 'react';

/**
 * One row of the profile page.
 *
 * `intro` is optional because the legal row is a heading and its links with nothing
 * to explain; every other row carries the page's own one-line sentence about what
 * the row is.
 */
export interface ProfileSectionProps {
  /** The row's heading — the page's word for what the row is. */
  title: string;
  /** One line under the heading, in the page's voice, or omitted when there is none. */
  intro?: string;
  /** The control, or the account's own facts, that the row exists to show. */
  children?: ReactNode;
}
