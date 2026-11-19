import {
  MarketingBand,
  MarketingBreadcrumb,
  MarketingClose,
  MarketingMasthead,
  MarketingRowList,
  MarketingShell,
} from '../components/marketing';
import { ConvertCalculator } from '../components/convert/ConvertCalculator';
import { ABOUT, CLOSE_LINK, MASTHEAD } from './ConvertPage.constants';

/**
 * `/convert` (#586): what a dollar is worth in shillings today, and who says so.
 *
 * THE ORDER IS THE READER'S QUESTION. The h1 and its lede name the figure and its
 * publisher; the calculator is the first thing under them, because a reader who searched
 * "convert OUSD to KES" came to convert; then what the rate is and what it is not, which
 * only matters once they have seen a number and are deciding whether to trust it.
 *
 * SERVER-RENDERED LIKE THE REST OF THE SITE, with one client island. The copy, the head and
 * the outline are static, so a crawler and a first paint get the whole argument; only the
 * figure needs the network, and `ConvertCalculator` is the component that owns that
 * (`useConvertRate`). Nothing here derives a day from a clock, so the server's render and
 * the browser's hydration agree.
 */
export function ConvertPage() {
  return (
    <MarketingShell>
      <MarketingBreadcrumb path="/convert" label="Convert" />
      <MarketingMasthead title={MASTHEAD.title} lede={MASTHEAD.lede}>
        <ConvertCalculator />
      </MarketingMasthead>

      <MarketingBand eyebrow={ABOUT.eyebrow}>
        <MarketingRowList rows={ABOUT.rows} />
      </MarketingBand>

      <MarketingClose link={CLOSE_LINK} />
    </MarketingShell>
  );
}
