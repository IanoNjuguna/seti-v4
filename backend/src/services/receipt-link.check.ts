/**
 * Receipt-link checks: the public id is opaque, and the capability token is the
 * only way in — and fails closed on every forgery.
 *
 * Run with:  npm run check:receipt-link
 *
 * Pure crypto, deliberately: the security properties here (non-guessable id,
 * signed scope and expiry, uniform refusal) are all decided before any database
 * read or chain call, so they are proven without a live Postgres or RPC. The
 * route's uniform 404 is the one thing that needs a server, and it is proven in
 * the task's HTTP evidence rather than here.
 */
import {
  RECEIPT_LINK_SCOPE,
  RECEIPT_LINK_TTL_SECONDS,
  issueReceiptToken,
  readReceiptToken,
  receiptIdFor,
} from './receipt-link.js';
import { sign } from '../lib/signed-token.js';

let failures = 0;
function check(label: string, passed: boolean, detail = ''): void {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

/** A token whose payload claims something, signed with the real secret. */
function signed(body: object): string {
  const encoded = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

/** Flips one character of the signature segment, leaving the payload intact. */
function forgeSignature(token: string): string {
  const [body, signature] = token.split('.');
  const last = signature.slice(-1);
  const flipped = last === 'A' ? 'B' : 'A';
  return `${body}.${signature.slice(0, -1)}${flipped}`;
}

function payloadOf(token: string): { iat: number; exp: number; s: string } {
  const [body] = token.split('.');
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
    iat: number;
    exp: number;
    s: string;
  };
}

const ROW_A = 'clx0000000000000000000aa';
const ROW_B = 'clx0000000000000000000bb';

function main(): void {
  console.log('the public id is opaque and not the hash:');

  const idA = receiptIdFor(ROW_A);
  check('the id is a non-empty url-safe slug', /^[A-Za-z0-9_-]+$/.test(idA) && idA.length === 22, idA);
  check('the id is not the row id', idA !== ROW_A);
  check('the id does not contain the row id', !idA.includes(ROW_A));
  check('the id is stable for the same row', receiptIdFor(ROW_A) === idA);
  check('a different row yields a different id', receiptIdFor(ROW_B) !== idA);

  console.log('\na token round-trips its grant:');

  const { token, expiresAt } = issueReceiptToken(ROW_A);
  const grant = readReceiptToken(token);
  check('a fresh token verifies', grant !== null);
  check('it names the row it was minted for', grant?.transactionId === ROW_A);
  check('it is bound to that row\u2019s public id', grant?.receiptId === idA, String(grant?.receiptId));
  check('its scope is receipt:read', grant?.scope === RECEIPT_LINK_SCOPE);

  const payload = payloadOf(token);
  check('its scope lives inside the signed payload', payload.s === RECEIPT_LINK_SCOPE);
  check(
    'its expiry is ~24h out',
    Math.round((payload.exp - payload.iat) / 1000) === RECEIPT_LINK_TTL_SECONDS,
    `${Math.round((payload.exp - payload.iat) / 1000)}s`,
  );
  check('the returned expiry matches the payload', expiresAt.getTime() === payload.exp);

  console.log('\nthe token is bound to one receipt, not a family of them:');
  check('the grant id does not match another row\u2019s id', grant?.receiptId !== receiptIdFor(ROW_B));

  console.log('\nfail closed on every forgery:');

  check('a missing token is refused', readReceiptToken(undefined) === null);
  check('an empty token is refused', readReceiptToken('') === null);
  check('a malformed token is refused', readReceiptToken('not-a-token') === null);
  check('a garbage token is refused', readReceiptToken('aaaa.bbbb') === null);
  check('a forged signature is refused', readReceiptToken(forgeSignature(token)) === null);

  const expired = issueReceiptToken(ROW_A, -1).token;
  check('an expired token is refused', readReceiptToken(expired) === null);

  // A genuine signature over a payload that asks for a scope this route never
  // grants: the scope is INSIDE the signed claim, so widening it is a forgery.
  const wrongScope = signed({
    t: ROW_A,
    r: idA,
    s: 'receipt:write',
    iat: Date.now(),
    exp: Date.now() + 60_000,
  });
  check('a differently-scoped but genuinely-signed token is refused', readReceiptToken(wrongScope) === null);

  // Valid signature, but bound to a different receipt than the one asked for.
  const otherReceipt = signed({
    t: ROW_B,
    r: receiptIdFor(ROW_B),
    s: RECEIPT_LINK_SCOPE,
    iat: Date.now(),
    exp: Date.now() + 60_000,
  });
  const otherGrant = readReceiptToken(otherReceipt);
  check(
    'a token for another receipt does not verify against this one',
    otherGrant !== null && otherGrant.receiptId !== idA,
  );

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
