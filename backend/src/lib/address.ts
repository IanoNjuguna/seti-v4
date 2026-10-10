/**
 * EVM address validation.
 *
 * A pure module with no database or RPC dependency, so it can be exercised
 * directly by a check.
 *
 * **Why this is not a regex.** The version this replaced was
 * `/^0x[a-fA-F0-9]{40}$/` — a check on the *shape* of an address, not its
 * EIP-55 checksum. That accepted two kinds of string the client cannot use:
 *
 *   - a mixed-case address whose checksum is wrong (`0x20c0…c60E8b50`), which is
 *     what a typo looks like; and
 *   - an all-uppercase hex body, which is not a valid EIP-55 form.
 *
 * Both of those make `encodeFunctionData` throw when the mobile app builds a
 * transfer, so the failure surfaced later as an unexplained address error at
 * signing time. `prisma/seed.ts` shipped exactly the first case, and
 * `merchant_java_house` could not be paid at all.
 *
 * `viem.isAddress` is strict about EIP-55, and its acceptance set is *identical*
 * to what `encodeFunctionData` accepts — verified against all four casing
 * variants, not assumed. That equivalence is the whole point: a validator that
 * accepts a string the encoder refuses is worse than no validator, because it
 * moves the failure away from the input.
 *
 * All-lowercase addresses are accepted (there is no checksum to be wrong), which
 * is why a lowercase seed hides the problem until someone writes the
 * checksummed form.
 */
import { getAddress, isAddress } from 'viem';

/**
 * Returns `null` when the address is usable, or a human-readable reason when it
 * is not.
 *
 * Prefer this over {@link isValidEvmAddress} at any boundary where a person sees
 * the outcome: "Invalid EVM address" tells the caller nothing, while naming the
 * checksum gives them the fix.
 */
export function describeEvmAddress(address: string): string | null {
  if (isAddress(address)) return null;

  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    // Correct shape, so the only remaining problem is the checksum.
    let corrected: string | null = null;
    try {
      corrected = getAddress(address);
    } catch {
      corrected = null;
    }
    return (
      `"${address}" is a 20-byte address but fails its EIP-55 checksum, so a client cannot ` +
      'build a transfer to it.' +
      (corrected ? ` Use ${corrected} (or the all-lowercase form).` : '')
    );
  }

  return `"${address}" is not a 20-byte hex address.`;
}

/** True when the address is usable by an EIP-55-aware client. */
export function isValidEvmAddress(address: string): boolean {
  return describeEvmAddress(address) === null;
}
