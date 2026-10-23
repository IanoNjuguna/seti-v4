import { stringToHex, type Hex } from 'viem';

/**
 * The 32-byte memo that makes a payment matchable to a charge, and the refusals
 * that stop a payment being built without one (#184).
 *
 * Tempo's TIP-20 adds exactly one thing to ERC-20 for this purpose:
 * `transferWithMemo(address to, uint256 amount, bytes32 memo)`, which emits
 * `TransferWithMemo(from, to, amount, memo)` beside the ordinary `Transfer`. A
 * charge carries no other identifier on chain, so the memo is the ONLY thing that
 * says which request a payment answers. The backend refuses a transfer without it
 * by code (`memo-missing-charge-id`, `backend/src/services/charge.ts`), which means
 * a plain `transfer` to a charge's recipient moves the money and settles nothing:
 * the customer has paid, the merchant has been paid, and the charge stays
 * `pending` forever with no error on either side.
 *
 * ## The encoding is the matcher's inverse, not a second convention
 *
 * Read off `memoFromBytes32` (now `backend/src/lib/tip20-memo.ts`, re-exported by
 * `backend/src/services/charge-match.ts`), which does
 * `hexToString(memo, { size: 32 })` and then strips the trailing NUL bytes. So the
 * charge id is written as its UTF-8 bytes, right-padded with zeroes to 32 bytes,
 * and `stringToHex(id, { size: 32 })` is precisely that. `check:memo-always`
 * decodes every built memo back through the matcher's own `memoFromBytes32` rather
 * than a copy of it, so the two directions cannot drift apart while a check says
 * they agree.
 *
 * That is also why an id longer than 32 bytes is REFUSED instead of hashed or
 * truncated. The matcher asserts `memo.includes(chargeId)` on the decoded text, so
 * a spent hash or a cut-off id decodes to something that can never equal the
 * charge id it was built for. An unmatchable payment is the exact bug this module
 * exists to prevent, so it is not a shape this module will produce: TIP-20's own
 * guidance is "pack shorter strings directly into this field", and a charge id is
 * short by construction.
 *
 * ## Why the id is carried verbatim
 *
 * Not trimmed, not lower-cased, not normalised. The matcher compares the whole
 * decoded string against the stored id, so `"ch_x "` trimmed to `"ch_x"` would be
 * a DIFFERENT id than the one on the charge. Blank is refused; anything non-blank
 * travels exactly as it arrived.
 */

/** A Tempo memo is a fixed 32 bytes. See the TIP-20 spec, "Memos". */
export const CHARGE_MEMO_BYTES = 32;

/**
 * A payment that answers a charge cannot be built without a matchable memo.
 *
 * A distinct class rather than a bare `Error`: the pay surface shows `message`
 * verbatim, and that message names the CAUSE (no id, or an id that cannot fit) in
 * words a person can act on rather than "something went wrong". The check asserts
 * on the class, so a later generic throw cannot stand in for the guard.
 */
export class ChargeMemoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChargeMemoUnavailableError';
  }
}

/**
 * The `bytes32` memo a charge's payment must carry.
 *
 * Throws {@link ChargeMemoUnavailableError} for the two cases that cannot be
 * matched rather than returning something plausible: no id at all, and an id that
 * does not fit in 32 bytes.
 */
export function memoForCharge(chargeId: string | null | undefined): Hex {
  if (typeof chargeId !== 'string' || chargeId.trim() === '') {
    throw new ChargeMemoUnavailableError(
      'This payment answers a charge, but no charge id came with it. A Tempo transfer ' +
        'carries the charge id in a 32-byte memo, so a payment without one would arrive as an ' +
        'anonymous transfer that could never be matched to the request. Refusing to build it.'
    );
  }

  /**
   * The byte count, from the encoder that will actually be used.
   *
   * `stringToHex` without a size is the UTF-8 encoding, so its length is the length
   * the chain would see. Measured before the padded call so the refusal is ours
   * and says why, instead of viem's padding error surfacing as an opaque crash.
   */
  const byteLength = (stringToHex(chargeId).length - 2) / 2;
  if (byteLength > CHARGE_MEMO_BYTES) {
    throw new ChargeMemoUnavailableError(
      `Charge ${chargeId} is ${byteLength} bytes and a Tempo memo holds ${CHARGE_MEMO_BYTES}. ` +
        'Hashing or truncating it would decode to something the matcher can never compare with ' +
        'the charge, so this payment cannot be built. Charge ids are short by construction: this ' +
        'one is either corrupted or from another system.'
    );
  }

  return stringToHex(chargeId, { size: CHARGE_MEMO_BYTES });
}
