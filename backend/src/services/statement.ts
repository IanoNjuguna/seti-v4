/**
 * The statement service: one account's own ledger, read once, written three ways.
 *
 * The reads below are the SAME reads the Activity list makes — `userId` scoped, and
 * scoped by the SESSION's network — because a statement is a view of one ledger,
 * not a second ledger. A practice top-up must never appear in a live customer's
 * statement, and the network is the session's, never the request's.
 *
 * The rows are read OLDEST FIRST. Activity is newest first because it answers "what
 * just happened"; a statement answers "what happened between these two dates", and a
 * ledger that reads forwards is one a person can check with a running total.
 *
 * Nothing here is a second interpretation of a row: the description comes from the
 * shared mapper (`toRecentTransaction`), the figures from the row's own fiat
 * columns, and the reference from the app's own receipt id. See `statement-model.ts`
 * for what each column means and why.
 */
import { prisma } from '../lib/prisma.js';
import { NETWORK_LABEL, type Network } from '../lib/network.js';
import { DEFAULT_FIAT, isEnabledFiat } from './payments.js';
import { receiptIdFor } from './receipt-link.js';
import { renderStatementCsv } from './statement-csv.js';
import { renderStatementPdf } from './statement-pdf.js';
import { renderStatementXlsx } from './statement-xlsx.js';
import {
  statementRowFrom,
  statementTotalsOf,
  type StatementDocument,
  type StatementFormat,
  type StatementRow,
} from './statement-model.js';

/** What a statement is built for. */
export interface StatementRequest {
  /** The caller. There is no way to ask for anybody else's statement. */
  userId: string;
  /** The network the request is served under — the session's, never the request's. */
  network: Network;
  /** Inclusive period. Omitted ends run to the account's own history. */
  from?: Date | null;
  to?: Date | null;
  /** When the file was produced. Injectable so a check can pin it. */
  now?: Date;
}

/**
 * The account, as the statement's letterhead names it: its own money and the
 * address it was opened with.
 *
 * The customer's currency is stored on the account (`User.fiatCurrency`) and the
 * app prices in `ENABLED_FIAT`; a stored code that is no longer enabled is not a
 * currency this app can produce figures in, so it falls back to the default rather
 * than labelling KES amounts with a code that no longer means anything.
 *
 * An account that cannot be found is not a reason to refuse the read: the
 * middleware already resolved this id from a verified token, and the statement it
 * would produce is a correct, empty one. The email is left blank rather than
 * invented.
 */
async function accountHeading(userId: string): Promise<{ email: string; currency: string }> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, fiatCurrency: true },
  });

  const stored = account?.fiatCurrency ?? DEFAULT_FIAT;
  return {
    email: account?.email ?? '',
    currency: isEnabledFiat(stored) ? stored : DEFAULT_FIAT,
  };
}

/**
 * The account's statement, as a document.
 *
 * `reference` is the receipt reference the app already gives out: `receiptIdFor`,
 * the opaque id in a `/r/<id>` share link. It is NULL for a row with nothing on
 * chain, because such a row has no receipt to reference and printing an id that
 * resolves to nothing would be a claim the app cannot honour. The row's database id
 * appears nowhere in any format.
 */
export async function buildStatement(input: StatementRequest): Promise<StatementDocument> {
  const account = await accountHeading(input.userId);

  const stored = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      network: input.network,
      ...(input.from || input.to
        ? {
            createdAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    },
    include: { merchant: true, wallet: true },
    orderBy: { createdAt: 'asc' },
  });

  const rows: StatementRow[] = stored.map((row) =>
    statementRowFrom(row, row.txHash ? receiptIdFor(row.id) : null)
  );

  // The period the document states is the period it COVERS: an omitted end is
  // pinned to the oldest and newest rows actually in it, so the header and the
  // filename describe the history rather than the question that was asked. An
  // account with no rows has no history to name, so the day it was produced is
  // the answer.
  const produced = input.now ?? new Date();
  const first = rows[0]?.date ?? produced;
  const last = rows[rows.length - 1]?.date ?? produced;

  return {
    account: { email: account.email },
    network: input.network,
    networkLabel: NETWORK_LABEL[input.network],
    currency: account.currency,
    from: input.from ?? first,
    to: input.to ?? last,
    generatedAt: produced,
    rows,
    totals: statementTotalsOf(rows),
  };
}

/** The document as the bytes of a file, in the requested format. */
export function renderStatement(document: StatementDocument, format: StatementFormat): Buffer {
  switch (format) {
    case 'csv':
      // The BOM inside the string becomes the three bytes a spreadsheet needs.
      return Buffer.from(renderStatementCsv(document), 'utf8');
    case 'xlsx':
      return renderStatementXlsx(document);
    case 'pdf':
      return renderStatementPdf(document);
  }
}
