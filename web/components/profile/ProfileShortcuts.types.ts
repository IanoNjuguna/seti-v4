import type { ReactNode } from 'react';
import type { IconName } from '@/components/ui/icon-paths.constants';

/** One of the two rows between the identity block and the settings list. */
export interface ProfileShortcut {
  key: string;
  /** What the row is called, in the customer's words. */
  title: string;
  /** One line saying what is behind it. */
  subtitle: string;
  href: string;
  /** The 40px mark: a line-only glyph from the app's own set. */
  icon: IconName;
}

export interface ProfileShortcutsProps {
  shortcuts?: readonly ProfileShortcut[];
  /**
   * A third destination whose row carries STATE rather than a fixed `href`, rendered
   * inside this list — today `ProfileInviteRow` (#145). Keeping it here means one
   * `divide-y` for the whole group, so the dynamic row shares the hairlines and the
   * left edge instead of starting a second list beside this one.
   */
  children?: ReactNode;
}
