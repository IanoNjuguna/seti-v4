import type { StatementFormat } from '@/lib/api';

/**
 * What the statement row offers, in the order it offers them.
 *
 * The formats are the row's content and they carry equal weight: none of them is
 * the "right" one, so the customer picks the one they need. PDF first because it
 * is the one a person can read or print; the two spreadsheets follow.
 */
export const STATEMENT_FORMATS: readonly StatementFormat[] = ['pdf', 'csv', 'xlsx'];

/**
 * The word on each control.
 *
 * The extension IS the label here — it is what the person is choosing, and
 * describing a file format's merits instead would be us telling them which to
 * want.
 */
export const STATEMENT_FORMAT_LABEL: Record<StatementFormat, string> = {
  pdf: 'PDF',
  csv: 'CSV',
  xlsx: 'XLSX',
};

/**
 * The row's copy, in one place so its label, its states and its button cannot
 * drift apart.
 */
export const STATEMENT_COPY = {
  title: 'Statement',
  /** One line, and what the person gets rather than what the format is for. */
  intro: 'Export every payment and transfer, in one file.',
  /** Names the group of three to a screen reader, which the buttons do not. */
  groupLabel: 'Statement format',
  /** Announced while a file is being made, which is not instant. */
  preparing: 'Preparing your statement',
  errorTitle: 'Could not make your statement',
  retry: 'Try again',
} as const;
