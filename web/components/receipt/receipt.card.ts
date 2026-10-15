import type { ReceiptDocument, ReceiptLeg } from '@/lib/api';
import { RECEIPT_COPY, RECEIPT_GENERIC_PAYEE, RECEIPT_MISSING_FIGURE } from './Receipt.constants';
import {
  formatAssetAmount,
  formatFiatValue,
  formatReceiptDateTime,
  shortenValue,
} from './receipt.format';
import type { ReceiptCard, ReceiptFeeLine, ReceiptParty, ReceiptStatusTone } from './Receipt.types';

/**
 * The card's figures, each from the one place that can support it.
 *
 * The figure is the payee's own recorded fiat amount (`ledger.fiatAmount`) — the
 * thing the card exists to prove. It is deliberately NOT `total.amount`, which
 * on an outbound transfer is the principal plus the fee, i.e. more than the
 * payee ever received. When the row carries no usable fiat figure the card falls
 * back to the principal in the token's own units rather than labelling a number
 * with a currency nobody gave us.
 */
function fiatFigure(receipt: ReceiptDocument, currency: string | null): string | null {
  const amount = receipt.ledger.fiatAmount;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return formatFiatValue(amount, currency);
}

function paymentLeg(receipt: ReceiptDocument): ReceiptLeg | null {
  return receipt.legs.find((leg) => leg.role === 'payment') ?? null;
}

/** The principal the payment leg moved, in the token's own decimals. */
function assetFigure(receipt: ReceiptDocument): string {
  const leg = paymentLeg(receipt);
  return leg
    ? formatAssetAmount(leg.amount, leg.asset)
    : formatAssetAmount(receipt.total.amount, receipt.total.asset);
}

/**
 * The address on the other side of the payment.
 *
 * A leg is the customer's own when it touches their wallet, so the counterparty
 * is whichever end the payment leg did not take it from: the payee on an
 * outbound transfer, the sender on an inbound one.
 */
function counterpartyAddress(receipt: ReceiptDocument): string {
  const leg = paymentLeg(receipt) ?? receipt.legs.find((item) => item.role !== 'gas') ?? null;
  if (!leg) return '';

  return receipt.ledger.direction === 'in' ? leg.from : leg.to;
}

/**
 * The name the document recorded, if it recorded one.
 *
 * A payment leg labelled `Recipient` is the backend saying "no merchant here",
 * so it is a description rather than a name — and the card says so, rather than
 * inventing an identity for an address.
 */
function party(receipt: ReceiptDocument): ReceiptParty {
  const label = paymentLeg(receipt)?.label.trim() ?? '';
  const named = label.length > 0 && label.toLowerCase() !== RECEIPT_GENERIC_PAYEE.toLowerCase();
  const fallback = receipt.ledger.direction === 'in' ? RECEIPT_COPY.payerFallback : RECEIPT_COPY.payeeFallback;
  const address = counterpartyAddress(receipt);

  return {
    label: named ? label : fallback,
    named,
    address,
    shortAddress: shortenValue(address),
  };
}

function statusTone(receipt: ReceiptDocument): ReceiptStatusTone {
  return receipt.status === 'confirmed' ? 'positive' : 'negative';
}

/**
 * One fee line: the platform fee and the gas fee summed.
 *
 * Null on either side counts as nothing, never as a guess. On an inbound row the
 * fees were the sender's, so the line says whose they were instead of presenting
 * them as a charge the customer paid — the two figures are still not split: a
 * customer should never have to add up fees in a currency they did not choose.
 */
function feeLine(receipt: ReceiptDocument, currency: string | null): ReceiptFeeLine | null {
  const platform = receipt.ledger.platformFeeFiat;
  const network = receipt.networkFee.fiatAmount === null ? null : Number(receipt.networkFee.fiatAmount);
  if (platform === null && network === null) return null;

  const sum = (platform ?? 0) + (network ?? 0);

  return {
    label: receipt.ledger.direction === 'in' ? RECEIPT_COPY.feesPaidBySender : RECEIPT_COPY.feesPaid,
    amount: formatFiatValue(sum, currency) ?? RECEIPT_MISSING_FIGURE,
  };
}

/**
 * The document as the card, with `fallbackCurrency` used only when the row
 * itself names none.
 */
export function deriveReceiptCard(
  receipt: ReceiptDocument,
  fallbackCurrency: string | null
): ReceiptCard {
  const currency = receipt.ledger.fiatCurrency ?? receipt.total.fiatCurrency ?? fallbackCurrency;
  const fiat = fiatFigure(receipt, currency);
  const inbound = receipt.ledger.direction === 'in';

  return {
    word: inbound ? RECEIPT_COPY.received : RECEIPT_COPY.paid,
    figure: fiat ?? assetFigure(receipt),
    currency: fiat === null ? null : currency,
    party: party(receipt),
    dateTime: formatReceiptDateTime(receipt.timestamp),
    status: {
      label: receipt.status === 'confirmed' ? RECEIPT_COPY.confirmed : RECEIPT_COPY.failed,
      tone: statusTone(receipt),
    },
    // The network rides on the card so a screenshot or a shared link says which
    // chain moved the money. Falls back to the raw value if the backend did not
    // send a label, rather than to a guess about which network it was.
    networkLabel: receipt.networkLabel || receipt.network,
    network: receipt.network,
    fee: feeLine(receipt, currency),
    explorerUrl: receipt.explorerUrl,
  };
}

/**
 * The card as plain text: the same lines the screen shows, in the same order, so
 * the printed or saved artifact looks like the proof rather than like the audit
 * trail. The address is the full one — a text file has the room, and a shortened
 * address in the only copy the customer saved would prove nothing.
 *
 * The full response is still what the JSON export carries; this is the card.
 */
export function buildReceiptText(receipt: ReceiptDocument, fallbackCurrency: string | null): string {
  const card = deriveReceiptCard(receipt, fallbackCurrency);

  return [
    `Seti — Payment receipt`,
    '',
    `${RECEIPT_COPY.networkPrefix} ${card.networkLabel}`,
    '',
    card.word,
    card.figure,
    '',
    card.party.label,
    card.party.address,
    '',
    card.dateTime,
    card.status.label,
    '',
    ...(card.fee ? [`${card.fee.label}\t${card.fee.amount}`] : []),
    '',
    `View on the explorer\t${card.explorerUrl}`,
    '',
  ].join('\n');
}
