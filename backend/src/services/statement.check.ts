/**
 * Statement checks: the three files are what they claim to be, and they say only
 * what the ledger supports.
 *
 * Run with:  npm run check:statement    (part of `npm run verify`)
 *
 * No database, no chain, no browser. Everything here is decided before any read —
 * the serialisers are pure functions of a document — so the coverage is a set of
 * STRUCTURAL assertions about bytes: a CSV that parses back into the same records
 * with a quoted name containing a comma intact, a workbook that is a valid zip and
 * whose money cells are numbers rather than strings, and a PDF that opens with
 * `%PDF-` and carries the statement's own text in its content streams. Nothing
 * asserts a pixel, because a pixel is not the claim being made.
 *
 * The three money rules are pinned here too, on the mapping rather than on the
 * output: the amount comes from the row's own fiat column and never from the token
 * amount, the 2% is the platform fee and is never called gas, and the reference is
 * the app's own receipt id and never the row's database id.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { buildServer } from '../server.js';
import { receiptIdFor } from './receipt-link.js';
import { renderStatementCsv } from './statement-csv.js';
import { renderStatementPdf } from './statement-pdf.js';
import { renderStatementXlsx } from './statement-xlsx.js';
import {
  STATEMENT_CONTENT_TYPE,
  parseStatementRange,
  statementFileName,
  statementHeaders,
  statementRowFrom,
  statementTotalsOf,
  type StatementDocument,
  type StatementRow,
  type StatementSourceRow,
} from './statement-model.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROW_ID = 'clx0000000000000000000aa';
const TOKEN_AMOUNT = '11.73';
const MERCHANT_NAME = 'Java House, Westlands';
const QUOTED_NAME = 'Mama "Njeri" Groceries & Sons <Market>';
const EMOJI_NAME = "Café Kiambu — owner's note ☕";

const ACCOUNT_EMAIL = 'ian@example.test';
const FROM = new Date('2026-01-02T08:15:00.000Z');
const TO = new Date('2026-04-19T22:30:00.000Z');
const GENERATED = new Date('2026-10-15T09:00:00.000Z');

/**
 * A stored row, as a `findMany` hands one over: the token figures are strings, the
 * merchant is joined, and the money is the row's own fiat columns.
 */
const PAID_ROW: StatementSourceRow = {
  id: ROW_ID,
  type: 'payment',
  // The token amount. It must NOT reach any output.
  amount: TOKEN_AMOUNT,
  fiatAmount: '1525.00',
  fiatCurrency: 'KES',
  feeAmount: '30.50',
  counterparty: '0x9f8e7d6c5b4a39281706f5e4d3c2b1a098765432',
  description: null,
  createdAt: FROM,
  status: 'completed',
  asset: 'pathusd',
  txHash: '0xabc123',
  wallet: { address: '0x1111111111111111111111111111111111111111' },
  merchant: {
    name: MERCHANT_NAME,
    category: 'Coffee',
    payoutAddress: '0x9f8e7d6c5b4a39281706f5e4d3c2b1a098765432',
  },
};

/** A deposit: money in, no fee, no counterparty to name. */
const DEPOSIT_ROW: StatementSourceRow = {
  ...PAID_ROW,
  id: 'clx0000000000000000000bb',
  type: 'top_up',
  amount: '38.46',
  fiatAmount: '5000.00',
  feeAmount: null,
  counterparty: '0x0000000000000000000000000000000000000000',
  description: null,
  status: 'completed',
  merchant: null,
};

/** A quoted, punctuated merchant name: the CSV quoting case. */
const QUOTED_ROW: StatementSourceRow = {
  ...PAID_ROW,
  id: 'clx0000000000000000000cc',
  amount: '1.93',
  fiatAmount: '250.50',
  feeAmount: '5.01',
  merchant: {
    name: QUOTED_NAME,
    category: 'Groceries',
    payoutAddress: '0x9f8e7d6c5b4a39281706f5e4d3c2b1a098765432',
  },
};

/** A row the ledger holds with no fiat figure at all — a real, older shape. */
const NO_FIAT_ROW: StatementSourceRow = {
  ...PAID_ROW,
  id: 'clx0000000000000000000dd',
  type: 'p2p_send',
  amount: '0.01',
  fiatAmount: null,
  fiatCurrency: null,
  feeAmount: null,
  counterparty: '0x2222222222222222222222222222222222222222',
  description: EMOJI_NAME,
  status: 'completed',
  merchant: null,
};

const PAID_REFERENCE = receiptIdFor(ROW_ID);

const ROWS: StatementRow[] = [
  statementRowFrom(PAID_ROW, PAID_REFERENCE),
  statementRowFrom(QUOTED_ROW, receiptIdFor(QUOTED_ROW.id)),
  statementRowFrom(DEPOSIT_ROW, null),
  statementRowFrom(NO_FIAT_ROW, null),
];

const DOCUMENT: StatementDocument = {
  account: { email: ACCOUNT_EMAIL },
  network: 'testnet',
  networkLabel: 'Practice',
  currency: 'KES',
  from: FROM,
  to: TO,
  generatedAt: GENERATED,
  rows: ROWS,
  totals: statementTotalsOf(ROWS),
};

/**
 * A long history: the same rows, dated a day apart, so the document has to break
 * across pages. Three of the four carry a reference, one carries an emoji and one
 * carries no figure at all — the awkward cases, sixty times over.
 */
const LONG_ROWS: StatementRow[] = Array.from({ length: 60 }, (_, index) => ({
  ...ROWS[index % ROWS.length],
  date: new Date(Date.UTC(2026, 0, 1 + index, 9, (index * 7) % 60)),
}));

const LONG_DOCUMENT: StatementDocument = {
  ...DOCUMENT,
  from: LONG_ROWS[0].date,
  to: LONG_ROWS[LONG_ROWS.length - 1].date,
  rows: LONG_ROWS,
  totals: statementTotalsOf(LONG_ROWS),
};

// ---------------------------------------------------------------------------
// An RFC 4180 reader, and a zip reader — independent of what they validate
// ---------------------------------------------------------------------------

/** Records from CSV text, per RFC 4180: quoted fields, doubled quotes, CRLF. */
function parseCsv(text: string): string[][] {
  // The BOM is a byte-order MARK, not data: a reader consumes it, and a parser
  // that leaves it on the first field is how "\uFEFFDate" becomes a column name.
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  const push = (): void => {
    record.push(field);
    field = '';
  };

  while (index < source.length) {
    const character = source[index];

    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += character;
      index += 1;
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
      index += 1;
      continue;
    }

    if (character === ',') {
      push();
      index += 1;
      continue;
    }

    if (character === '\r' && source[index + 1] === '\n') {
      push();
      records.push(record);
      record = [];
      index += 2;
      continue;
    }

    field += character;
    index += 1;
  }

  if (field.length > 0 || record.length > 0) {
    push();
    records.push(record);
  }

  return records;
}

interface ZipEntry {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  offset: number;
}

/** The zip's central directory, read from the end of the file. */
function readCentralDirectory(archive: Buffer): ZipEntry[] {
  let endOffset = -1;
  for (let index = archive.length - 22; index >= 0; index -= 1) {
    if (archive.readUInt32LE(index) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }

  if (endOffset < 0) throw new Error('no end-of-central-directory record');

  const count = archive.readUInt16LE(endOffset + 10);
  const directorySize = archive.readUInt32LE(endOffset + 12);
  let cursor = archive.readUInt32LE(endOffset + 16);
  const directoryEnd = cursor + directorySize;
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error('bad central directory entry');

    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);

    entries.push({
      name: archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'),
      method: archive.readUInt16LE(cursor + 10),
      crc: archive.readUInt32LE(cursor + 16),
      compressedSize: archive.readUInt32LE(cursor + 20),
      size: archive.readUInt32LE(cursor + 24),
      offset: archive.readUInt32LE(cursor + 42),
    });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  if (cursor !== directoryEnd) throw new Error('central directory length disagrees with its records');

  return entries;
}

/** One entry's bytes, inflated through its local header. */
function readEntry(archive: Buffer, entry: ZipEntry): Buffer {
  if (archive.readUInt32LE(entry.offset) !== 0x04034b50) throw new Error('bad local header');

  const nameLength = archive.readUInt16LE(entry.offset + 26);
  const extraLength = archive.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const data = archive.subarray(start, start + entry.compressedSize);

  const body = entry.method === 8 ? inflateRawSync(data) : data;
  if (body.length !== entry.size) throw new Error(`entry ${entry.name} size mismatch`);
  if (crc32(body) !== entry.crc) throw new Error(`entry ${entry.name} CRC mismatch`);

  return body;
}

/** The CRC32 of a part, recomputed to validate the archive against its own sums. */
function crc32(data: Buffer): number {
  let crc = -1;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

/** Every decompressed content stream of a PDF, joined. */
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const streams: string[] = [];

  for (const match of raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    const body = Buffer.from(match[1], 'latin1');
    try {
      streams.push(inflateSync(body).toString('latin1'));
    } catch {
      streams.push(body.toString('latin1'));
    }
  }

  return streams.join('\n');
}

/** Text runs with their absolute position and size, from a PDF content stream. */
function pdfRuns(content: string): Array<{ size: number; x: number; y: number; text: string }> {
  const runs: Array<{ size: number; x: number; y: number; text: string }> = [];

  for (const match of content.matchAll(
    /BT \/F\d ([\d.]+) Tf 1 0 0 1 ([\d.-]+) ([\d.-]+) Tm \(((?:[^()\\]|\\.)*)\) Tj ET/g
  )) {
    runs.push({
      size: Number(match[1]),
      x: Number(match[2]),
      y: Number(match[3]),
      text: match[4].replace(/\\([\\()])/g, '$1'),
    });
  }

  return runs;
}

/**
 * Text as XML, as the check EXPECTS the workbook to have written it. Written out
 * here rather than imported, so the escaping is validated rather than assumed.
 */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * The width of a money figure in Helvetica, in points — the widths the PDF writer
 * aligns on. Digits are 556/1000 em, so a figure's width is exact.
 */
function moneyWidth(text: string, size: number): number {
  let units = 0;
  for (const character of text) {
    units += character === ',' || character === '.' ? 278 : character === '-' ? 333 : 556;
  }
  return (units / 1000) * size;
}

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  console.log('the row keeps the ledger\'s own meaning:');

  const paid = ROWS[0];
  check(
    'the amount is the row\u2019s own fiat figure, never the token amount',
    paid.amount === -1525,
    `amount=${String(paid.amount)}`
  );
  check('the amount is signed by the ledger\u2019s direction', paid.direction === 'out');
  check(
    'the 2% is the platform fee, from the row\u2019s own fee column',
    paid.platformFee === 30.5,
    `fee=${String(paid.platformFee)}`
  );
  check(
    'the description is the app\u2019s own title for the row',
    paid.description === MERCHANT_NAME,
    paid.description
  );
  check(
    'the counterparty is the merchant the ledger named',
    paid.counterparty === MERCHANT_NAME,
    paid.counterparty
  );
  check(
    'an inflow is positive',
    ROWS[2].amount === 5000 && ROWS[2].direction === 'in',
    `amount=${String(ROWS[2].amount)}`
  );
  check(
    'a row with no fiat figure is null, not 0.00',
    ROWS[3].amount === null,
    String(ROWS[3].amount)
  );
  check('a deposit with no fee is null, not 0.00', ROWS[2].platformFee === null);

  /**
   * The words a PERSON reads on a row: the title, the counterparty, the status word
   * the API returns, and the direction.
   *
   * `reference` is deliberately not among them. It is an opaque receipt id minted
   * by `receiptIdFor`, whose key is `randomBytes(32)` per process whenever
   * `QUOTE_SIGNING_SECRET` is unset — which is every CI run unless the workflow
   * pins it. About 1 random id in 14,000 spells `ousd`/`usdc`/`usdt`/`tempo`, so the
   * assertion below, which used to regex the whole serialised row, failed at
   * random on a tree nobody had touched (#204). A check that fires on a coin flip
   * teaches the reader to re-run it rather than to read it.
   */
  const readableWords = (row: StatementRow): string =>
    [row.description, row.counterparty, row.status, row.direction].join(' | ');

  const TOKEN_NAME = /pathusd|ousd|usdc|usdt|tempo|testnet|mainnet/i;
  const tokenNameIn = (row: StatementRow): string | null => readableWords(row).match(TOKEN_NAME)?.[0] ?? null;

  const leaked = ROWS.map(tokenNameIn).filter((name): name is string => name !== null);
  check(
    'no token, asset or chain name reaches a row a person reads',
    leaked.length === 0,
    leaked.join(', ') || 'none'
  );

  // Both directions, or the guard above could pass because it reads nothing. These
  // two cases are why the assertion still bites after the reference was excluded:
  // a name in a description fails it, and an opaque reference that spells one does
  // not — which is the exact pair of behaviours that flaked.
  const nameInDescription: StatementRow = { ...ROWS[0], description: 'Top-up from OUSD' };
  check(
    'and it fires when a name reaches a description',
    tokenNameIn(nameInDescription) === 'OUSD',
    tokenNameIn(nameInDescription) ?? 'nothing'
  );
  const nameInReference: StatementRow = {
    ...ROWS[0],
    reference: 'ousdUSDT0tempo-mainnet',
  };
  check(
    'while a reference that happens to spell one is not a row a person reads',
    // The first half is the point: this row is exactly what used to fail, so the
    // second half proves the new predicate is what stops it rather than a fixture
    // that could never have triggered the old one.
    TOKEN_NAME.test(JSON.stringify(nameInReference)) && tokenNameIn(nameInReference) === null,
    `old predicate ${TOKEN_NAME.test(JSON.stringify(nameInReference)) ? 'fired' : 'missed'}, ` +
      `new predicate ${tokenNameIn(nameInReference) === null ? 'quiet' : 'fired'}`
  );

  check(
    'no gas anywhere: the fee is the platform fee',
    !ROWS.some((row) => /\bgas\b/i.test(readableWords(row))) &&
      !/\bgas\b/i.test(statementHeaders('KES').join(' '))
  );
  check(
    'the reference is the app\u2019s receipt id, never the row id',
    paid.reference === PAID_REFERENCE && paid.reference !== ROW_ID && PAID_REFERENCE.length === 22,
    paid.reference ?? 'null'
  );
  check(
    'the totals count the rows they could not include',
    DOCUMENT.totals.rowsWithoutAmount === 1 && DOCUMENT.totals.amount === 3224.5,
    JSON.stringify(DOCUMENT.totals)
  );

  // -------------------------------------------------------------------------
  console.log('\nthe CSV is RFC 4180, in a spreadsheet\u2019s own encoding:');

  const csv = renderStatementCsv(DOCUMENT);
  const csvBytes = Buffer.from(csv, 'utf8');
  check(
    'it opens with a UTF-8 BOM',
    csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf,
    String([...csvBytes.subarray(0, 3)])
  );
  check('every line ends CRLF', !csv.replaceAll('\r\n', '').includes('\n'));

  const records = parseCsv(csv);
  check(
    'it parses back to the header plus one record per row',
    records.length === ROWS.length + 1 && records.every((record) => record.length === 7),
    `${records.length} records`
  );
  check('the header is the statement\u2019s one column list', records[0].join('|') === statementHeaders('KES').join('|'), records[0].join('|'));
  check(
    'the header names no token and no chain',
    !/ousd|pathusd|usdc|usdt|tempo|testnet|mainnet/i.test(records[0].join(','))
  );
  check(
    'the fee column is called the platform fee, and the currency is named on it',
    records[0][4] === 'Platform fee (KES)',
    records[0][4]
  );

  const parsedPaid = records[1];
  check(
    'a name containing a comma comes back whole',
    parsedPaid[1] === MERCHANT_NAME && parsedPaid[2] === MERCHANT_NAME,
    `${parsedPaid[1]} | ${parsedPaid[2]}`
  );
  check(
    'a name containing quotes and angle brackets comes back whole',
    records[2][1] === QUOTED_NAME && records[2][2] === QUOTED_NAME,
    records[2][1]
  );
  check(
    'the amount parses as a number and is the fiat figure',
    Number(parsedPaid[3]) === -1525 && parsedPaid[4] === '30.50',
    `${parsedPaid[3]} / ${parsedPaid[4]}`
  );
  check('an absent figure is an empty field', records[3][4] === '' && records[4][3] === '');
  check('no cell carries the token amount', !csv.includes(TOKEN_AMOUNT));

  // -------------------------------------------------------------------------
  console.log('\nthe XLSX is a workbook, not a renamed CSV:');

  const xlsx = renderStatementXlsx(DOCUMENT);
  check('it is a zip', xlsx.readUInt32LE(0) === 0x04034b50, `bytes=${xlsx.length}`);
  check('no cell carries the token amount', !xlsx.includes(TOKEN_AMOUNT));

  const entries = readCentralDirectory(xlsx);
  const parts = new Map<string, Buffer>();
  let archiveIntact = true;
  for (const entry of entries) {
    try {
      parts.set(entry.name, readEntry(xlsx, entry));
    } catch {
      archiveIntact = false;
    }
  }
  check('every part inflates to its declared size and CRC', archiveIntact && parts.size === entries.length, `${parts.size}/${entries.length}`);

  const contentTypes = parts.get('[Content_Types].xml')?.toString('utf8') ?? '';
  const workbook = parts.get('xl/workbook.xml')?.toString('utf8') ?? '';
  const sheet = parts.get('xl/worksheets/sheet1.xml')?.toString('utf8') ?? '';
  const styles = parts.get('xl/styles.xml')?.toString('utf8') ?? '';

  check(
    'it carries the parts a workbook needs',
    parts.has('[Content_Types].xml') &&
      parts.has('_rels/.rels') &&
      parts.has('xl/workbook.xml') &&
      parts.has('xl/_rels/workbook.xml.rels') &&
      parts.has('xl/styles.xml') &&
      parts.has('xl/worksheets/sheet1.xml'),
    [...parts.keys()].join(' ')
  );
  check(
    'the package declares the spreadsheet media type',
    contentTypes.includes('spreadsheetml.sheet.main+xml')
  );
  check('the workbook names its sheet', /<sheet name="Statement"/.test(workbook));
  check(
    'the sheet holds the header row and every row',
    sheet.includes('<t>Platform fee (KES)</t>') &&
      sheet.includes(`<t>${xmlEscape(QUOTED_NAME)}</t>`)
  );

  const firstDataRow = /<row r="2">([\s\S]*?)<\/row>/.exec(sheet)?.[1] ?? '';
  check(
    'the first data row is present',
    firstDataRow.includes(`<t>${MERCHANT_NAME}</t>`) && firstDataRow.includes('<v>-1525</v>'),
    firstDataRow.slice(0, 60)
  );
  check(
    'the amount is a TYPED numeric cell, not a string',
    /<c r="D2" s="2"><v>-1525<\/v><\/c>/.test(firstDataRow) && !/<c r="D2"[^>]*t="/.test(firstDataRow),
    /<c r="D2"[^>]*>/.exec(firstDataRow)?.[0] ?? 'no D2'
  );
  check('the date is a typed date cell', /<c r="A2" s="3"><v>\d+(\.\d+)?<\/v><\/c>/.test(firstDataRow));
  check(
    'the money cells are formatted with a number format, not General',
    /numFmtId="164" formatCode="#,##0\.00;-#,##0\.00"/.test(styles) &&
      /<xf numFmtId="164"[^>]*applyNumberFormat="1"/.test(styles)
  );
  check('every column carries a width', (sheet.match(/customWidth="1"/g) ?? []).length === 7);
  check('the header row is declared once, above the data', /<row r="1">/.test(sheet));

  // -------------------------------------------------------------------------
  console.log('\nthe PDF is a document:');

  const pdf = renderStatementPdf(DOCUMENT);
  const pdfHeader = pdf.subarray(0, 8).toString('latin1');
  check('it begins with %PDF-', pdfHeader.startsWith('%PDF-'), pdfHeader);
  check('it ends with %%EOF', pdf.subarray(-6).toString('latin1').includes('%%EOF'));
  check('it is not trivial in size', pdf.length > 1500, `${pdf.length} bytes`);

  // The runs, not the raw stream: a PDF escapes the parentheses inside a literal
  // string, so searching the bytes for "Platform fee (KES)" would fail on a
  // document that renders it perfectly.
  const runs = pdfRuns(pdfText(pdf));
  const words = runs.map((run) => run.text).join('\n');

  check('the content streams are compressed and readable', words.length > 500, `${words.length} chars`);
  check('it carries the Seti wordmark', runs.some((run) => run.text === 'Seti'));
  check('it names the account', words.includes(ACCOUNT_EMAIL));
  check('it names the network as the product word too', words.includes('Practice (testnet)'));
  check('it names the period', words.includes('2 January 2026 - 19 April 2026'));
  check('it names the currency, once, for every figure', words.includes('KES - all amounts'));
  check('it says when it was produced', words.includes('2026-10-15 09:00 UTC'));
  check(
    'it carries the table header',
    words.includes('Platform fee (KES)') && words.includes('Reference') && words.includes('Amount (KES)')
  );
  check('it carries the first row', words.includes(MERCHANT_NAME));
  check('it carries a total', words.includes('Total amount'));
  check(
    'and says what the total excluded',
    words.includes('1 row(s) carry no recorded KES figure and are excluded above.')
  );
  check('it is paginated, and numbered', words.includes('Page 1 of 1'));
  check(
    'no glyph the font cannot draw: the emoji is gone',
    !words.includes('\u2615') && !/[\u0100-\u{10FFFF}]/u.test(words),
    words.includes('\u2615') ? 'emoji present' : 'clean'
  );
  check('the undrawable character became a visible ?', words.includes("owner's note ?"));

  const money = runs
    .filter((run) => /^[+-]?[\d,]+\.\d\d$/.test(run.text))
    .map((run) => ({ ...run, right: run.x + moneyWidth(run.text, run.size) }));

  // Right-alignment, proven without knowing the column's coordinates: figures of
  // different lengths drawn at one size must END at the same x. The amount column
  // is set at 7.5pt and the fee column at 6.5pt, so each has its own edge.
  const edgesAt = (size: number): string[] => [
    ...new Set(
      money.filter((run) => run.size === size).map((run) => run.right.toFixed(1))
    ),
  ];
  const amounts = money.filter((run) => run.size === 7.5);
  const fees = money.filter((run) => run.size === 6.5);
  check(
    'the amount column is right-aligned on one edge',
    amounts.length >= 2 && edgesAt(7.5).length === 1,
    `${amounts.length} figures at ${edgesAt(7.5).join(', ')}`
  );
  check(
    'so is the platform-fee column, on its own edge',
    fees.length >= 2 && edgesAt(6.5).length === 1 && edgesAt(6.5)[0] !== edgesAt(7.5)[0],
    `${fees.length} figures at ${edgesAt(6.5).join(', ')}`
  );

  // -------------------------------------------------------------------------
  console.log('\na history too long for one page still fits on the paper:');

  const longPdf = renderStatementPdf(LONG_DOCUMENT);
  const longRaw = longPdf.toString('latin1');
  const longRuns = pdfRuns(pdfText(longPdf));
  const longWords = longRuns.map((run) => run.text);
  const pages = Number(/\/Count (\d+)/.exec(longRaw)?.[1] ?? 0);

  check('the page tree counts more than one page', pages >= 2, `${pages} pages`);
  check(
    'every page carries the column header',
    longWords.filter((word) => word === 'Platform fee (KES)').length === pages,
    `${longWords.filter((word) => word === 'Platform fee (KES)').length} headers`
  );
  check(
    'and every page is numbered',
    longWords.includes(`Page 1 of ${pages}`) && longWords.includes(`Page ${pages} of ${pages}`)
  );
  check(
    'the total appears once, under the last row',
    longWords.filter((word) => word === 'Total amount').length === 1
  );
  check(
    'no row is drawn over the footer: nothing but the footer sits in its band',
    longRuns
      .filter(
        (run) =>
          !run.text.startsWith('Seti - account statement') && !run.text.startsWith('Page ')
      )
      .every((run) => run.y > 60),
    `runs=${longRuns.length}`
  );

  // -------------------------------------------------------------------------
  console.log('\nthe period is the caller\u2019s, and the whole history by default:');

  const open = parseStatementRange(undefined, undefined);
  check('an omitted range is open at both ends', open.ok && open.from === null && open.to === null);
  const bounded = parseStatementRange('2026-01-01', '2026-01-31');
  check(
    'a stated period starts at the start of its first day',
    bounded.ok && bounded.from?.toISOString() === '2026-01-01T00:00:00.000Z',
    bounded.ok ? String(bounded.from) : bounded.reason
  );
  check(
    '...and runs to the END of its last day',
    bounded.ok && bounded.to?.toISOString() === '2026-01-31T23:59:59.999Z',
    bounded.ok ? String(bounded.to) : bounded.reason
  );

  for (const bad of ['2026-13-01', '2026-02-31', '2026-1-1', 'yesterday', '', '20260101']) {
    const refused = parseStatementRange(bad, undefined);
    check(`"${bad}" is refused as a range`, !refused.ok && refused.code === 'invalid-statement-range');
  }
  const backwards = parseStatementRange('2026-02-01', '2026-01-01');
  check(
    'a backwards range is refused rather than answered empty',
    !backwards.ok && backwards.code === 'invalid-statement-range'
  );

  check(
    'the filename is seti-statement-<from>-<to>.<ext>',
    statementFileName('csv', FROM, TO) === 'seti-statement-2026-01-02-2026-04-19.csv' &&
      statementFileName('xlsx', FROM, TO).endsWith('.xlsx') &&
      statementFileName('pdf', FROM, TO).endsWith('.pdf'),
    statementFileName('pdf', FROM, TO)
  );

  check(
    'each format has its own media type',
    STATEMENT_CONTENT_TYPE.csv.startsWith('text/csv') &&
      STATEMENT_CONTENT_TYPE.xlsx ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
      STATEMENT_CONTENT_TYPE.pdf === 'application/pdf'
  );

  // -------------------------------------------------------------------------
  console.log('\nthe route is a literal, and it is registered before the parameters:');

  const source = readFileSync(join(__dirname, '..', 'routes', 'transactions.ts'), 'utf8');
  const literalAt = source.indexOf("app.get('/statement'");
  const firstParameterAt = source.indexOf("'/:id");

  check('the literal route is declared in the route file', literalAt > 0, `at ${literalAt}`);
  check(
    'it is declared BEFORE the first /:id route',
    literalAt > 0 && firstParameterAt > 0 && literalAt < firstParameterAt,
    `literal@${literalAt} vs param@${firstParameterAt}`
  );

  // -------------------------------------------------------------------------
  console.log('\nthe built server routes the literal, and refuses everyone else:');

  const server = await buildServer({ logger: false });
  await server.ready();

  check(
    'GET /transactions/statement is a route on the real server',
    server.hasRoute({ method: 'GET', url: '/transactions/statement' })
  );
  check(
    'and there is nothing at /transactions/:id that could swallow it',
    !server.hasRoute({ method: 'GET', url: '/transactions/:id' })
  );
  check(
    'the statement is a GET, never a write',
    !server.hasRoute({ method: 'POST', url: '/transactions/statement' })
  );

  // A registered path runs its hooks; an unregistered one is a 404 before any hook
  // is reached. The pair is what makes the 401 evidence that the LITERAL matched —
  // the file's own auth hook refusing a caller with no session, not the router
  // failing to find a route at all.
  const literal = await server.inject({ method: 'GET', url: '/transactions/statement?format=csv' });
  check(
    'a request to the literal reaches a route (its auth hook answers), not a 404',
    literal.statusCode === 401,
    `got ${literal.statusCode}`
  );
  const unregistered = await server.inject({ method: 'GET', url: '/transactions/statement/nope' });
  check(
    '...while a path that is not registered is still a 404',
    unregistered.statusCode === 404,
    `got ${unregistered.statusCode}`
  );

  await server.close();

  console.log('-'.repeat(72));
  if (failures > 0) {
    console.log(`${failures} CHECK(S) FAILED.`);
    process.exit(1);
  }
  console.log(`${total} assertions passed.`);
}

void main().catch((error: unknown) => {
  console.error('statement check crashed:', error);
  process.exit(1);
});
