import { ASSET_DECIMALS, type SupportedAsset } from '@/lib/chain';

/**
 * The asset the server resolved for a quote.
 *
 * The client does not choose one unless the customer pins it. A customer whose
 * money arrived as USDT0 has a zero OUSD balance, so signing OUSD regardless
 * refused a payment they could afford — the bug a bridged deposit exposed. The
 * server picks from what they hold (`pickSpendAsset`) and this reads its answer,
 * so the principal leg, the fee leg and the recorded label are all the same token.
 *
 * The cast is guarded rather than asserted: an unrecognised label means this build
 * and the backend disagree about the asset set, which must fail loudly instead of
 * signing a transfer against a contract this build has no address for.
 */
export function resolvedAsset(value: string): SupportedAsset {
  if (!(value in ASSET_DECIMALS)) {
    throw new Error(
      `The quote named an asset this build does not support (${value}). ` +
        'Update the app before paying.'
    );
  }
  return value as SupportedAsset;
}
