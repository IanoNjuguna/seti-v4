/**
 * `npm run check:convert-page` — what `/convert` claims, and what it refuses to invent (#586).
 *
 * The page's whole value is that its figure has a publisher and its arithmetic is exact, so
 * this suite holds those two things rather than the layout:
 *
 *   (a) the arithmetic: an amount is parsed or refused, never coerced; conversion both ways
 *       is the rate and nothing else; shillings print to two decimals with thousands
 *       separators and tokens to six;
 *   (b) the publication day is formatted from the STRING, so no clock and no timezone can
 *       move a date by one;
 *   (c) the copy names the publisher, says the rate is indicative and not a quote, and
 *       carries a state for "the rate could not be read";
 *   (d) NO RATE IS BUNDLED. The calculator's constants must not contain a fallback figure,
 *       because a converter that prints a stale rate as today's is the defect this page is
 *       built to avoid;
 *   (e) the figure comes from `/rates`, which is the same endpoint the payment path answers;
 *   (f) the head is inside the lengths the search layer holds to.
 *
 * Run from `web/`.
 */
process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID ??= '42431';

import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const { parseAmount, toShillings, toTokens, formatShillings, formatTokens } = await import(
  '../app/components/convert/convert.math.ts'
);
const { formatPublicationDay } = await import('../app/components/convert/convert.format.ts');
const calculator = await import('../app/components/convert/ConvertCalculator.constants.ts');
const page = await import('../app/convert/ConvertPage.constants.ts');

/** The four the product supports. Written here, not imported from the page: a check that
 *  reads its own expectation out of the code it is checking proves nothing about it. */
const EXPECTED_ASSETS = ['ousd', 'pathusd', 'usdt0', 'usdc.e'];

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

// ------------------------------------------------------------------------- (a)
console.log('the arithmetic:');
{
  check('a plain amount parses', parseAmount('25') === 25, String(parseAmount('25')));
  check('six decimals parse, because the token carries six', parseAmount('0.000001') === 0.000001);
  check('and a seventh is refused', parseAmount('0.0000001') === null, String(parseAmount('0.0000001')));
  check('scientific notation is refused rather than coerced', parseAmount('1e5') === null, String(parseAmount('1e5')));
  check('a trailing letter is refused', parseAmount('12abc') === null, String(parseAmount('12abc')));
  check('a negative is refused', parseAmount('-5') === null, String(parseAmount('-5')));
  check('an empty field is refused', parseAmount('   ') === null, String(parseAmount('   ')));
  check('a thousands separator is refused, not stripped', parseAmount('1,250') === null, String(parseAmount('1,250')));

  check('shillings are the token amount times the rate', Math.abs(toShillings(25, 129.99) - 3249.75) < 1e-9, String(toShillings(25, 129.99)));
  check('and tokens are the inverse', Math.abs(toTokens(3249.75, 129.99) - 25) < 1e-9, String(toTokens(3249.75, 129.99)));

  check('shillings print with the symbol, thousands and two decimals', formatShillings(3249.75) === 'KES 3,249.75', formatShillings(3249.75));
  check('a whole figure still prints its cents', formatShillings(1250) === 'KES 1,250.00', formatShillings(1250));
  check('tokens print the symbol after the figure', formatTokens(25, 'pathUSD') === '25.00 pathUSD', formatTokens(25, 'pathUSD'));
  check('and keep a gas-sized remainder visible', formatTokens(0.000027, 'OUSD') === '0.000027 OUSD', formatTokens(0.000027, 'OUSD'));
}

// ------------------------------------------------------------------------- (b)
console.log('\nthe publication day:');
{
  check('the Bank\'s date is written out', formatPublicationDay('2026-11-19') === '19 November 2026', String(formatPublicationDay('2026-11-19')));
  check('the first of a month has no leading zero', formatPublicationDay('2027-01-01') === '1 January 2027', String(formatPublicationDay('2027-01-01')));
  check('no day is invented when there is none', formatPublicationDay(null) === null);
  check('and a malformed day is refused', formatPublicationDay('19/11/2026') === null, String(formatPublicationDay('19/11/2026')));
}

// ------------------------------------------------------------------------- (c)
console.log('\nthe words:');
{
  check(
    'the rate is attributed to the Central Bank of Kenya',
    calculator.RATE_SOURCE_COPY.cbk === 'Central Bank of Kenya',
    String(calculator.RATE_SOURCE_COPY.cbk)
  );
  check(
    'the page says the number is indicative and not a quote',
    /indicative/i.test(calculator.NOT_A_QUOTE) && /not a quote/i.test(calculator.NOT_A_QUOTE),
    calculator.NOT_A_QUOTE
  );
  check(
    'and says it under the figure, where the number is',
    /not a quote/i.test(calculator.NOT_A_QUOTE)
  );
  check(
    'the band carries only the two rows about the rate (#588)',
    page.ABOUT.rows.length === 2 &&
      page.ABOUT.rows.map((row) => row.title).join('|') === 'Who publishes it|What it is made of',
    page.ABOUT.rows.map((row) => row.title).join('|')
  );
  check(
    'and no longer repeats a "what it is not" row',
    !page.ABOUT.rows.some((row) => /what it is not/i.test(row.title))
  );
  check(
    'the masthead is the h1 alone, with no lede (#588)',
    typeof page.MASTHEAD.title === 'string' && !('lede' in page.MASTHEAD),
    Object.keys(page.MASTHEAD).join(',')
  );
  check(
    'the page names who publishes it and how often',
    page.ABOUT.rows.some((row) => /Central Bank of Kenya/.test(row.detail) && /business day/i.test(row.detail))
  );
  check(
    'there is a state for a rate that could not be read',
    typeof calculator.RATE_UNAVAILABLE.title === 'string' && calculator.RATE_UNAVAILABLE.body.length > 20,
    calculator.RATE_UNAVAILABLE.title
  );
  check(
    'and it sends the reader to reload rather than to a default figure',
    /reload/i.test(calculator.RATE_UNAVAILABLE.body),
    calculator.RATE_UNAVAILABLE.body
  );
  check(
    'every supported asset is offered, and nothing else',
    calculator.CONVERT_ASSETS.map((option) => option.asset).join(',') === EXPECTED_ASSETS.join(','),
    calculator.CONVERT_ASSETS.map((option) => option.symbol).join(',')
  );
}

// ------------------------------------------------------------------------- (d)
console.log('\nno figure is bundled:');
{
  const constants = read('../app/components/convert/ConvertCalculator.constants.ts');
  const math = read('../app/components/convert/convert.math.ts');
  check(
    'the calculator carries no rate constant',
    !/\b(?:DEFAULT_RATE|FALLBACK_RATE|FALLBACK_FX|rate\s*[:=]\s*1[0-9]{2})/.test(constants),
    'a bundled figure would print as today\'s'
  );
  check(
    'and the arithmetic has no default rate in it either',
    !/\b1[0-9]{2}\.\d+\b/.test(math),
    'the only rate is the one the API returns'
  );
}

// ------------------------------------------------------------------------- (e)
console.log('\nthe figure comes from the publisher:');
{
  const hook = read('../app/components/convert/useConvertRate.ts');
  check('the cost of the rate is one read of /rates', /API_BASE_URL\}\/rates/.test(hook), 'useConvertRate');
  check('and there is no bundled answer to fall back to', !/\bfallback\s*[:=]\s*\{/.test(hook));
  const calculatorSource = read('../app/components/convert/ConvertCalculator.tsx');
  check(
    'the converter refuses to convert without a rate',
    /status === 'unavailable'[\s\S]{0,80}ConvertUnavailable/.test(calculatorSource),
    'ConvertCalculator'
  );
}

// ------------------------------------------------------------------------- (f)
console.log('\nthe head:');
{
  const title = page.CONVERT_METADATA.title;
  const description = page.CONVERT_METADATA.description;
  check('the title is inside 45 to 60 characters', title.length >= 45 && title.length <= 60, `${title.length}`);
  check('the description is inside 140 to 155 characters', description.length >= 140 && description.length <= 155, `${description.length}`);
  check('the title names the country or the publisher', /Kenya|CBK/.test(title), title);
  check('the canonical is the route itself', page.CONVERT_METADATA.alternates.canonical === '/convert', page.CONVERT_METADATA.alternates.canonical);
}

console.log('-------------------------------------------------------------------------');
if (failed === 0) {
  console.log(`All ${passed + failed} checks passed.`);
  process.exit(0);
}
console.log(`${failed} of ${passed + failed} checks FAILED.`);
process.exit(1);
