'use client';

import { Suspense, useCallback, useState } from 'react';
import { Skeleton, TabPanel, Tabs } from '@/components/ui';
import { ActivityAnalytics } from '@/components/activity/ActivityAnalytics';
import { ActivityHeader } from '@/components/activity/ActivityHeader';
import { ActivityList } from '@/components/activity/ActivityList';
import { ActivitySignedOut } from '@/components/activity/ActivitySignedOut';
import {
  ACTIVITY_VIEW_COPY,
  ACTIVITY_VIEW_ID_PREFIX,
  ACTIVITY_VIEWS,
} from '@/components/activity/ActivityView.constants';
import { useActivityView } from '@/components/activity/useActivityView';
import { ReceiptSheet } from '@/components/receipt/ReceiptSheet';
import { useSession } from '@/lib/auth';
import type { Transaction } from '@/lib/types';

/**
 * Activity: two views of one account, with the statement above both.
 *
 * The title and the statement row sit OUTSIDE the switcher, because neither belongs to
 * a tab: the statement acts on the whole account, and a heading that changed with the
 * tab would make the page look like two pages.
 *
 * The switcher is inside a Suspense boundary because it reads the URL. Both panels stay
 * mounted — the list keeps the pages it has loaded, and the analytics panel keeps its
 * figures — so a switch is a change of what is visible, not a refetch. `hidden` on the
 * inactive panel is what keeps it out of the accessibility tree and the tab order.
 */
export default function ActivityPage() {
  const session = useSession();

  if (session.status !== 'signed-in') {
    return <ActivitySignedOut view={session.status} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ActivityHeader />

      <Suspense fallback={<Skeleton className="h-11 w-full" />}>
        <ActivityViews />
      </Suspense>
    </div>
  );
}

function ActivityViews() {
  const { view, setView } = useActivityView();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const closeReceipt = useCallback(() => setSelected(null), []);

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        items={ACTIVITY_VIEWS}
        value={view}
        onChange={setView}
        label={ACTIVITY_VIEW_COPY.label}
        idPrefix={ACTIVITY_VIEW_ID_PREFIX}
      />

      <TabPanel idPrefix={ACTIVITY_VIEW_ID_PREFIX} tabId="transactions" visible={view === 'transactions'}>
        <ActivityList onSelect={setSelected} />
      </TabPanel>

      <TabPanel idPrefix={ACTIVITY_VIEW_ID_PREFIX} tabId="analytics" visible={view === 'analytics'}>
        <ActivityAnalytics active={view === 'analytics'} />
      </TabPanel>

      {selected ? <ReceiptSheet transactionId={selected.id} onClose={closeReceipt} /> : null}
    </div>
  );
}
