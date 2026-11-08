'use client';

import { useState } from 'react';
import { TabPanel, Tabs, Text } from '@/components/ui';
import { AnalyticsBusyHours } from './AnalyticsBusyHours';
import { AnalyticsCustomers } from './AnalyticsCustomers';
import { AnalyticsMerchants } from './AnalyticsMerchants';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsDetailBandProps, AnalyticsDetailTab } from './Analytics.types';

const ID_PREFIX = 'analytics-detail';

/**
 * The three lists, in the order they are offered.
 *
 * The first is windowed; the second is not, and says so in its own label. That is the whole reason
 * these are TABS rather than three sections: a payer who left in March is the interesting one, so
 * `customers` is counted over the account's life and deliberately ignores the picker above it, and a
 * tab that carried its own scope in its label is the only place that discrepancy can be read
 * honestly. Stated once, here, rather than silently applied.
 */
const TABS = [
  { id: 'merchants', label: ANALYTICS_COPY.detailTabs.merchants },
  { id: 'payers', label: ANALYTICS_COPY.detailTabs.payers },
  { id: 'hours', label: ANALYTICS_COPY.detailTabs.hours },
] as const;

/**
 * Band 3 of three (#441): one list slot, three questions.
 *
 * Where the money went, who it came from, and when it moves. These used to be three sections stacked
 * with equal weight, which meant a reader scanned all three; a tab set makes the reader pick one and
 * keeps the other two one press away.
 *
 * The busy-hours panel is absent below its floor rather than empty: a pattern inferred from twelve
 * payments is noise wearing a chart's clothes, so the tab says why it has nothing to draw.
 */
export function AnalyticsDetailBand({ window: selected, customers, currency }: AnalyticsDetailBandProps) {
  const [tab, setTab] = useState<AnalyticsDetailTab>('merchants');

  return (
    <section aria-label={ANALYTICS_COPY.detailTabLabel} className="flex flex-col gap-3">
      <Tabs items={TABS} value={tab} onChange={setTab} label={ANALYTICS_COPY.detailTabLabel} idPrefix={ID_PREFIX} />

      <TabPanel idPrefix={ID_PREFIX} tabId="merchants" visible={tab === 'merchants'}>
        <AnalyticsMerchants merchants={selected.merchants} currency={currency} />
      </TabPanel>

      <TabPanel idPrefix={ID_PREFIX} tabId="payers" visible={tab === 'payers'}>
        <AnalyticsCustomers customers={customers} currency={currency} />
      </TabPanel>

      <TabPanel idPrefix={ID_PREFIX} tabId="hours" visible={tab === 'hours'}>
        {selected.busyHours ? (
          <AnalyticsBusyHours busyHours={selected.busyHours} />
        ) : (
          <Text variant="micro" as="p" color="secondary">
            {ANALYTICS_COPY.busyBelowFloor}
          </Text>
        )}
      </TabPanel>
    </section>
  );
}
