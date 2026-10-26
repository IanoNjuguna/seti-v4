import { previewPayment, previewSend, type SupportedAsset } from '@/lib/api';
import { resolvedAsset } from './resolved-asset';

/**
 * Ask the server which single token covers this amount, and refuse to answer when it
 * will not (#228, #232).
 *
 * The refusal deliberately does not name the token that could have paid: it is a
 * sentence for a person, not a dossier. So the way out is the same question with no
 * pin — an unpinned quote answers with the row the server would spend, which is the
 * one that covers, and refuses again when no single balance does. Nothing here adds
 * up balances or compares them to a fee, so the offer cannot disagree with the
 * preview that will actually be signed.
 *
 * The two flows ask the SAME question of the same service through `quoteTransfer`,
 * which is why they share this one function: they differ only in the body the
 * preview takes (a merchant, or a payee), never in the rule that decides the answer.
 *
 * Answers null when there is nothing to offer, which is the honest answer for an
 * amount spread across balances: then #223's sentence stands alone.
 */
async function offeredBy(ask: () => Promise<{ asset: string }>): Promise<SupportedAsset | null> {
  try {
    return resolvedAsset((await ask()).asset);
  } catch {
    return null;
  }
}

/** The balance that could cover a payment to a MERCHANT. */
export async function coveringAsset(input: {
  userId: string;
  amountFiat: string;
  merchantId: string;
}): Promise<SupportedAsset | null> {
  return offeredBy(async () => (await previewPayment(input)).preview);
}

/**
 * The balance that could cover a send to a PERSON (#232).
 *
 * The same question with a payee instead of a merchant. The recipient has to be the
 * one this send is for, because the send preview resolves and checksums it — an
 * offer asked about a different address would be an answer to a different send.
 */
export async function coveringSendAsset(input: {
  amountFiat: string;
  recipient: string;
}): Promise<SupportedAsset | null> {
  return offeredBy(async () => (await previewSend(input)).preview);
}
