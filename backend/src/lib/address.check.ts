/**
 * Address validation checks.
 *
 * Run with:  npm run check:address    (or: npx tsx src/lib/address.check.ts)
 *
 * The executable spec for `lib/address.ts`. Pure — no database, no RPC — so it
 * runs anywhere and costs nothing.
 *
 * The assertion that matters most is the last block: the validator's acceptance
 * set must equal what the client's encoder accepts. Two strings the old regex
 * allowed make `encodeFunctionData` throw, so that equivalence is the real
 * requirement — not "looks like an address". A validator that accepts a string
 * the client refuses moves the failure away from the input, which is exactly how
 * a seeded merchant became unpayable.
 */
import { encodeFunctionData, erc20Abi } from 'viem';
import { describeEvmAddress, isValidEvmAddress } from './address.js';

let total = 0;
let failures = 0;

function check(label: string, passed: boolean, detail = ''): void {
  total += 1;
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/** The address `prisma/seed.ts` shipped with a bad checksum, and its fixed form. */
const SEEDED_BAD = '0x20c000000000000000000000b9537d11c60E8b50';
const SEEDED_FIXED = '0x20C000000000000000000000b9537d11c60E8b50';

const accepted: Array<[string, string]> = [
  ['all-lowercase', '0x20c000000000000000000000b9537d11c60e8b50'],
  ['correctly checksummed', SEEDED_FIXED],
  ['the treasury EOA', '0x48cb25f9d82aF721e71437feAfb295da627BA475'],
];

const rejected: Array<[string, string]> = [
  ['mixed case with a bad checksum (the seeded bug)', SEEDED_BAD],
  ['all-uppercase hex body', '0x20C000000000000000000000B9537D11C60E8B50'],
  ['too short', '0x20c000000000000000000000b9537d11c60'],
  ['too long', '0x20c000000000000000000000b9537d11c60e8b500'],
  ['not hex', 'merchant_java_house'],
  ['empty', ''],
];

for (const [label, value] of accepted) {
  check(`accepts ${label}`, isValidEvmAddress(value), value);
}

for (const [label, value] of rejected) {
  check(`rejects ${label}`, !isValidEvmAddress(value), value || '(empty)');
}

// The refusal has to name the fix. "Invalid EVM address" is what let this sit
// unnoticed: the caller has no way to know the address is one character away.
const message = describeEvmAddress(SEEDED_BAD) ?? '';
check('the message names the checksum problem', /EIP-55/.test(message));
check('the message offers the corrected form', message.includes(SEEDED_FIXED));
check('a usable address produces no message', describeEvmAddress(SEEDED_FIXED) === null);

// The property that actually matters.
function clientCanEncode(address: string): boolean {
  try {
    encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [address as `0x${string}`, 1n],
    });
    return true;
  } catch {
    return false;
  }
}

for (const [label, value] of [...accepted, ...rejected]) {
  const validator = isValidEvmAddress(value);
  const client = clientCanEncode(value);
  check(
    `acceptance matches the client encoder: ${label}`,
    validator === client,
    `validator=${validator} client=${client}`
  );
}

console.log('-'.repeat(72));
if (failures > 0) {
  console.log(`${failures} CHECK(S) FAILED.`);
  process.exit(1);
}
console.log(`${total} assertions passed.`);
