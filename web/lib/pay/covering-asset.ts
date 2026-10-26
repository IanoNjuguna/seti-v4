import { previewPayment, type SupportedAsset } from '@/lib/api';
import { resolvedAsset } from './resolved-asset';

/**
 * Which single token CAN cover this amount, asked of the server rather than worked
 * out on this side (#228).
 *
 * The refusal deliberately does not name the token that could have paid: it is a
 * sentence for a person, not a dossier. So the way out is the same question with no
 * pin — an unpinned quote answers with the row the server would spend, which is the
 * one that covers, and refuses again when no single balance does. Nothing here adds
 * up balances or compares them to a fee, so the offer cannot disagree with the
 * preview that will actually be signed.
 *
 * Answers null when there is nothing to offer, which is the honest answer for an
 * amount spread across balances: then #223's sentence stands alone.
 */
export async function coveringAsset(input: {
  userId: string;
  amountFiat: string;
  merchantId: string;
}): Promise<SupportedAsset | null> {
  try {
    const { preview } = await previewPayment(input);
    return resolvedAsset(preview.asset);
  } catch {
    return null;
  }
}
