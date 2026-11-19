/**
 * A child process that answers one question about the rate chain (#586).
 *
 * `check:fx-cbk` spawns this file once per scenario, because the chain is decided by
 * module-level state: `getFxQuote` caches its first answer for an hour, so two scenarios in
 * one process would prove only the first. A fresh process per scenario is what makes the
 * claim "CBK wins, then the provider, then the static figure" a measurement rather than a
 * reading of the source.
 *
 * The only thing stubbed is `fetch`, and only for the two hosts the chain talks to:
 * everything else (the shape of the quote, the sanity band, the freshness rule) is the
 * production code, unpatched. The scenario comes in through `FX_PROBE_SCENARIO`; the answer
 * goes out as one JSON line on stdout.
 */
const scenario = process.env.FX_PROBE_SCENARIO ?? 'nothing';

/** Today, as the Bank would print it in UTC: only the shape matters to the fixture. */
const TODAY = new Date().toISOString().slice(0, 10);

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const realFetch = globalThis.fetch;

globalThis.fetch = (async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (url.includes('frankfurter')) {
    if (scenario === 'cbk-ok') {
      // The relay's real shape: an array of rows with the Bank's own date.
      return json([{ date: TODAY, base: 'USD', quote: 'KES', rate: 129.99 }]);
    }
    if (scenario === 'cbk-slip') {
      // A unit slip: shillings per dollar quoted as if it were cents.
      return json([{ date: TODAY, base: 'USD', quote: 'KES', rate: 12_999_000 }]);
    }
    return new Response('relay down', { status: 503 });
  }

  if (url.includes('open.er-api.com')) {
    if (scenario === 'provider-only') {
      return json({ result: 'success', rates: { KES: 130.5 } });
    }
    return new Response('provider down', { status: 503 });
  }

  return realFetch(input, init);
});

async function main(): Promise<void> {
  const { getFxQuote } = await import('./payments.js');
  const quote = await getFxQuote('KES');

  console.log(
    JSON.stringify({
      fiatPerUsd: quote.fiatPerUsd,
      source: quote.source,
      publishedFor: quote.publishedFor ?? null,
      asOf: quote.asOf.toISOString(),
      stale: quote.stale,
    })
  );
}

void main();
