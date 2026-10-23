/**
 * The one place a secret is sealed and opened — AES-256-GCM under a key from the
 * environment.
 *
 * ## Why this exists at all
 *
 * A webhook secret is an HMAC KEY, not a password. Verifying a delivery needs the
 * key itself, and so does signing one, which is what this server keeps doing every
 * time a charge settles. A one-way hash would therefore make every delivery
 * unsignable: there would be nothing left to key the MAC with. So the secret is
 * stored RECOVERABLE, and the whole security story is that the key which recovers it
 * does not live in the database. A dump of `merchant_apps` without
 * `SETI_SECRET_BOX_KEY` is a column of ciphertext.
 *
 * AES-256-GCM (authenticated) rather than a bare cipher: a tampered box must fail to
 * open, not decrypt into a different secret that then signs webhooks nobody can
 * verify.
 *
 * ## The format
 *
 *     v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 *
 * The leading `v1` is the KEY VERSION, not a scheme version: it names which of the
 * two configured keys a box was sealed with, so a rotation of the box key itself is
 * a rolling operation rather than a flag day. See `docs/operations.md`.
 *
 * ## The dev fallback, and why it cannot reach production
 *
 * With no `SETI_SECRET_BOX_KEY`, a development process derives one from
 * `JWT_SECRET` and warns once. That keeps `npm run check:merchant-app` and a local
 * server working on a machine whose `.env` was never touched. It is REFUSED in
 * production (`env.ts` refuses to boot without the real variable), so a box sealed
 * by a dev key cannot exist in a production database, and a production box cannot be
 * opened on a developer's laptop.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

/** The only format this module writes. */
const BOX_PREFIX = 'v1';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/** The prefix on a webhook secret, so the string is recognisable in a log or a repo. */
export const WEBHOOK_SECRET_PREFIX = 'whsec_';

/** Bytes of randomness in a webhook secret. */
const WEBHOOK_SECRET_BYTES = 32;

let warnedAboutDerivedKey = false;

/**
 * Decode a configured key. Accepts standard base64 and base64url, because an
 * operator pasting `openssl rand -base64 32` is the documented path and a URL-style
 * variant is what a copy through some shells produces.
 */
function decodeKey(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalised = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  for (const candidate of [normalised, normalised.padEnd(Math.ceil(normalised.length / 4) * 4, '=')]) {
    try {
      const buffer = Buffer.from(candidate, 'base64');
      if (buffer.length === KEY_BYTES) return buffer;
    } catch {
      // Fall through to the next candidate; a bad key is reported by the caller.
    }
  }
  return null;
}

/**
 * The key new boxes are sealed with, and the key old boxes are tried against first.
 *
 * `null` means "not configured and not derivable": in production that is a boot
 * refusal (so unreachable), and outside production it is the derived dev key below.
 */
export function currentSecretBoxKey(): Buffer | null {
  const configured = decodeKey(env.SETI_SECRET_BOX_KEY ?? '');
  if (configured) return configured;

  // A value that is present but unusable must not silently fall back to the dev key:
  // that is how a production database ends up sealed with a key nobody intended.
  const raw = (env.SETI_SECRET_BOX_KEY ?? '').trim();
  if (raw) {
    throw new Error(
      'SETI_SECRET_BOX_KEY is set but is not 32 bytes of base64. Generate one with ' +
        '`openssl rand -base64 32` and set the same value on every backend instance.'
    );
  }

  if (env.NODE_ENV === 'production') return null;

  if (!warnedAboutDerivedKey) {
    warnedAboutDerivedKey = true;
    console.warn(
      '[secret-box] SETI_SECRET_BOX_KEY is not set. Deriving a development key from ' +
        'JWT_SECRET: sealed merchant webhook secrets are readable by this deployment only ' +
        'and are NOT portable to a machine with a different JWT_SECRET. Set ' +
        'SETI_SECRET_BOX_KEY (openssl rand -base64 32) in production.'
    );
  }

  // Domain-separated so this is not the JWT key itself, and stable across restarts so
  // a locally created app keeps working after a `tsx watch` reload.
  return createHash('sha256').update(`seti-secret-box-dev:${env.JWT_SECRET}`).digest();
}

/** The previous key, during a rotation of the box key. Decrypt-only. */
function previousSecretBoxKey(): Buffer | null {
  return decodeKey(env.SETI_SECRET_BOX_KEY_PREVIOUS ?? '');
}

/**
 * Seal a secret for storage.
 *
 * Throws when no key is configured: a caller that is about to create a merchant app
 * must refuse rather than write a plaintext secret, and there is no path that stores
 * one.
 */
export function sealSecret(plaintext: string): string {
  const key = currentSecretBoxKey();
  if (!key) {
    throw new Error(
      'No secret-box key is configured, so a merchant webhook secret cannot be stored. ' +
        'Set SETI_SECRET_BOX_KEY (openssl rand -base64 32) on this deployment.'
    );
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    BOX_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/**
 * Open a sealed secret, or `null` when it cannot be opened.
 *
 * `null` is the fail-closed answer for every reason: a malformed box, a box sealed
 * with a key this deployment does not have, or a tampered one. The caller turns it
 * into a delivery that is not signed rather than a delivery signed with something
 * else.
 */
export function openSecret(box: string): string | null {
  const [prefix, ivPart, tagPart, cipherPart] = box.split('.');
  if (prefix !== BOX_PREFIX || !ivPart || !tagPart || !cipherPart) return null;

  const iv = Buffer.from(ivPart, 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');
  const ciphertext = Buffer.from(cipherPart, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) return null;

  for (const key of [currentSecretBoxKey(), previousSecretBoxKey()]) {
    if (!key) continue;
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      // Wrong key, or a tampered box. Try the previous key, then give up.
    }
  }

  return null;
}

/**
 * A fresh webhook secret: 32 bytes from the CSPRNG, prefixed so it reads as one.
 *
 * base64url over 32 bytes is 43 characters, and the prefix makes the string
 * identifiable in a paste or a log without revealing anything about it.
 */
export function generateWebhookSecret(): string {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(WEBHOOK_SECRET_BYTES).toString('base64url')}`;
}

/**
 * The last four characters of a secret, for telling two apart in a list.
 *
 * Cost of that convenience: 4 of 43 characters, which leaves 39 characters of
 * base64url entropy (roughly 234 bits) untouched. It is a label, not a fingerprint.
 */
export function secretHintOf(secret: string): string {
  return secret.slice(-4);
}
