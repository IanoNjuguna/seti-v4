# The analytics page's shape

The analytics tab under Activity is the one screen in the app that answers "what does my money do".
This document fixes its arrangement, what each band is allowed to hold, and what the page refuses.

It is a layout spec, not a metrics spec: every figure named here is already in the
`/users/:id/analytics` payload. Nothing here adds a read.

## The problem with eight blocks

The page renders eight blocks of near-equal weight inside one window control: the three figures, the
two halves, the daily bars, consistency, customers, settlement, busy hours, merchants. A customer with
forty payments in thirty days scrolls eight sections and none of them is the answer. The window picker
sits above all eight, so it reads as a filter on peers rather than a control on one subject.

Worse, the eight blocks braid two populations together. Money out to merchants ("Where it goes") and
money in from payers ("Who pays this account") are different questions with different units of trust:
one follows the selected window, the other is counted over the account's whole life because a payer
who left in March is the interesting one. A page that stacks them applies the window control to a
population it does not govern.

## What the reference set converges on

Real consumer and business spending screens do the same four things, and this page does none of them.

| Screen | Mechanism worth taking | Link |
| --- | --- | --- |
| Klarna `Insights` | The period's spend at display size, one bar per month with quiet months at zero height, then ONE row under it. Three elements, no equal-weight stack. | <https://mobbin.com/screens/4076d74f-88ab-48f6-a355-5a9228d68945> |
| Neo Financial `Insights` | Period is a single control beside the total; total carries a one-word qualifier under it; then ranked rows with the count under the name and the amount on the shared right edge. | <https://mobbin.com/screens/f99e4b29-6f21-4c88-8e80-2aa596db5911> |
| Quicken `Spending by Month` | Chart and list are drawn from the same buckets: the bars give the shape, the rows give the exact periods, zeros included. | <https://mobbin.com/screens/097a0f40-ea48-4f41-952d-aef9374ade50> |
| Monarch (refused) | Every card owns its own period selector, so one page shows four periods and four truths. | <https://mobbin.com/screens/7f633467-1621-4192-9bcf-75de6c4cf137> |

Three of these are also the argument for the qualifier strip: Klarna and Neo both carry "can I trust
this number" as one line under the hero, never as a panel.

## The page is three bands

    band 1  the window, the answer, and whether to trust it
    band 2  the shape of the answer
    band 3  the detail, one question at a time

### Band 1: the window, the hero, the two halves, the qualifier

Order, top to bottom, in one block:

1. **The window control.** `WindowPicker` as it is, moved inside band 1 and given the page's top
   edge. It governs every number in bands 1 and 2 and the two windowed tabs in band 3. A single-window
   response still prints its label here rather than a one-item picker.
2. **The hero: `net`.** `variant="balance"`, tabular, the customer's currency. Under it, `micro`
   secondary, one line naming the arithmetic and the period: money in minus money out, over the
   selected window. Nothing else is allowed at this size on the page.
3. **The two segments.** `in` and `out` as ONE horizontal bar, two segments, left to right, each
   directly labelled with its amount, `in` taking the accent and `out` the ink. This replaces the
   three-row figure list. The bar is the causal pair: the reader subtracts by looking. The fee is a
   caption on the `out` segment ("includes KES 540 fee"), never a third segment.
4. **The qualifier line.** `micro`, one paragraph, at most two sentences: consistency and settlement,
   demoted.
   - `activeDays`, `bestDay`, `drySpellDays`, phrased as facts. The dry spell reads off the account's
     last movement, not the window.
   - `settlement.pending` and `medianHours`, phrased as a duration with its unit.
   - When either is empty it is omitted, not printed as zero.

The hero is `net` and not `out` because `net` is the figure the server derives from the other two, so
a reader who subtracts the segments gets it exactly. It sits at the top because it is the only figure
on the page that is about the customer rather than about a half.

### Band 2: one series

- The daily bars, full width, `h-24` or taller, no card frame, no plot fill, keeping `barHeight` and
  its 8% floor so a quiet day stays distinguishable from a closed one.
- Section label at the repo's label scale, naming the window.
- Direct labels: the busiest day and its count in words under the chart, the first and last date at
  the ends of the axis. No legend, no grid lines, no axis line.
- Above the chart, ONE summary line carrying what the halves used to be a section about: payments
  count and average and median ticket for `in` and for `out`. `micro` secondary, one line, not rows.
- Below `DAILY_BAR_FLOOR` the chart is not drawn and the line says so. A window with nothing in it
  draws no band 2 at all.

The bars keep the window's own peak as their scale, so a quiet fortnight and a busy one both read as
shape.

### Band 3: one list, three tabs

One region, one heading scale, a tab pair plus one, and the rows reusing the shared edge:

- **Where it goes.** `merchants`, most first, windowed. Row: name (or the shortened address for
  `kind: 'address'`), the payment count under it, the total on the right edge, and a quiet bar behind
  the label whose width is the row's share of the largest. No donut: we have merchant names, not a
  category taxonomy, so this ranking is already the donut.
- **Who pays, all time.** `customers`: count, repeat, lapsed as one fact line, then the top payers.
  The tab is labelled with its own scope because this population does not follow the window control,
  and a tab that silently ignores the picker above it is the same defect as a page of four periods.
- **When.** `busyHours`, the 7x24 grid and the named peaks, floored at fifty inbound payments. Under
  the floor the tab still exists and says why there is nothing in it, in one line.

Tabs, not sections, because these are three questions about one slot. The windowed tab lands first.

## What is deleted

| Today | Becomes |
| --- | --- |
| `AnalyticsFigures` as a three-row list | The hero and the two segments |
| `AnalyticsHalves` as a section | One summary line in band 2, the fee caption on the `out` segment |
| `AnalyticsConsistency` as a section | The qualifier line |
| `AnalyticsSettlement` as a section | The qualifier line |
| `AnalyticsCustomers` as a card | The second tab |
| `AnalyticsBusyHours` as a panel | The third tab |
| `AnalyticsMerchants` as a trailing section | The first tab, drawn with a bar |

Eight stops become three bands and one of them holds a tab pair.

## States

- **Loading:** the existing skeleton, inside band 1 so the page does not jump when the figures land.
- **Error:** the existing message with its retry, in band 1, above nothing.
- **Empty window (`count === 0`):** band 1 keeps its window control and says the period is empty; band
  2 is not drawn; band 3's windowed tab says the period is empty while the all-time tab still works.
  An empty period is a fact about the period, not three zeros.
- **Skipped rows:** when `skipped > 0` the count is named in the qualifier line. A total that is
  quietly short is the one failure mode this page must never have.
- **Small samples:** an average over a handful of rows carries its `n`. Below twenty, the line says
  small sample.

## Not on this page

- No second chart library, no donut, no pie. Merchant ranking is the breakdown.
- No streak map: Home already draws the year, and a year grid on a thirty-day screen is a different
  subject at a size that makes it look like decoration.
- No per-card period selectors (Monarch), for the reason above.
- No new fetch, no new endpoint field, no server change. If a band needs data the payload does not
  carry, that is a separate issue against `backend/src/services/analytics.ts`.
- No row of KPI tiles. A summary line of related facts beats tiles whose numbers are read against
  each other, and this page's three figures are exactly that case.

## How it is checked

`npm run check:analytics-page --workspace web` asserts what a screenshot cannot: the band order, that
the hero is `net` with its caption, that `in` and `out` are the two segments of one bar and not a
second row, the three tab labels in order with the windowed one first, and that the four demoted
components are no longer imported as top-level bands.

`check:analytics-bars` keeps the arithmetic. `check:analytics` keeps the server's figures.
