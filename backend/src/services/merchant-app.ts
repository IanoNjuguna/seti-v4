/**
 * A merchant app: a name a wallet SIGNED for, and the webhook secret Seti issues for
 * it (#156).
 *
 * ## The credential model, and why it is this small
 *
 * A merchant signs in with the same Privy session a person uses. That session says
 * WHICH ACCOUNT this is; it cannot say which address the merchant's money lands at,
 * because an account can hold several wallets. So the binding is an EIP-712 signature
 * by the payout address itself, over the app's name, URL and website. Both facts are
 * required and neither substitutes for the other: the session owns the row, the wallet
 * signs for it, and {@link merchantAppBoundSigner} re-derives the signer from the
 * stored bytes on every read so a database write cannot invent a binding.
 *
 * What the app then gets is the ONLY credential a merchant needs, and the reason is
 * that Seti holds no funds: a `payout` address receives the money directly, so
 * nothing here can move a shilling. The secret's one job is proving that the webhooks
 * arriving at the merchant's endpoint are ours. No API key, no client credentials, no
 * OAuth application registry — with no custody there is nothing for them to authorise.
 *
 * ## Why the secret is encrypted, not hashed
 *
 * A password is hashed because the server only ever compares it. This secret is an
 * HMAC KEY: signing `<t>.<body>` needs the key itself, on every delivery, forever. A
 * hash would leave nothing to key the MAC with, so the signature could not be produced
 * and no receiver could verify anything. It is sealed with AES-256-GCM under
 * `SETI_SECRET_BOX_KEY` (`lib/secret-box.ts`), which is the closest honest thing to
 * "hashed" that still works: the plaintext is never written, never logged, never in a
 * list response and never in an audit body, and a database dump alone yields nothing.
 *
 * The plaintext leaves the server exactly twice per secret: the `201` that created it
 * and the `200` that rotated it. Nothing reads it back. A merchant who loses it
 * rotates, which is one tap, because a webhook secret cannot move money and the only
 * cost of rotation is one delivery failing visibly in the log.
 */
import { randomBytes } from 'node:crypto';
import { getAddress, recoverTypedDataAddress, type Hex } from 'viem';
import { prisma } from '../lib/prisma.js';
import {
  generateWebhookSecret,
  openSecret,
  sealSecret,
  secretHintOf,
} from '../lib/secret-box.js';
import { usableWebhookUrl } from '../lib/webhook-url.js';
import { getWalletsByUser } from './wallet-registry.js';
import { logAuditEvent } from './audit.js';
import { network as servedChain, servedNetwork } from './chain.js';
import { chainIdForNetwork, isNetwork, type Network } from '../lib/network.js';
import type { MerchantApp as MerchantAppRow } from '@prisma/client';

/** The EIP-712 domain. The SAME name/version charge and handle claims use. */
export const MERCHANT_APP_DOMAIN_NAME = 'Seti';
export const MERCHANT_APP_DOMAIN_VERSION = '1';

/**
 * The struct a wallet signs to CREATE an app.
 *
 * Every field that decides where money lands or where webhooks go is inside the
 * signature: `payoutAddress` (the address the app is bound to) and `webhookUrl` (the
 * endpoint the secret will sign for). `website` is signed too, so a label the merchant
 * sees on their own screen cannot be swapped under them — it is a name, not an
 * authority, but a signature over it costs nothing.
 */
export const MERCHANT_APP_BINDING_PRIMARY_TYPE = 'MerchantApp';
export const MERCHANT_APP_BINDING_TYPES = {
  [MERCHANT_APP_BINDING_PRIMARY_TYPE]: [
    { name: 'name', type: 'string' },
    { name: 'payoutAddress', type: 'address' },
    { name: 'webhookUrl', type: 'string' },
    { name: 'website', type: 'string' },
    { name: 'issuedAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

/**
 * The struct a wallet signs to MANAGE an app it already created.
 *
 * A separate message for the same reason `ChargeAdmin` is separate from `Charge`: the
 * create signature sits in the row, so reusing it for a rotation would let anyone who
 * can read the row rotate the secret out from under the merchant. `action` is inside
 * the signed bytes, so a rotation signature cannot be replayed to revoke.
 */
export const MERCHANT_APP_ADMIN_PRIMARY_TYPE = 'MerchantAppAdmin';
export const MERCHANT_APP_ADMIN_TYPES = {
  [MERCHANT_APP_ADMIN_PRIMARY_TYPE]: [
    { name: 'appId', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'issuedAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
} as const;

/** What a managing signature authorises. A closed set, so a new action is a code change. */
export const MERCHANT_APP_ADMIN_ACTIONS = ['rotate', 'revoke'] as const;

export type MerchantAppAdminAction = (typeof MERCHANT_APP_ADMIN_ACTIONS)[number];

/**
 * How long a binding or managing signature stays usable, in milliseconds.
 *
 * Five minutes, matching `ChargeAdmin`. Both directions are checked: a signature dated
 * in the future would otherwise extend its own life.
 */
export const MERCHANT_APP_SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

/** The shape of a public id: `app_` plus 16 hex characters. */
export const MERCHANT_APP_ID_PATTERN = /^app_[0-9a-f]{16}$/;

/** Longest app name accepted, after whitespace is normalised. */
export const MERCHANT_APP_NAME_MAX = 64;

/** The interface a client renders. NEVER carries the secret: see the file header. */
export interface MerchantAppView {
  publicId: string;
  name: string;
  website: string | null;
  webhookUrl: string;
  logoUrl: string | null;
  payoutAddress: string;
  network: string;
  /**
   * The last four characters of the live secret, so a merchant can tell two apps
   * apart. A label, not a fingerprint: 39 of 43 characters stay hidden.
   */
  secretHint: string;
  secretIssuedAt: string;
  secretRotations: number;
  /**
   * Whether the stored binding signature still recovers to `payoutAddress`.
   *
   * Computed on every read, never stored. `false` means the row's bytes and its
   * signature disagree, which is a database that was written to by something other
   * than this module. The app still exists and is still the merchant's; its secret is
   * simply not used to sign deliveries until the binding verifies again.
   */
  bindingVerifies: boolean;
  revokedAt: string | null;
  createdAt: string;
}

/** Normalise an app name: trim, and collapse runs of whitespace. */
export function normaliseAppName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** The EIP-712 domain, named like the charge domain rather than inline. */
export interface MerchantAppDomain {
  name: string;
  version: string;
  chainId: number;
}

/** The six fields a binding signature covers. */
export interface MerchantAppBindingMessage {
  name: string;
  /**
   * Typed as an address, not a string, because that is what EIP-712 signs: the field
   * is hashed as a uint160, so the checksum casing is irrelevant and only the 20 bytes
   * matter. It is stored lower-cased and compared lower-cased for that reason.
   */
  payoutAddress: `0x${string}`;
  webhookUrl: string;
  website: string;
  issuedAt: string;
  nonce: string;
}

/** The four fields a managing signature covers. */
export interface MerchantAppAdminMessage {
  appId: string;
  action: MerchantAppAdminAction;
  issuedAt: string;
  nonce: string;
}

function merchantAppDomain(chainId: number): MerchantAppDomain {
  return { name: MERCHANT_APP_DOMAIN_NAME, version: MERCHANT_APP_DOMAIN_VERSION, chainId };
}

/** The typed data a payout address signs to create an app. */
export function merchantAppBindingTypedData(
  message: MerchantAppBindingMessage,
  chainId: number
) {
  return {
    domain: merchantAppDomain(chainId),
    types: MERCHANT_APP_BINDING_TYPES,
    primaryType: MERCHANT_APP_BINDING_PRIMARY_TYPE,
    message,
  } as const;
}

/** The typed data a payout address signs to manage an existing app. */
export function merchantAppAdminTypedData(message: MerchantAppAdminMessage, chainId: number) {
  return {
    domain: merchantAppDomain(chainId),
    types: MERCHANT_APP_ADMIN_TYPES,
    primaryType: MERCHANT_APP_ADMIN_PRIMARY_TYPE,
    message,
  } as const;
}

/** Who signed a binding message, or null when it cannot be read. */
export async function recoverBindingSigner(input: {
  message: MerchantAppBindingMessage;
  signature: string;
  chainId: number;
}): Promise<string | null> {
  try {
    const recovered = await recoverTypedDataAddress({
      ...merchantAppBindingTypedData(input.message, input.chainId),
      signature: input.signature as Hex,
    });
    return getAddress(recovered).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Whether a stored row's binding still holds.
 *
 * Recovered from the stored signature and the stored message fields, both of which are
 * exactly what the wallet signed. A row whose `payoutAddress` was edited by hand no
 * longer recovers to it, and this returns false.
 */
export async function merchantAppBoundSigner(row: MerchantAppRow): Promise<string | null> {
  return recoverBindingSigner({
    message: {
      name: row.name,
      payoutAddress: row.payoutAddress as `0x${string}`,
      webhookUrl: row.webhookUrl,
      website: row.website ?? '',
      issuedAt: row.bindingIssuedAtRaw,
      nonce: row.bindingNonce,
    },
    signature: row.bindingSignature,
    chainId: chainIdOf(row.network),
  });
}

/** The chain id a stored network names. Falls back to the served chain. */
function chainIdOf(network: string): number {
  return isNetwork(network) ? chainIdForNetwork(network) : servedChain.chainId;
}

/**
 * The stored row as a client sees it, with the binding re-verified.
 *
 * Async because the verification is, and ONE function because a second renderer is how
 * a field gets exposed by accident. There is no field here for the secret.
 */
export async function toMerchantAppView(row: MerchantAppRow): Promise<MerchantAppView> {
  const signer = await merchantAppBoundSigner(row);

  return {
    publicId: row.publicId,
    name: row.name,
    website: row.website,
    webhookUrl: row.webhookUrl,
    logoUrl: row.logoUrl,
    payoutAddress: row.payoutAddress,
    network: row.network,
    secretHint: row.secretHint,
    secretIssuedAt: row.secretIssuedAt.toISOString(),
    secretRotations: row.secretRotations,
    bindingVerifies: signer !== null && signer === row.payoutAddress.toLowerCase(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A refusal the route renders as `{ error, code }`. */
export class MerchantAppError extends Error {
  constructor(
    public code:
      | 'merchant-app-signature-invalid'
      | 'merchant-app-stale'
      | 'merchant-app-mismatch'
      | 'merchant-app-address-not-owned'
      | 'merchant-app-name-taken'
      | 'merchant-app-webhook-invalid'
      | 'merchant-app-not-found'
      | 'merchant-app-revoked'
      | 'secret-box-unset',
    message: string,
    public status = 422
  ) {
    super(message);
    this.name = 'MerchantAppError';
  }
}

/**
 * Check that a base64 secret-box key is configured, BEFORE anything is written.
 *
 * An app whose secret cannot be sealed is an app whose webhooks can never be verified,
 * so this refuses on the way in rather than leaving a row that fails later. The seal
 * itself throws too; this exists so the refusal is a code and not a 500.
 */
export function assertSecretBoxReady(): void {
  try {
    // A seal with the real key, discarded. Cheap, and it proves the key decodes AND
    // the cipher works, rather than only that a variable is non-empty.
    sealSecret('seti-secret-box-probe');
  } catch {
    throw new MerchantAppError(
      'secret-box-unset',
      'This deployment has no SETI_SECRET_BOX_KEY, so a webhook secret cannot be stored. An operator must set it (openssl rand -base64 32) before merchant apps can be created.',
      503
    );
  }
}

/** Reject a signature issued outside the window, before any crypto is spent. */
function assertFresh(issuedAt: string, now: Date): void {
  const issued = Date.parse(issuedAt);
  if (Number.isNaN(issued)) {
    throw new MerchantAppError(
      'merchant-app-stale',
      `issuedAt "${issuedAt}" is not an ISO-8601 instant.`,
      422
    );
  }

  if (Math.abs(now.getTime() - issued) > MERCHANT_APP_SIGNATURE_WINDOW_MS) {
    throw new MerchantAppError(
      'merchant-app-stale',
      `This signature was issued at ${issuedAt}, more than ${MERCHANT_APP_SIGNATURE_WINDOW_MS / 60_000} minutes from now. Sign again.`,
      422
    );
  }
}

/** An optional label URL: http or https, nothing else, or null. */
function optionalLabelUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export interface CreateMerchantAppInput {
  ownerUserId: string;
  body: {
    name: string;
    payoutAddress: string;
    webhookUrl: string;
    website?: string | null;
    logoUrl?: string | null;
    issuedAt: string;
    nonce: string;
    signature: string;
  };
  now?: Date;
}

export interface CreateMerchantAppResult {
  app: MerchantAppView;
  /**
   * The secret, in the clear. Returned EXACTLY HERE and by {@link rotateSecret} and
   * nowhere else in the codebase. The caller puts it in the create response and
   * forgets it.
   */
  secret: string;
}

/**
 * Create an app and ISSUE its webhook secret.
 *
 * Order is the safety story: signature last of the checks (so a tampered name or URL
 * is refused as a signature that does not hold, not stored with a caveat), secret
 * sealed before the insert (so there is no window where a row exists without one), and
 * the audit row written WITHOUT the secret.
 */
export async function createMerchantApp(
  input: CreateMerchantAppInput
): Promise<CreateMerchantAppResult> {
  const now = input.now ?? new Date();

  assertSecretBoxReady();
  assertFresh(input.body.issuedAt, now);

  const name = normaliseAppName(input.body.name);
  if (name.length === 0 || name.length > MERCHANT_APP_NAME_MAX) {
    throw new MerchantAppError(
      'merchant-app-mismatch',
      `An app name is 1 to ${MERCHANT_APP_NAME_MAX} characters.`,
      422
    );
  }

  const webhook = usableWebhookUrl(input.body.webhookUrl);
  if (webhook.kind !== 'url') {
    throw new MerchantAppError(
      'merchant-app-webhook-invalid',
      'webhookUrl must be an https URL (http is accepted only for localhost outside production), because the deliveries it receives carry a payment amount.',
      422
    );
  }

  const website = optionalLabelUrl(input.body.website);
  if (input.body.website && website === null) {
    throw new MerchantAppError(
      'merchant-app-mismatch',
      `website "${input.body.website}" is not an http or https URL.`,
      422
    );
  }

  // The address is a signed FIELD, so its shape is checked before any crypto: an
  // address that is not 20 bytes cannot be what a wallet signed.
  const declared = input.body.payoutAddress.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(declared)) {
    throw new MerchantAppError(
      'merchant-app-address-not-owned',
      `"${input.body.payoutAddress}" is not a 20-byte hex address.`,
      422
    );
  }

  // The signature covers the NORMALISED strings, because those are what get stored and
  // re-verified. Signing "Java  House" while storing "Java House" would recover to a
  // different address and refuse a name that is plainly fine.
  const signer = await recoverBindingSigner({
    message: {
      name,
      payoutAddress: declared as `0x${string}`,
      webhookUrl: webhook.url,
      website: website ?? '',
      issuedAt: input.body.issuedAt,
      nonce: input.body.nonce,
    },
    signature: input.body.signature,
    chainId: servedChain.chainId,
  });

  if (!signer) {
    throw new MerchantAppError(
      'merchant-app-signature-invalid',
      'This signature cannot be read against the app you submitted. Sign the exact name, payout address and webhook URL shown on the form.',
      422
    );
  }

  // A body that declares one address and a signature that recovers to another is a
  // client that built the message wrong, and it must be told so rather than silently
  // bound to the address the WALLET named: the merchant would see one address on their
  // screen and charges would land at the other.
  if (signer !== declared) {
    throw new MerchantAppError(
      'merchant-app-mismatch',
      `The signature recovers to ${signer}, not the payoutAddress you sent (${input.body.payoutAddress}).`,
      422
    );
  }

  const payoutAddress = signer;

  // Ownership: the payout address must be one of the CALLER's own wallets on the
  // network being served. Letting any signature in would let one account bind an app
  // to somebody else's address and point a webhook at their own endpoint.
  const wallets = await getWalletsByUser(input.ownerUserId, servedNetwork);
  const ownsAddress = wallets.some((wallet) => wallet.address.toLowerCase() === payoutAddress);
  if (!ownsAddress) {
    throw new MerchantAppError(
      'merchant-app-address-not-owned',
      `${payoutAddress} is not one of the wallets on your account. Sign with the wallet that receives your payments.`,
      403
    );
  }

  const secret = generateWebhookSecret();
  const secretBox = sealSecret(secret);

  try {
    const row = await prisma.merchantApp.create({
      data: {
        publicId: newPublicId(),
        ownerUserId: input.ownerUserId,
        name,
        website,
        webhookUrl: webhook.url,
        logoUrl: optionalLabelUrl(input.body.logoUrl),
        payoutAddress,
        bindingSignature: input.body.signature,
        bindingIssuedAtRaw: input.body.issuedAt,
        bindingNonce: input.body.nonce,
        network: servedNetwork,
        secretBox,
        secretHint: secretHintOf(secret),
        secretIssuedAt: now,
      },
    });

    // The audit row names the app and the address, never the secret: an audit body is
    // read by more people than the app screen is.
    await logAuditEvent({
      userId: input.ownerUserId,
      action: 'merchant_app.created',
      metadata: {
        publicId: row.publicId,
        payoutAddress,
        network: row.network,
      },
    });

    return { app: await toMerchantAppView(row), secret };
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw new MerchantAppError(
        'merchant-app-name-taken',
        `You already have an app called "${name}". Choose a different name.`,
        409
      );
    }
    throw error;
  }
}

/** Every app this account owns on the network being served, newest first. */
export async function listMerchantApps(ownerUserId: string): Promise<MerchantAppView[]> {
  const rows = await prisma.merchantApp.findMany({
    where: { ownerUserId, network: servedNetwork },
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(rows.map(toMerchantAppView));
}

/**
 * The caller's own app, by public id, or a refusal.
 *
 * One uniform refusal for "no such app" and "not yours": whether an id exists is not
 * this caller's business, and a distinct 403 would answer that question for anyone who
 * asks.
 */
export async function findOwnedMerchantApp(input: {
  ownerUserId: string;
  publicId: string;
}): Promise<MerchantAppRow> {
  const row = await prisma.merchantApp.findUnique({ where: { publicId: input.publicId } });

  if (!row || row.ownerUserId !== input.ownerUserId) {
    throw new MerchantAppError('merchant-app-not-found', 'No app with that id on your account.', 404);
  }

  return row;
}

/**
 * The live secret for an app, opened from its box.
 *
 * `null` when it cannot be opened (no key, wrong key, tampered box) or the app has been
 * revoked. Null is the fail-closed answer: a delivery is then not attempted, because an
 * unsigned webhook is a webhook a receiver must reject.
 */
export function merchantAppSecret(row: MerchantAppRow): string | null {
  if (row.revokedAt) return null;
  return openSecret(row.secretBox);
}

/**
 * Rotate an app's webhook secret, signed by the address the app is bound to.
 *
 * The OLD secret is dead the instant this commits: one column write replaces the box,
 * so there is never a moment with two live secrets. That is deliberate and it is the
 * trade this feature makes — a window with both live would mean a leaked secret keeps
 * working after the merchant did what they were told to do about it. The cost is that
 * in-flight retries of an old delivery fail, visibly, in the delivery log.
 */
export async function rotateMerchantAppSecret(input: {
  ownerUserId: string;
  publicId: string;
  action: 'rotate';
  issuedAt: string;
  nonce: string;
  signature: string;
  now?: Date;
}): Promise<{ app: MerchantAppView; secret: string }> {
  const now = input.now ?? new Date();

  assertSecretBoxReady();

  const row = await findOwnedMerchantApp({ ownerUserId: input.ownerUserId, publicId: input.publicId });
  if (row.revokedAt) {
    throw new MerchantAppError(
      'merchant-app-revoked',
      'This app was revoked. Its secret is gone and cannot be rotated; create a new app.',
      409
    );
  }

  assertFresh(input.issuedAt, now);

  const signer = await merchantAppBoundSigner(row);
  if (!signer) {
    throw new MerchantAppError(
      'merchant-app-signature-invalid',
      'This app’s stored binding signature no longer verifies, so it cannot be managed. Create a new app, and contact support with the app id.',
      409
    );
  }

  const signed = await recoverAdminSigner({
    message: {
      appId: row.publicId,
      action: input.action,
      issuedAt: input.issuedAt,
      nonce: input.nonce,
    },
    signature: input.signature,
    chainId: chainIdOf(row.network),
  });

  if (!signed || signed !== row.payoutAddress.toLowerCase()) {
    throw new MerchantAppError(
      'merchant-app-signature-invalid',
      `This signature does not come from ${row.payoutAddress}, the address this app is bound to.`,
      403
    );
  }

  const secret = generateWebhookSecret();
  const updated = await prisma.merchantApp.update({
    where: { id: row.id },
    data: {
      secretBox: sealSecret(secret),
      secretHint: secretHintOf(secret),
      secretIssuedAt: now,
      secretRotations: { increment: 1 },
    },
  });

  await logAuditEvent({
    userId: input.ownerUserId,
    action: 'merchant_app.secret_rotated',
    metadata: {
      publicId: row.publicId,
      rotation: updated.secretRotations,
      payoutAddress: row.payoutAddress,
    },
  });

  return { app: await toMerchantAppView(updated), secret };
}

/** Revoke an app: signed, and the rollback the issue names. */
export async function revokeMerchantApp(input: {
  ownerUserId: string;
  publicId: string;
  issuedAt: string;
  nonce: string;
  signature: string;
  now?: Date;
}): Promise<MerchantAppView> {
  const now = input.now ?? new Date();

  const row = await findOwnedMerchantApp({ ownerUserId: input.ownerUserId, publicId: input.publicId });
  if (row.revokedAt) return toMerchantAppView(row);

  assertFresh(input.issuedAt, now);

  const signed = await recoverAdminSigner({
    message: {
      appId: row.publicId,
      action: 'revoke',
      issuedAt: input.issuedAt,
      nonce: input.nonce,
    },
    signature: input.signature,
    chainId: chainIdOf(row.network),
  });

  if (!signed || signed !== row.payoutAddress.toLowerCase()) {
    throw new MerchantAppError(
      'merchant-app-signature-invalid',
      `This signature does not come from ${row.payoutAddress}, the address this app is bound to.`,
      403
    );
  }

  const updated = await prisma.merchantApp.update({
    where: { id: row.id },
    data: { revokedAt: now },
  });

  await logAuditEvent({
    userId: input.ownerUserId,
    action: 'merchant_app.revoked',
    metadata: { publicId: row.publicId, payoutAddress: row.payoutAddress },
  });

  return toMerchantAppView(updated);
}

/** Who signed an admin message, or null when it cannot be read. */
export async function recoverAdminSigner(input: {
  message: MerchantAppAdminMessage;
  signature: string;
  chainId: number;
}): Promise<string | null> {
  try {
    const recovered = await recoverTypedDataAddress({
      ...merchantAppAdminTypedData(input.message, input.chainId),
      signature: input.signature as Hex,
    });
    return getAddress(recovered).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The app that owns a charge's recipient, when one does.
 *
 * THE SEAM the delivery path uses: a charge whose `recipient` is an app's payout
 * address is signed with THAT app's secret; anything else falls back to the
 * deployment-wide `SETI_WEBHOOK_SECRET`. The app is used only when its binding still
 * verifies and its secret still opens — a row whose signature no longer holds is not
 * an authority over the address it claims.
 */
export async function merchantAppForRecipient(input: {
  recipient: string;
  network?: Network;
}): Promise<MerchantAppRow | null> {
  const address = input.recipient.toLowerCase();

  const candidates = await prisma.merchantApp.findMany({
    where: {
      payoutAddress: address,
      network: input.network ?? servedNetwork,
      revokedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const candidate of candidates) {
    const signer = await merchantAppBoundSigner(candidate);
    if (signer === address && merchantAppSecret(candidate) !== null) return candidate;
  }

  return null;
}

/**
 * A fresh public id: `app_` and 16 hex characters from the CSPRNG.
 *
 * Random rather than sequential, because the id appears in support tickets and logs and
 * a running counter would publish how many merchants there are.
 */
export function newPublicId(): string {
  return `app_${randomBytes(8).toString('hex')}`;
}
