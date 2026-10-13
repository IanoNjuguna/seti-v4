import type { ReceiptDocument } from '@/lib/api';

/** How a share attempt ended. Drives the confirmation, not the UI's shape. */
export type ShareOutcome = 'shared' | 'copied' | 'failed' | 'dismissed';

/** The two states a payment can be in, as the card states them. */
export type ReceiptStatusTone = 'positive' | 'negative';

export interface ReceiptSheetProps {
  /** The ledger row's id — the receipt is keyed by the row, never by the hash. */
  transactionId: string;
  onClose: () => void;
}

export interface UseReceiptReturn {
  receipt: ReceiptDocument | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * The proof of payment, derived from the document: everything the card draws,
 * already formatted. Derived in a hook so no component formats, sums or picks a
 * currency while it renders.
 */
export interface ReceiptCard {
  /** 'Paid' or 'Received' — the word above the figure. */
  word: string;
  /** What the payee received, in `currency`. Never the transaction total. */
  figure: string;
  /** The currency the figure is in, or null when it is a token amount. */
  currency: string | null;
  party: ReceiptParty;
  /** Date and time, on one line. */
  dateTime: string;
  status: ReceiptStatusLine;
  /** The one combined fee line, or null when no fee figure can be stated. */
  fee: ReceiptFeeLine | null;
  explorerUrl: string;
}

/** Who is on the other side. The address is the thing that cannot lie. */
export interface ReceiptParty {
  /** The merchant's name when the receipt carries one, else a plain description. */
  label: string;
  /** True when `label` is a name the document recorded, not a description. */
  named: boolean;
  /** The counterparty's own address, full. Empty when it is not known. */
  address: string;
  shortAddress: string;
}

export interface ReceiptStatusLine {
  label: string;
  tone: ReceiptStatusTone;
}

/** The platform fee and the network fee, summed into one figure. */
export interface ReceiptFeeLine {
  label: string;
  /** The summed figure, or `—` when the row names no currency to print it in. */
  amount: string;
}

export interface ReceiptCardProps {
  card: ReceiptCard;
}

export interface ReceiptFigureProps {
  word: string;
  figure: string;
  /** The dialog's accessible name points at the figure — it IS the receipt. */
  titleId: string;
}

export interface ReceiptPartyLineProps {
  party: ReceiptParty;
}

export interface ReceiptWhenProps {
  dateTime: string;
  status: ReceiptStatusLine;
}

export interface ReceiptFooterProps {
  fee: ReceiptFeeLine | null;
  explorerUrl: string;
}

/** Everything inside the dialog: the card, in whichever state it is in. */
export interface ReceiptBodyProps {
  card: ReceiptCard | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  actions: UseReceiptActionsReturn;
}

export interface ReceiptActionsProps {
  actions: UseReceiptActionsReturn;
}

export interface UseReceiptActionsReturn {
  share: () => void;
  downloadPdf: () => void;
  downloadTxt: () => void;
  downloadJson: () => void;
  /** Confirmation for the last action, or null. Announced politely. */
  status: string | null;
}

export interface ReceiptErrorProps {
  message: string;
  onRetry: () => void;
}

export interface UseReceiptDialogReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}
