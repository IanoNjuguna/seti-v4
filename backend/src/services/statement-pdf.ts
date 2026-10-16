/**
 * The statement as PDF: a document, not a screenshot of a table.
 *
 * WHY WRITTEN HERE, WITH NO DEPENDENCY
 *
 * The same reason as the workbook: a PDF this simple is bytes Node already knows
 * how to make. It is one page tree, two base-14 fonts and a content stream that
 * `zlib` compresses. The packages that would have saved this file work pull in
 * many times their own size — and the browser-based ones pull in a Chromium
 * download, which cannot deploy on a free tier at all. The check suite inflates
 * the content streams and reads the text back out, so the document is verified
 * rather than assumed.
 *
 * WHAT MAKES IT A DOCUMENT
 *
 *  - the Seti wordmark and its rule, at the head;
 *  - the account, the network, the period, the currency and when the file was
 *    produced — so a download found in a folder next year explains itself;
 *  - the table, with a header row REPEATED on every page;
 *  - money columns RIGHT-ALIGNED on their own decimal points, which is the one
 *    typographic rule that makes a column of figures readable;
 *  - a total, and the count of any rows it could not include;
 *  - and page breaks: a long history runs onto as many pages as it needs, with
 *    the row it split at carried whole onto the next one.
 *
 * WHAT IT DELIBERATELY CANNOT DRAW
 *
 * Helvetica, with WinAnsi encoding, is the font. Emoji and arbitrary Unicode are
 * therefore not renderable at all — the glyph does not exist — and a byte written
 * optimistically would come out as a mangled accent or nothing. Text is instead
 * transliterated to what the font can draw, and anything still outside it becomes
 * `?`: a visible, honest question mark rather than a silent corruption. The
 * figures are the same story — amounts are ASCII digits and separators, and the
 * statement's own vocabulary ("Seti", "Platform fee") is plain ASCII.
 */
import { deflateSync } from 'node:zlib';
import {
  calendarDay,
  displayAmount,
  displayDate,
  displayTimestamp,
  statementHeaders,
  type StatementDocument,
  type StatementRow,
} from './statement-model.js';

// A4 landscape: seven columns of a ledger need the width, and a statement is not
// a letter. 595.28 x 841.89 pt is A4 portrait; the values below are its landscape.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
const ROW_HEIGHT = 13;
// The lowest baseline a row may occupy, leaving the footer its own band.
const BODY_BOTTOM = PAGE_HEIGHT - 60;
// The lowest line the totals block may draw on, measured from the top. The block
// is a rule and two lines; reserving the room BEFORE the last row is placed is
// what stops a long history from drawing its totals over the footer.
const TOTALS_BOTTOM = PAGE_HEIGHT - 62;
const TOTALS_RESERVE = 40;

const FONT = 'F1';
const FONT_BOLD = 'F2';

const HEADER_SIZE = 6.5;
const CELL_SIZE = 7.5;
const SMALL_SIZE = 6.5;

/** Where each column sits. `x` is the left edge; money columns are anchored right. */
const COLUMNS = {
  date: { x: 40, width: 72 },
  description: { x: 116, width: 170 },
  counterparty: { x: 290, width: 140 },
  status: { x: 648, width: 44 },
  reference: { x: 698, width: RIGHT_EDGE - 698 },
  amountRight: 530,
  feeRight: 640,
} as const;

/**
 * Helvetica's advance widths, per 1000 em, for the printable ASCII range.
 *
 * From the standard-14 metrics. Digits are the load-bearing part: they are all
 * 556, which is what lets a money figure be right-aligned on its decimal point
 * exactly rather than approximately. A width outside this table falls back to a
 * generous 600, which only ever makes truncated text shorter than it could be —
 * the safe direction.
 */
const ASCII_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** The width of one character, per 1000 em. */
function glyphWidth(character: string): number {
  const code = character.charCodeAt(0);
  if (code >= 32 && code <= 126) return ASCII_WIDTHS[code - 32];
  if (code >= 0xa0 && code <= 0xff) return 556;
  return 600;
}

/** The width of a string at a size, in points. */
function textWidth(text: string, size: number): number {
  let units = 0;
  for (const character of text) units += glyphWidth(character);
  return (units / 1000) * size;
}

/**
 * What the font can actually draw.
 *
 * Typographic punctuation is transliterated to its ASCII equivalent, because a
 * smart quote from a merchant's name otherwise has no glyph; anything left
 * outside the font's own range becomes `?`.
 */
const TRANSLITERATIONS: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2026': '...',
  '\u00a0': ' ',
  '\u20ac': 'EUR',
};

function drawable(text: string): string {
  let result = '';
  for (const character of text) {
    const replacement = TRANSLITERATIONS[character] ?? character;
    for (const candidate of replacement) {
      const code = candidate.charCodeAt(0);
      const legal = code === 9 || code === 10 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);
      result += legal ? candidate : '?';
    }
  }
  return result;
}

/** A literal string, with the three characters the format reserves escaped. */
function literal(text: string): string {
  return drawable(text).replace(/([\\()])/g, '\\$1');
}

/** Text cut to a column, with an ellipsis when it does not fit. */
function fit(text: string, width: number, size: number): string {
  const drawn = drawable(text);
  if (textWidth(drawn, size) <= width) return drawn;

  let kept = '';
  for (const character of drawn) {
    if (textWidth(`${kept}${character}...`, size) > width) break;
    kept += character;
  }
  return `${kept.trimEnd()}...`;
}

const n = (value: number): string => value.toFixed(2);

/** One run of text, positioned from the TOP of the page so the layout reads downwards. */
function show(font: string, size: number, x: number, top: number, text: string): string {
  return `BT /${font} ${size} Tf 1 0 0 1 ${n(x)} ${n(PAGE_HEIGHT - top)} Tm (${literal(text)}) Tj ET`;
}

/** The same, right-aligned on `right`. */
function showRight(font: string, size: number, right: number, top: number, text: string): string {
  return show(font, size, right - textWidth(drawable(text), size), top, text);
}

/** A hairline rule across the page. */
function rule(top: number, from = MARGIN, to = RIGHT_EDGE, weight = 0.6): string {
  return `${weight} w 0.12 0.12 0.12 RG ${n(from)} ${n(PAGE_HEIGHT - top)} m ${n(to)} ${n(PAGE_HEIGHT - top)} l S`;
}

/** The letterhead and the facts about the statement. First page only. */
function letterhead(document: StatementDocument): string[] {
  const ops = [
    show(FONT_BOLD, 24, MARGIN, 34, 'Seti'),
    showRight(FONT, 11, RIGHT_EDGE, 34, 'Account statement'),
    rule(48),
    // Left: who, and on which network.
    show(FONT_BOLD, HEADER_SIZE, MARGIN, 68, 'Account'),
    show(FONT, 9, MARGIN, 80, document.account.email),
    show(FONT_BOLD, HEADER_SIZE, MARGIN, 96, 'Network'),
    show(FONT, 9, MARGIN, 108, `${document.networkLabel} (${document.network})`),
    // Right: what period, in what money, produced when.
    show(FONT_BOLD, HEADER_SIZE, 430, 68, 'Period'),
    show(FONT, 9, 430, 80, `${displayDate(document.from)} - ${displayDate(document.to)}`),
    show(FONT_BOLD, HEADER_SIZE, 430, 96, 'Currency'),
    show(FONT, 9, 430, 108, `${document.currency} - all amounts`),
    show(FONT_BOLD, HEADER_SIZE, 430, 124, 'Generated'),
    show(FONT, 9, 430, 136, `${displayTimestamp(document.generatedAt)} UTC`),
    rule(152),
  ];

  return ops;
}

/** The column header row. Repeated on every page, so a loose sheet is still readable. */
function tableHeader(currency: string, top: number): string[] {
  const [date, description, counterparty, amount, fee, status, reference] =
    statementHeaders(currency);

  return [
    show(FONT_BOLD, HEADER_SIZE, COLUMNS.date.x, top, date),
    show(FONT_BOLD, HEADER_SIZE, COLUMNS.description.x, top, description),
    show(FONT_BOLD, HEADER_SIZE, COLUMNS.counterparty.x, top, counterparty),
    // Aligned exactly as the figures below them are.
    showRight(FONT_BOLD, HEADER_SIZE, COLUMNS.amountRight, top, amount),
    showRight(FONT_BOLD, HEADER_SIZE, COLUMNS.feeRight, top, fee),
    show(FONT_BOLD, HEADER_SIZE, COLUMNS.status.x, top, status),
    show(FONT_BOLD, HEADER_SIZE, COLUMNS.reference.x, top, reference),
    rule(top + 4, MARGIN, RIGHT_EDGE, 0.4),
  ];
}

/** One ledger row. */
function rowOps(row: StatementRow, top: number): string[] {
  return [
    show(FONT, CELL_SIZE, COLUMNS.date.x, top, displayTimestamp(row.date)),
    show(
      FONT,
      CELL_SIZE,
      COLUMNS.description.x,
      top,
      fit(row.description, COLUMNS.description.width, CELL_SIZE)
    ),
    show(
      FONT,
      CELL_SIZE,
      COLUMNS.counterparty.x,
      top,
      fit(row.counterparty, COLUMNS.counterparty.width, CELL_SIZE)
    ),
    // A row with no recorded fiat figure shows a dash: an amount of 0.00 would be
    // a claim about what it was worth.
    row.amount === null
      ? showRight(FONT, CELL_SIZE, COLUMNS.amountRight, top, '-')
      : showRight(FONT, CELL_SIZE, COLUMNS.amountRight, top, displayAmount(row.amount)),
    row.platformFee === null
      ? showRight(FONT, SMALL_SIZE, COLUMNS.feeRight, top, '-')
      : showRight(FONT, SMALL_SIZE, COLUMNS.feeRight, top, displayAmount(row.platformFee)),
    show(FONT, SMALL_SIZE, COLUMNS.status.x, top, row.status),
    show(FONT, SMALL_SIZE, COLUMNS.reference.x, top, row.reference ?? ''),
  ];
}

/** The totals, under the last row of the last page of rows. */
function totalsOps(document: StatementDocument, top: number): string[] {
  const ops = [
    rule(top, MARGIN, RIGHT_EDGE, 0.4),
    show(FONT_BOLD, 8, COLUMNS.description.x, top + 14, 'Total amount'),
    showRight(FONT_BOLD, 8, COLUMNS.amountRight, top + 14, displayAmount(document.totals.amount)),
    show(FONT_BOLD, 8, COLUMNS.counterparty.x, top + 14, 'Platform fees'),
    showRight(
      FONT,
      8,
      COLUMNS.feeRight,
      top + 14,
      displayAmount(document.totals.platformFee)
    ),
  ];

  // A total that quietly leaves rows out is a wrong total, so it says so.
  if (document.totals.rowsWithoutAmount > 0) {
    ops.push(
      show(
        FONT,
        SMALL_SIZE,
        COLUMNS.description.x,
        top + 28,
        `${document.totals.rowsWithoutAmount} row(s) carry no recorded ${document.currency} figure and are excluded above.`
      )
    );
  }

  return ops;
}

/** The page footer. `page` is 1-based; the count is known once the pages are built. */
function footerOps(page: number, total: number, document: StatementDocument): string[] {
  return [
    rule(PAGE_HEIGHT - 46, MARGIN, RIGHT_EDGE, 0.4),
    show(
      FONT,
      SMALL_SIZE,
      MARGIN,
      PAGE_HEIGHT - 34,
      `Seti - account statement - ${document.account.email} - ${calendarDay(document.from)} to ${calendarDay(document.to)}`
    ),
    showRight(FONT, SMALL_SIZE, RIGHT_EDGE, PAGE_HEIGHT - 34, `Page ${page} of ${total}`),
  ];
}

/**
 * Lay the document out, page by page.
 *
 * The row is measured BEFORE it is drawn, so a row that would fall through the
 * bottom margin starts the next page instead of being split or lost — which is the
 * whole of "page breaks are handled". The LAST row is measured with the totals
 * block added to it, so the totals can never be drawn on top of the footer.
 */
function layout(document: StatementDocument): string[][] {
  const pages: string[][] = [];
  let ops = letterhead(document);
  let top = 172;

  ops.push(...tableHeader(document.currency, top));
  top += 16;

  if (document.rows.length === 0) {
    ops.push(show(FONT, CELL_SIZE, COLUMNS.description.x, top, 'No transactions in this period.'));
    pages.push(ops);
  } else {
    document.rows.forEach((row, index) => {
      const lastRow = index === document.rows.length - 1;
      const needed = lastRow ? ROW_HEIGHT + TOTALS_RESERVE : ROW_HEIGHT;

      if (top + needed > BODY_BOTTOM) {
        pages.push(ops);
        // A continuation page opens with the column header again.
        ops = tableHeader(document.currency, 62);
        top = 78;
      }

      ops.push(...rowOps(row, top));
      top += ROW_HEIGHT;
    });
    pages.push(ops);
  }

  // The totals belong with the last row. The room was reserved when that row was
  // placed, so this is the check that the reservation held — and a new page is
  // still the answer if it did not.
  const totalsTop = document.rows.length === 0 ? 24 + top : top + 6;
  if (totalsTop + 28 > TOTALS_BOTTOM) {
    pages.push([...tableHeader(document.currency, 62), ...totalsOps(document, 82)]);
  } else {
    pages[pages.length - 1].push(...totalsOps(document, totalsTop));
  }

  return pages.map((pageOps, index) => [
    ...pageOps,
    ...footerOps(index + 1, pages.length, document),
  ]);
}

/** A PDF content stream, deflated. */
function contentStream(ops: string[]): Buffer {
  return deflateSync(Buffer.from(ops.join('\n'), 'latin1'), { level: 9 });
}

const HELVETICA = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
const HELVETICA_BOLD =
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

/** The whole document, as the bytes of a PDF file. */
export function renderStatementPdf(document: StatementDocument): Buffer {
  const pages = layout(document);
  const pageCount = pages.length;

  // 1 catalog, 2 page tree, then two objects per page, then the fonts and /Info.
  const pageObject = (index: number): number => 3 + index * 2;
  const contentObject = (index: number): number => 4 + index * 2;
  const fontObject = 3 + pageCount * 2;
  const fontBoldObject = fontObject + 1;
  const infoObject = fontBoldObject + 1;
  const highestObject = infoObject;

  const bodies = new Map<number, Buffer>();
  const text = (value: string): Buffer => Buffer.from(value, 'latin1');

  bodies.set(1, text('<< /Type /Catalog /Pages 2 0 R >>'));
  bodies.set(
    2,
    text(
      `<< /Type /Pages /Kids [${pages
        .map((_, index) => `${pageObject(index)} 0 R`)
        .join(' ')}] /Count ${pageCount} >>`
    )
  );

  pages.forEach((ops, index) => {
    const stream = contentStream(ops);
    bodies.set(
      pageObject(index),
      text(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /${FONT} ${fontObject} 0 R /${FONT_BOLD} ${fontBoldObject} 0 R >> >> ` +
          `/Contents ${contentObject(index)} 0 R >>`
      )
    );
    bodies.set(
      contentObject(index),
      Buffer.concat([
        text(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`),
        stream,
        text('\nendstream'),
      ])
    );
  });

  bodies.set(fontObject, text(HELVETICA));
  bodies.set(fontBoldObject, text(HELVETICA_BOLD));
  bodies.set(
    infoObject,
    text(
      `<< /Title (Seti account statement ${literal(calendarDay(document.from))} to ${literal(
        calendarDay(document.to)
      )}) /Author (Seti) /Creator (Seti) /Producer (Seti) >>`
    )
  );

  const chunks: Buffer[] = [text('%PDF-1.4\n'), Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
  let offset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const offsets = new Map<number, number>();

  const push = (chunk: Buffer): void => {
    chunks.push(chunk);
    offset += chunk.length;
  };

  for (let number = 1; number <= highestObject; number += 1) {
    const body = bodies.get(number);
    if (!body) continue;

    offsets.set(number, offset);
    push(text(`${number} 0 obj\n`));
    push(body);
    push(text('\nendobj\n'));
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${highestObject + 1}\n0000000000 65535 f \n`;
  for (let number = 1; number <= highestObject; number += 1) {
    xref += `${String(offsets.get(number) ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${highestObject + 1} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  push(text(xref));

  return Buffer.concat(chunks);
}
