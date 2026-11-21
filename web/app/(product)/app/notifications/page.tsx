import type { Metadata } from 'next';
import { NotificationsScreen } from '@/components/notifications/NotificationsScreen';

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
};

/**
 * The bell's destination (#592).
 *
 * A route, not a panel: the list is the surface, and a popover of money that arrived would
 * need its own scroll, empty state and failure state inside a corner of the chrome.
 */
export default function NotificationsPage() {
  return <NotificationsScreen />;
}
