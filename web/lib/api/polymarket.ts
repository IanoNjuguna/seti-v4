import { del, get, put } from './client';
import type { PolymarketView } from './polymarket.types';

/**
 * The Polymarket card's three calls (#599): read, link, forget.
 *
 * All three are reads of an external account, except the second and third, which only
 * store and remove WHICH account to read. Nothing in this file moves money, and there is
 * no key for a foreign chain anywhere behind it — which is what lets the card ship before
 * any decision about trading.
 *
 * A refusal arrives as `ApiError` carrying a machine-readable code
 * (`polymarket-retired`, `polymarket-unavailable`, `polymarket-payload`,
 * `polymarket-address-invalid`), so the card shows its own sentence per code rather than
 * a generic failure. A failed read is never rendered as a zero: that is the whole reason
 * these codes exist.
 */
export function fetchPolymarketPositions(): Promise<PolymarketView> {
  return get<PolymarketView>('/integrations/polymarket/positions');
}

export interface LinkPolymarketResult {
  linked: true;
  address: string;
}

export function linkPolymarketAddress(address: string): Promise<LinkPolymarketResult> {
  return put<LinkPolymarketResult>('/integrations/polymarket/address', { address: address.trim() });
}

export function unlinkPolymarketAddress(): Promise<{ linked: false }> {
  return del<{ linked: false }>('/integrations/polymarket/address');
}
