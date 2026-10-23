import { hexToString, type Hex } from 'viem';

/**
 * One TIP-20 `bytes32` memo, read back as text.
 *
 * This is the charge id's decoding, and it is deliberately alone in a file with no
 * imports of its own beyond viem. Everything else in the charge path — the
 * classifier, the matcher, the store, the indexer — needs a database client, an RPC
 * client or a validated environment to load, and none of that is needed to turn 32
 * bytes into a string. The reason that matters is #184: the pay page's builder lives
 * in the other workspace package, and the check that proves the builder writes a memo
 * the MATCHER can read has to call the matcher's own function rather than a copy of
 * it. A copy agrees with itself forever; this one is the single implementation. It is
 * imported by `services/charge-match.ts` and re-exported from there, so the matcher
 * and the indexer keep one import path, and `web/scripts/check-memo-always.mjs`
 * imports it directly so the check can decode calldata without loading a database.
 *
 * ## The encoding, stated once
 *
 * A memo is a fixed 32 bytes, right-padded with zeroes after the text. The charge id
 * is short enough to sit in the field as its own UTF-8 bytes, so a payment writes
 * `stringToHex(chargeId, { size: 32 })` and this function reads back
 * `hexToString(memo, { size: 32 })` minus the padding. TIP-20's own guidance is to
 * pack short identifiers directly and to hash only what does not fit: a hash of an
 * id could never be compared with the id the classifier asserts on
 * (`memo.includes(id)`), which is why `web/lib/pay/charge-memo.ts` refuses an id
 * longer than 32 bytes instead of hashing it.
 *
 * `bytes32` right-padding is stripped HERE rather than at the comparison, because the
 * classifier asserts `memo.includes(id)` on a TEXT memo. That is the frozen contract,
 * and teaching the classifier about padding would change what a stored signature
 * means.
 *
 * An unreadable memo yields `''`, which can never carry an id: the fail-closed
 * direction, since an unreadable memo is not evidence of a match.
 */
export function memoFromBytes32(memo: string | null | undefined): string {
  if (typeof memo !== 'string' || memo.length < 2) return '';
  try {
    return stripTrailingNul(hexToString(memo as Hex, { size: 32 }));
  } catch {
    return '';
  }
}

/** Drop the zero padding a `bytes32` memo carries after its text, without a regex. */
function stripTrailingNul(text: string): string {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 0) end -= 1;
  return text.slice(0, end);
}
