/**
 * THE CENTRAL BANK'S SHILLING RATE — the one we price at (#586).
 *
 * Every KES figure the product shows is a multiplication by one number, and until this
 * module that number was a free daily table from `open.er-api.com`: a reseller's copy
 * with no named publisher and no date a Kenyan reader can check. The Central Bank of
 * Kenya publishes an indicative rate every business day, and it is the figure a merchant,
 * an accountant or a tax filing actually references. So the Bank's rate is asked for
 * first, and the provider is the fallback rather than the source.
 *
 * ## Why the fetch goes through `frankfurter.dev`
 *
 * CBK's own page does not serve its table: `centralbank.go.ke/rates/forex-exchange-rates`
 * renders it in the browser, from a POST to `wp-admin/admin-ajax.php?action=get_wdtable&
 * table_id=32` that carries a session and a nonce. A server cannot read that reliably, and
 * a scraper pointed at a central bank is a dependency that breaks without telling anyone.
 *
 * `api.frankfurter.dev` republishes the published table as JSON, with the Bank's own
 * `date` on every row, no key and no account. Verified against the Bank's page: on
 * 2026-11-19 both read 129.99 for USD/KES with the same date. The figure is CBK's; the
 * transport is an open relay, and this comment exists so the next reader does not have to
 * rediscover which of those two facts they are looking at.
 *
 * ## What the figure IS, in the Bank's own words
 *
 * An *indicative* rate: "the average buying and selling rates of the major participants in
 * the foreign exchange market at the open of trade every day". Since 2024-01-04 the Bank
 * has published one mean and no bid/ask, so this series cannot be spliced with anything
 * that carried a spread. It is not a rate any bank, bureau or wallet is obliged to give,
 * and every surface that prints it says so rather than pretending it is a quote.
 *
 * ## Business days only
 *
 * The table is published on Kenyan business days. A rate published on Friday is still the
 * current rate on Sunday, and calling it stale would be reporting a normal weekend as an
 * outage. That is why the freshness window lives with the source (see `payments.ts`)
 * rather than being one constant for every provider.
 */

/** The publisher of the rate, as it is persisted on a transaction row. */
export const CBK_RATE_SOURCE = 'cbk';

/** The relay that serves the Bank's published table as JSON. */
const CBK_ENDPOINT = 'https://api.frankfurter.dev/v2/rates';

/** How long to wait for the Bank's rate before falling back to the provider. */
const CBK_TIMEOUT_MS = 4_000;

/** A publication date, as the Bank prints it. */
const PUBLICATION_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface CbkRate {
  /** Units of the quote currency per 1 USD, as the Bank published them. */
  fiatPerUsd: number;
  /** The Bank's own publication date, `YYYY-MM-DD`. Never re-derived from a clock. */
  publishedFor: string;
}

interface CbkRow {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
}

/**
 * Read one pair out of the relay's payload.
 *
 * Tolerant about the envelope, strict about the content: an array of rows (what v2
 * returns today) and a `{ rates: { DATE: RATE } }` map (what a v1 relay returns) both
 * parse, but a row without a real date or without a positive finite rate is dropped
 * rather than defaulted. The newest date wins, because the relay carries a series.
 *
 * Pure and exported so `check:fx-cbk` can pin it against a payload it controls. No
 * network in this function, and no clock.
 */
export function parseCbkRatePayload(
  payload: unknown,
  fiatCurrency: string
): CbkRate | null {
  const rows: CbkRow[] = Array.isArray(payload) ? (payload as CbkRow[]) : [];

  const usable = rows
    .filter((row) => typeof row.date === 'string' && PUBLICATION_DATE.test(row.date))
    .filter((row) => row.quote === undefined || row.quote === fiatCurrency)
    .map((row) => ({
      publishedFor: row.date as string,
      fiatPerUsd: typeof row.rate === 'number' ? row.rate : Number.NaN,
    }))
    .filter((row) => Number.isFinite(row.fiatPerUsd) && row.fiatPerUsd > 0)
    .sort((a, b) => (a.publishedFor < b.publishedFor ? 1 : -1));

  return usable[0] ?? null;
}

/**
 * The Bank's rate for one currency against the US dollar, or `null`.
 *
 * `null` is not an error: it means "ask the provider". A payment preview must not fail
 * because a second host is slow, which is the whole reason the fallback chain exists.
 */
export async function fetchCbkRate(fiatCurrency: string): Promise<CbkRate | null> {
  const url = `${CBK_ENDPOINT}?base=USD&quotes=${encodeURIComponent(fiatCurrency)}&providers=cbk`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(CBK_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn('[fx] the Central Bank relay returned HTTP', response.status);
      return null;
    }

    return parseCbkRatePayload(await response.json(), fiatCurrency);
  } catch (error) {
    console.warn('[fx] the Central Bank rate could not be read, falling back:', error);
    return null;
  }
}
