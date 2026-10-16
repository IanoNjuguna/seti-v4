/**
 * The statement as XLSX: a real workbook, written here, with no dependency.
 *
 * WHY A DEPENDENCY WAS NOT ADDED
 *
 * The formats this needs are shipped by Node itself: `zlib.deflateRawSync` for
 * the container and `Buffer` for the bytes. An .xlsx IS a zip of a handful of XML
 * parts, and the parts a statement needs are five small files written below. The
 * alternative was a package that pulls in tens of megabytes of tree and, in the
 * maintained cases, a chain of transitive dependencies — on a service that has to
 * deploy on a free tier, for cells this file already knows how to write. The
 * check suite proves the result with an independent zip reader (EOCD, central
 * directory, CRC32 of every part) rather than trusting this writer.
 *
 * WHAT IT DOES DO PROPERLY, because a spreadsheet that opens but lies is worse
 * than no spreadsheet:
 *
 *  - amounts are NUMERIC cells (`<v>` with no `t`), formatted `#,##0.00` by a
 *    number format, so they sort, sum and convert. A money column of strings is
 *    the failure this exists to avoid;
 *  - the date is a real date cell — the Excel serial with a `yyyy-mm-dd hh:mm`
 *    format — not a string;
 *  - the columns carry widths, so the statement is readable rather than a row of
 *    `####`;
 *  - the header row is bold, and frozen so it stays put when the sheet is scrolled.
 */
import { deflateRawSync } from 'node:zlib';
import {
  dataAmount,
  isoInstant,
  statementHeaders,
  type StatementDocument,
  type StatementRow,
} from './statement-model.js';

/** Excel's epoch: serial 25569 is 1970-01-01 (1900 date system, leap bug included). */
const EXCEL_EPOCH_OFFSET = 25569;
const MS_PER_DAY = 86_400_000;

/** A `Date` as the serial number Excel stores. */
function excelSerial(date: Date): number {
  return Math.round((date.getTime() / MS_PER_DAY + EXCEL_EPOCH_OFFSET) * 1e6) / 1e6;
}

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * Text as XML.
 *
 * Control characters are dropped rather than escaped: XML 1.0 has no legal
 * representation for most of them, and a single one anywhere in a merchant's name
 * makes Excel refuse the whole workbook.
 */
function xml(value: string): string {
  let cleaned = '';

  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    cleaned += character;
  }

  return cleaned.replace(/[&<>"']/g, (character) => XML_ENTITIES[character] ?? character);
}

// ---------------------------------------------------------------------------
// The zip container
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

/** The CRC32 of a part, which the central directory must carry for it. */
function crc32(data: Buffer): number {
  let crc = -1;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

interface ZipPart {
  name: string;
  data: Buffer;
}

/**
 * A minimal, spec-correct zip: local headers, the central directory, the end
 * record. Deflate for every entry, UTF-8 names, and a FIXED timestamp so the same
 * statement serialises to the same bytes.
 */
function zip(parts: ZipPart[]): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  // MS-DOS date for 1980-01-01 — the earliest the format can express, and
  // constant, so a statement is reproducible.
  const dosTime = 0;
  const dosDate = ((1980 - 1980) << 9) | (1 << 5) | 1;
  let offset = 0;

  for (const part of parts) {
    const name = Buffer.from(part.name, 'utf8');
    const compressed = deflateRawSync(part.data, { level: 9 });
    const checksum = crc32(part.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(part.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // no extra field

    localChunks.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(part.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42);

    centralChunks.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDirectory, end]);
}

// ---------------------------------------------------------------------------
// The workbook
// ---------------------------------------------------------------------------

/** The column widths, in Excel's character units, per the shared column order. */
const COLUMN_WIDTHS = [20, 34, 26, 16, 16, 12, 24];

const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const SHEET_NAME = 'Statement';

/** Cell style indices into `styles.xml` below. */
const STYLE = {
  body: 0,
  header: 1,
  money: 2,
  date: 3,
} as const;

function cell(reference: string, style: number, value: string, type = ''): string {
  const attributes = `${type ? ` t="${type}"` : ''}${style ? ` s="${style}"` : ''}`;
  return `<c r="${reference}"${attributes}>${value}</c>`;
}

function inlineString(reference: string, style: number, value: string): string {
  return cell(reference, style, `<is><t>${xml(value)}</t></is>`, 'inlineStr');
}

function numberCell(reference: string, style: number, value: number): string {
  return cell(reference, style, `<v>${value}</v>`);
}

function sheetRow(index: number, cells: string[]): string {
  return `<row r="${index}">${cells.join('')}</row>`;
}

/** The header row: the shared column names, bold. */
function headerRow(currency: string): string {
  return sheetRow(
    1,
    statementHeaders(currency).map((label, column) =>
      inlineString(`${COLUMN_LETTERS[column]}1`, STYLE.header, label)
    )
  );
}

/** One ledger row. */
function dataRow(row: StatementRow, index: number): string {
  const cells: string[] = [
    numberCell(`A${index}`, STYLE.date, excelSerial(row.date)),
    inlineString(`B${index}`, STYLE.body, row.description),
    inlineString(`C${index}`, STYLE.body, row.counterparty),
    // An absent figure is an EMPTY cell, never a zero and never a string.
    row.amount === null
      ? cell(`D${index}`, STYLE.money, '')
      : numberCell(`D${index}`, STYLE.money, Number(dataAmount(row.amount))),
    row.platformFee === null
      ? cell(`E${index}`, STYLE.money, '')
      : numberCell(`E${index}`, STYLE.money, Number(dataAmount(row.platformFee))),
    inlineString(`F${index}`, STYLE.body, row.status),
    inlineString(`G${index}`, STYLE.body, row.reference ?? ''),
  ];

  return sheetRow(index, cells);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
<numFmt numFmtId="164" formatCode="#,##0.00;-#,##0.00"/>
<numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/>
</numFmts>
<fonts count="2">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="2">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function workbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${SHEET_NAME}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function sheetXml(document: StatementDocument): string {
  const rows = [
    headerRow(document.currency),
    ...document.rows.map((row, index) => dataRow(row, index + 2)),
  ];

  const columns = COLUMN_WIDTHS.map(
    (width, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  ).join('');

  const lastRow = Math.max(rows.length, 1);
  const dimension = `A1:${COLUMN_LETTERS[COLUMN_LETTERS.length - 1]}${lastRow}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${columns}</cols>
<sheetData>${rows.join('')}</sheetData>
</worksheet>`;
}

function coreXml(document: StatementDocument): string {
  const created = isoInstant(document.generatedAt);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Seti account statement</dc:title>
<dc:creator>Seti</dc:creator>
<cp:lastModifiedBy>Seti</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created>
</cp:coreProperties>`;
}

/** The statement as a workbook, ready to write to a response. */
export function renderStatementXlsx(document: StatementDocument): Buffer {
  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(ROOT_RELS, 'utf8') },
    { name: 'docProps/core.xml', data: Buffer.from(coreXml(document), 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbookXml(), 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(WORKBOOK_RELS, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(STYLES, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheetXml(document), 'utf8') },
  ]);
}
