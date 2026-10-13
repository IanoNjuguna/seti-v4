import { getAddress, isAddress, type Address } from 'viem';

/**
 * Refuse a send before anything is built or signed.
 *
 * Pure, so the rules that decide where money goes are readable in one place and
 * testable without a wallet. Two of them are the checks that actually matter:
 *
 * - **Shape.** `0x` plus 40 hex characters. A pasted block-explorer line, a
 *   truncated address, or a 32-byte transaction hash all fail here with a message
 *   that names what was expected.
 * - **EIP-55.** A mixed-case address whose checksum does not match has a typo in
 *   it, or is a different address entirely. `isAddress` rejects it and the error
 *   says so — sending to a mistyped address is unrecoverable.
 *
 * A rejected `ok` is a discriminated union so callers can narrow to a non-null
 * canonical address and never hand `null` to the transfer builder.
 */
export type RecipientValidation =
  | { ok: true; address: Address; error: null }
  | { ok: false; address: null; error: string };

export type AmountValidation = { ok: true; error: null } | { ok: false; error: string };

/** `0x` + exactly 40 hex characters, before any checksum question. */
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/** Digits with at most one decimal point — no signs, no exponents, no grouping. */
const DECIMAL = /^\d+(\.\d+)?$/;

/** Keeps the two messages below from drifting apart. */
const OWN_ADDRESS =
  'That is this account’s own address. Nothing would move, and the network fee would still be spent.';

export function validateRecipient(
  value: string,
  /** The signed-in wallet, so a self-send can be refused. */
  selfAddress?: Address | null
): RecipientValidation {
  const trimmed = value.trim();

  if (!trimmed) return { ok: false, address: null, error: 'Enter the address you are sending to.' };

  if (!HEX_ADDRESS.test(trimmed)) {
    return {
      ok: false,
      address: null,
      error: 'Not an address: expected 0x followed by 40 hex characters (42 in total).',
    };
  }

  if (!isAddress(trimmed)) {
    return {
      ok: false,
      address: null,
      error:
        'That address fails its checksum, so a character is wrong. Copy it again from the person who owns it.',
    };
  }

  const address = getAddress(trimmed);

  if (selfAddress && address === getAddress(selfAddress)) {
    return { ok: false, address: null, error: OWN_ADDRESS };
  }

  return { ok: true, address, error: null };
}

export function validateAmount(value: string, decimals: number): AmountValidation {
  const trimmed = value.trim();

  if (!trimmed) return { ok: false, error: 'Enter an amount.' };

  if (!DECIMAL.test(trimmed)) {
    return { ok: false, error: 'Enter an amount in digits, like 25.50.' };
  }

  const fraction = trimmed.split('.')[1]?.length ?? 0;
  if (fraction > decimals) {
    return { ok: false, error: `Use at most ${decimals} decimal places.` };
  }

  if (Number(trimmed) <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }

  return { ok: true, error: null };
}
