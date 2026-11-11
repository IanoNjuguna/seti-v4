'use client';

import { useState } from 'react';
import { TabPanel, Text } from '@/components/ui';
import { AnalyticsBusyHours } from './AnalyticsBusyHours';
import { AnalyticsCustomers } from './AnalyticsCustomers';
import { AnalyticsMerchants } from './AnalyticsMerchants';
import { AnalyticsSwitches } from './AnalyticsSwitches';
import { ANALYTICS_COPY } from './Analytics.constants';
import type { AnalyticsDetailBandProps, AnalyticsDetailTab } from './Analytics.types';

const ID_PREFIX = 'analytics-detail';

/**
 * The three lists, in the order they are offered.
 *
 * The first is windowed; the second is not, and no longer says so in its own label (#534). A tab
 * label is a name; `Who pays · all time` was a name and a scope, which made one member of a
 * three-member set longer than the others and put the qualifier where a reader looks for a noun.
 * The scope is now stated above the list it applies to, where it is read once, next to the
 * figures it qualifies.
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
 * with equal weight, which meant a reader scanned all three; a switch set makes the reader pick one
 * and keeps the other two one press away.
 *
 * The switches are text-weight (`AnalyticsSwitches`) rather than the shared `Tabs`: a full-width
 * rule between the chart and its own data drew a third edge in a band that needs none, and read as
 * the page starting over.
 *
 * The busy-hours panel is absent below its floor rather than empty: a pattern inferred from a dozen
 * payments is noise wearing a chart's clothes, so the switch says why it has nothing to draw. That
 * floor stays where it was (#534) — unlike the daily marks, a 7x24 grid has no shape to give at six
 * payments, and this one is not the page's only picture.
 */
export function AnalyticsDetailBand({ window: selected, customers, currency }: AnalyticsDetailBandProps) {
  const [tab, setTab] = useState<AnalyticsDetailTab>('merchants');

  return (
    <section aria-label={ANALYTICS_COPY.detailTabLabel} className="flex flex-col gap-3">
      <AnalyticsSwitches
        items={TABS}
        value={tab}
        onChange={setTab}
        label={ANALYTICS_COPY.detailTabLabel}
        idPrefix={ID_PREFIX}
      />

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
