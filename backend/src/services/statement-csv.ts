/**
 * The statement as CSV: RFC 4180, CRLF, UTF-8 with a BOM.
 *
 * WHY EACH OF THOSE
 *
 *  - RFC 4180 quoting, because a counterparty is a NAME a person typed. "Java
 *    House, Westlands" contains a comma and takes the rest of the row with it;
 *    the fix is to quote the field and double any quote inside it, which is what
 *    `quote` does below for every field rather than for the fields we happen to
 *    expect trouble from.
 *  - CRLF, because that is the line ending the format specifies and the one Excel
 *    on Windows splits on.
 *  - A UTF-8 BOM, because without it Excel opens a plain CSV in the machine's
 *    legacy single-byte encoding: "KES" columns survive, but a Kenyan merchant
 *    name with an accent does not, and the amounts are read as text.
 *  - The figures as `1234.50` with NO thousands separator, because `1,234.50` is
 *    two fields in this format — the grouped form exists for the PDF, where a
 *    person reads it and a comma is punctuation.
 *
 * A field is quoted when it contains a comma, a quote, CR or LF; the quote
 * character is doubled inside a quoted field. The final record is not terminated,
 * so a parser reads exactly one record per row: a trailing CRLF would leave one
 * more, empty, record in a file a person is going to count.
 */
import {
  dataAmount,
  isoInstant,
  statementHeaders,
  type StatementDocument,
} from './statement-model.js';

const CRLF = '\r\n';

/** The byte order mark, which is why the CSV media type names its charset. */
const BOM = '\uFEFF';

/** One field, quoted only when the format requires it. */
function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** One record: the fields, each quoted as needed, joined by commas. */
function record(fields: string[]): string {
  return fields.map(quote).join(',');
}

/**
 * The whole statement as CSV text.
 *
 * The text still carries the BOM as its first character; the caller writes it out
 * as UTF-8, where it becomes the three bytes EF BB BF.
 */
export function renderStatementCsv(document: StatementDocument): string {
  const header = record(statementHeaders(document.currency));

  const lines = document.rows.map((row) =>
    record([
      // The instant, ISO 8601: a spreadsheet reads this as a date, and unlike a
      // locale string it means the same thing on every machine.
      isoInstant(row.date),
      row.description,
      row.counterparty,
      // Null is an EMPTY field, not 0.00: "no figure was recorded" and "this was
      // worth nothing" are different statements and only one of them is true.
      row.amount === null ? '' : dataAmount(row.amount),
      row.platformFee === null ? '' : dataAmount(row.platformFee),
      row.status,
      row.reference ?? '',
    ])
  );

  return BOM + [header, ...lines].join(CRLF);
}
