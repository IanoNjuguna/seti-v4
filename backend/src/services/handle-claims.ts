/**
 * Handle claims — the cryptographic half of "anyone can be paid by name".
 *
 * ## The product decision this implements
 *
 * A handle is just a name that a wallet has signed for. There is no code
 * minting, no platform-owned name-to-address table, and no distinction between a
 * person and a business in the money path: a send to a username and a payment to
 * a merchant are the same two-leg batch with a different payee. What this module
 * proves is the one thing the platform cannot be trusted to assert on its own —
 * that whoever claims a handle CONTROLS the address it is claimed for.
 *
 * A PERSON'S USERNAME and a BUSINESS'S NAME are the same kind of signed handle,
 * competing for the same string in ONE namespace (`handles.handle`, unique).
 * "Person or business" is a PROFILE MODE — `kind` — on that one handle, not a
 * different identity: one lookup box, one claim, one resolver. The claim lives
 * on the HANDLE, not on the Merchant row, because a handle belongs to an address
 * and a merchant profile is a mode on top of it.
 *
 * The dangerous design it replaces is a platform-owned code-to-address mapping:
 * whoever can edit a row silently redirects every payment to that code, and the
 * customer never sees an address to notice. Here nobody can attach a handle to
 * an address without that address's key. A compromised database can at worst
 * HIDE a handle — clear the signature and it reads as unverified; it cannot
 * invent a binding, because a binding is a signature and forging one is not a
 * database write.
 *
 * Identity verification (is this business really Java House?) is deliberately
 * OUT OF SCOPE. The owner verifies that in person or by KYB. This module only
 * ever answers: does this signature, over this name and this address and this
 * purpose, come from the key that controls the address?
 *
 * ## Why EIP-712, and why the message carries a `purpose`
 *
 * A `personal_sign` of a string is opaque in a wallet: the person approves hex
 * they cannot read. EIP-712 gives the wallet typed fields to display (the name,
 * the address, the purpose, when it was issued) and domain-separates the
 * signature, so it cannot be replayed against another app or another chain.
 *
 * The `purpose` field is what stops a signature made to claim a USERNAME from
 * being replayed to claim a MERCHANT name, or the reverse: the message a
 * signature covers names the purpose it was made for, so the same bytes verify
 * for exactly one of them. `purpose-mismatch` is the refusal that names a
 * detected replay rather than a generic bad signature.
 */
import { getAddress, recoverTypedDataAddress, verifyTypedData } from 'viem';
import { prisma } from '../lib/prisma.js';
import { describeEvmAddress } from '../lib/address.js';
import {
  describeHandleName,
  describeHandleOf,
  describeReservedHandle,
  merchantHandle,
  normalizeMerchantName,
} from '../lib/merchant-name.js';
import { network } from '../config/networks.js';
import { getWalletsByUser } from './wallet-registry.js';

/**
 * The name/handle rule lives in `lib/merchant-name.ts` (pure, no chain
 * dependency) and is re-exported here so a caller of a claim has one import for
 * the whole feature. It is ONE rule for ONE namespace: a username and a business
 * name reduce by the same functions.
 */
export {
  MERCHANT_NAME_MIN,
  MERCHANT_NAME_MAX,
  RESERVED_HANDLES,
  describeHandleName,
  describeHandleOf,
  describeMerchantHandle,
  describeMerchantName,
  describeReservedHandle,
  isReservedHandle,
  merchantHandle,
  merchantNameKey,
  normalizeMerchantName,
} from '../lib/merchant-name.js';

// ---------------------------------------------------------------------------
// The signed shape. Shared by the backend, the browser and the checks, so all
// three cannot disagree about what was signed.
// ---------------------------------------------------------------------------

export const HANDLE_CLAIM_DOMAIN_NAME = 'Seti';
export const HANDLE_CLAIM_DOMAIN_VERSION = '1';
/** The current message type — it names the `purpose` it was signed for. */
export const HANDLE_CLAIM_PRIMARY_TYPE = 'HandleClaim';
/**
 * The message type used by claims made BEFORE `purpose` existed. Kept so the
 * handles backfilled from those merchant claims still re-verify: their
 * signatures cover four fields, and there is no key to re-sign them with.
 */
export const LEGACY_CLAIM_PRIMARY_TYPE = 'MerchantNameClaim';

/** Whether a handle belongs to a person or a business — a mode, not an identity. */
export type HandleKind = 'person' | 'business';

/** What a signature is FOR. Binds a signature to one kind of claim, not two. */
export type ClaimPurpose = 'username' | 'merchant-name';

export const HANDLE_KINDS: readonly HandleKind[] = ['person', 'business'];

/**
 * The purpose a kind signs under.
 *
 * One map, read by the signing side and the verifying side, so a signature can
 * never be produced for one purpose and checked against another. This is what
 * makes the two kinds non-interchangeable at the byte level.
 */
export const PURPOSE_FOR_KIND: Record<HandleKind, ClaimPurpose> = {
  person: 'username',
  business: 'merchant-name',
};

export function isHandleKind(value: unknown): value is HandleKind {
  return value === 'person' || value === 'business';
}

/** The domain the wallet is asked to sign against. `chainId` is the Tempo one. */
export interface HandleClaimDomain {
  name: string;
  version: string;
  chainId: number;
}

/** The fields a person sees and approves in their wallet. */
export interface HandleClaimMessage {
  /** The claimed username or business name. */
  name: string;
  /** The address the handle is claimed FOR — must be the signer's own. */
  address: string;
  /** `username` or `merchant-name` — the kind of claim these bytes authorise. */
  purpose: string;
  /** ISO 8601, chosen by the signer and stored verbatim. */
  issuedAt: string;
  /** One-time value, so two claims are never the same signature. */
  nonce: string;
}

export const HANDLE_CLAIM_TYPES: Record<string, readonly { name: string; type: string }[]> = {
  HandleClaim: [
    { name: 'name', type: 'string' },
    { name: 'address', type: 'address' },
    { name: 'purpose', type: 'string' },
    { name: 'issuedAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
};

/** The pre-`purpose` shape, for the backfilled handles only. */
export const LEGACY_CLAIM_TYPES: Record<string, readonly { name: string; type: string }[]> = {
  MerchantNameClaim: [
    { name: 'name', type: 'string' },
    { name: 'address', type: 'address' },
    { name: 'issuedAt', type: 'string' },
    { name: 'nonce', type: 'string' },
  ],
};

/**
 * The EIP-712 domain.
 *
 * Read from the live network config rather than hardcoded, so a testnet claim
 * and a mainnet claim are different signatures and neither can be replayed on
 * the other chain.
 */
export function handleClaimDomain(): HandleClaimDomain {
  return {
    name: HANDLE_CLAIM_DOMAIN_NAME,
    version: HANDLE_CLAIM_DOMAIN_VERSION,
    chainId: network.chainId,
  };
}

// ---------------------------------------------------------------------------
// Verification — the whole point. Nothing here trusts a stored boolean.
// ---------------------------------------------------------------------------

/** The four fields a legacy (pre-purpose) claim signed, plus the signature. */
function legacyMessage(m: { name: string; address: string; issuedAt: string; nonce: string }) {
  return { name: m.name, address: m.address, issuedAt: m.issuedAt, nonce: m.nonce };
}

/** The five fields a current claim signed, plus the signature. */
function purposeMessage(m: {
  name: string;
  address: string;
  purpose: string | null;
  issuedAt: string;
  nonce: string;
}) {
  return {
    name: m.name,
    address: m.address,
    purpose: m.purpose ?? '',
    issuedAt: m.issuedAt,
    nonce: m.nonce,
  };
}

/**
 * Who signed this claim, or `null` when the signature is unreadable.
 *
 * The MESSAGE SHAPE is selected by the stored `purpose`: a claim with a purpose
 * is verified against the five-field `HandleClaim`, and a backfilled one with no
 * purpose against the four-field legacy type. `null` rather than a thrown viem
 * error: a malformed signature is simply not a match, and the refusal belongs to
 * this module's vocabulary, not viem's.
 */
export async function recoverHandleClaimAddress(input: {
  name: string;
  address: string;
  purpose: string | null;
  issuedAt: string;
  nonce: string;
  signature: string;
}): Promise<`0x${string}` | null> {
  try {
    if (input.purpose) {
      return await recoverTypedDataAddress({
        domain: handleClaimDomain(),
        types: HANDLE_CLAIM_TYPES,
        primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
        message: purposeMessage(input),
        signature: input.signature as `0x${string}`,
      });
    }

    return await recoverTypedDataAddress({
      domain: handleClaimDomain(),
      types: LEGACY_CLAIM_TYPES,
      primaryType: LEGACY_CLAIM_PRIMARY_TYPE,
      message: legacyMessage(input),
      signature: input.signature as `0x${string}`,
    });
  } catch {
    return null;
  }
}

/** The stored fields a re-verification needs, and nothing else. */
export interface StoredHandleClaim {
  name: string;
  address: string;
  purpose: string | null;
  claimSignature: string | null;
  claimIssuedAt: string | null;
  claimNonce: string | null;
}

/**
 * Is the stored binding still genuine?
 *
 * Recomputed from the stored signature and the row's CURRENT name, purpose and
 * address — never read from a stored flag. That is what makes tampering visible:
 * change the name, the purpose or the address in the database and the signature
 * no longer recovers to the address, so the row reads as unverified instead of
 * as a verified handle pointing somewhere new.
 */
export async function handleClaimVerifies(handle: StoredHandleClaim): Promise<boolean> {
  const { name, address, purpose, claimSignature, claimIssuedAt, claimNonce } = handle;

  if (!address || !claimSignature || !claimIssuedAt || !claimNonce) return false;

  const recovered = await recoverHandleClaimAddress({
    name,
    address,
    purpose,
    issuedAt: claimIssuedAt,
    nonce: claimNonce,
    signature: claimSignature,
  });

  return recovered !== null && recovered.toLowerCase() === address.toLowerCase();
}

/** What a client may be told about a handle, with the verification recomputed. */
export interface HandleIdentityView {
  /** The handle row id. */
  id: string;
  /** The stored, unique handle behind `seti.live/m/<handle>` or `/u/<handle>`. */
  handle: string;
  /** Person or business — a profile mode on one handle, not an identity. */
  kind: HandleKind;
  /** The username or the business name. */
  name: string;
  /** The authoritative thing. A name is never used without it. */
  address: string | null;
  /** A business's category, or null for a person or an uncategorised business. */
  category: string | null;
  /**
   * True only when a signature over THIS name, THIS purpose and THIS address
   * verifies. There is no path that sets this to true by assertion.
   */
  verified: boolean;
  /** The purpose the binding was signed for; null for a pre-purpose backfill. */
  purpose: string | null;
  /**
   * The business profile this handle turns on, when `kind = 'business'` — the id
   * the money path pays. Null for a person, who has no profile.
   */
  merchantId: string | null;
  claimedAt: string | null;
}

export async function toHandleIdentityView(handle: {
  id: string;
  handle: string;
  kind: string;
  name: string;
  address: string;
  purpose: string | null;
  claimSignature: string | null;
  claimIssuedAt: string | null;
  claimNonce: string | null;
  claimedAt: Date | null;
  merchantId: string | null;
  merchant?: { id: string; category: string | null } | null;
}): Promise<HandleIdentityView> {
  return {
    id: handle.id,
    handle: handle.handle,
    kind: handle.kind === 'person' ? 'person' : 'business',
    name: handle.name,
    address: handle.address || null,
    category: handle.merchant?.category ?? null,
    verified: await handleClaimVerifies(handle),
    purpose: handle.purpose,
    merchantId: handle.merchantId,
    claimedAt: handle.claimedAt ? handle.claimedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// The claim itself — a one-time act, no gas, nothing written on chain.
// ---------------------------------------------------------------------------

export type HandleClaimErrorCode =
  | 'invalid-handle-name'
  | 'reserved-handle'
  | 'invalid-address'
  | 'invalid-issued-at'
  | 'invalid-signature'
  | 'signature-mismatch'
  | 'purpose-mismatch'
  | 'address-not-owned'
  | 'handle-taken';

/** A refusal with a machine-readable code, in the envelope the app already reads. */
export class HandleClaimError extends Error {
  constructor(
    readonly code: HandleClaimErrorCode,
    readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HandleClaimError';
  }
}

export interface ClaimHandleInput {
  /** The authenticated caller. */
  userId: string;
  /** Person or business — selects the purpose the signature must carry. */
  kind: HandleKind;
  /** The username or business name. */
  name: string;
  address: string;
  issuedAt: string;
  nonce: string;
  signature: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** The other purpose, for detecting a cross-purpose replay precisely. */
function otherPurpose(purpose: ClaimPurpose): ClaimPurpose {
  return purpose === 'username' ? 'merchant-name' : 'username';
}

/**
 * Claim a handle for an address, or refuse with a reason.
 *
 * The order is deliberate: cheap local validation first, then the signature,
 * then ownership, then the collision. A bad name or a bad signature never costs
 * a query, and — more importantly — a caller who does not control the address is
 * refused BEFORE anything is looked up about who else holds the handle, so a
 * failed claim cannot be used to probe which handles exist.
 */
export async function claimHandle(input: ClaimHandleInput) {
  const problem =
    describeHandleName(input.name) ??
    describeHandleOf(input.name) ??
    // Reserved AFTER the shape rules: a name that makes no handle at all is
    // refused by the shape rule, which is the field the person has to fix.
    describeReservedHandle(input.name);
  if (problem) {
    throw new HandleClaimError(
      describeReservedHandle(input.name) ? 'reserved-handle' : 'invalid-handle-name',
      400,
      problem
    );
  }

  const name = normalizeMerchantName(input.name);
  const handle = merchantHandle(input.name);
  const purpose = PURPOSE_FOR_KIND[input.kind];

  const addressProblem = describeEvmAddress(input.address);
  if (addressProblem) throw new HandleClaimError('invalid-address', 400, addressProblem);
  const claimedAddress = getAddress(input.address);

  if (Number.isNaN(Date.parse(input.issuedAt))) {
    throw new HandleClaimError(
      'invalid-issued-at',
      400,
      `"${input.issuedAt}" is not a date. Send the issued-at as an ISO 8601 timestamp.`
    );
  }

  const message: HandleClaimMessage = {
    name,
    address: claimedAddress,
    purpose,
    issuedAt: input.issuedAt,
    nonce: input.nonce,
  };

  // The signature is read once and asked two questions: viem's own
  // `verifyTypedData` (does it verify against the claimed address?) and the
  // recovered signer (whom do we actually check ownership against?). Both must
  // agree, and the recovered address is what the wallet check uses — never the
  // address the client put in the body.
  const matches = await verifyTypedData({
    address: claimedAddress,
    domain: handleClaimDomain(),
    types: HANDLE_CLAIM_TYPES,
    primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
    message: { ...message },
    signature: input.signature as `0x${string}`,
  }).catch(() => false);

  const recovered = await recoverHandleClaimAddress({ ...message, signature: input.signature });

  if (!recovered) {
    throw new HandleClaimError(
      'invalid-signature',
      400,
      'That signature could not be read. Sign the claim again with your wallet.'
    );
  }

  if (!matches || recovered.toLowerCase() !== claimedAddress.toLowerCase()) {
    // Distinguish a cross-PURPOSE replay from a bad signature: if the same bytes
    // verify for the OTHER purpose, the signature is genuine but was made for a
    // claim the caller is trying to reuse for the other kind. Naming that is the
    // whole point of the `purpose` field.
    const asOtherPurpose = await recoverHandleClaimAddress({
      name,
      address: claimedAddress,
      purpose: otherPurpose(purpose),
      issuedAt: input.issuedAt,
      nonce: input.nonce,
      signature: input.signature,
    });

    if (asOtherPurpose !== null && asOtherPurpose.toLowerCase() === claimedAddress.toLowerCase()) {
      throw new HandleClaimError(
        'purpose-mismatch',
        400,
        `That signature was made to claim a ${otherPurpose(purpose) === 'username' ? 'username' : 'merchant name'}, ` +
          `so it cannot claim a ${purpose === 'username' ? 'username' : 'merchant name'}. ` +
          'Sign the claim again with the purpose you mean.'
      );
    }

    throw new HandleClaimError(
      'signature-mismatch',
      400,
      `That signature was produced by ${recovered}, not by the claimed address ${claimedAddress}. ` +
        'A handle can only be claimed by the key that controls the address it is claimed for.'
    );
  }

  // Ownership, through the existing registry rather than a second copy of it.
  const wallets = await getWalletsByUser(input.userId);
  const owned = wallets.some((wallet) => wallet.address.toLowerCase() === recovered.toLowerCase());

  if (!owned) {
    throw new HandleClaimError(
      'address-not-owned',
      403,
      `${recovered} is not one of the wallets registered to your account. ` +
        'Claim with the wallet that will receive the payments.'
    );
  }

  // First-come, in the ONE namespace. The handle is the key a person and a
  // business compete for, so a single lookup decides both the exact-name and the
  // same-link collisions the old two-column design had to check separately.
  const existing = await prisma.handle.findUnique({ where: { handle } });

  const heldBy = existing?.address ? getAddress(existing.address) : null;

  if (existing && heldBy !== claimedAddress) {
    throw new HandleClaimError(
      'handle-taken',
      409,
      `"${existing.name}" already holds the handle ${handle} (${heldBy ?? 'with no address'}). ` +
        'Handles are first-come: choose another, or claim with the wallet that already holds it.'
    );
  }

  const claimedAt = new Date();

  // A business profile is a MODE on the handle. A person has none, so claiming a
  // handle as a person writes no profile — the handle still resolves to an
  // address, which is all a send needs.
  const merchantId = input.kind === 'business'
    ? await ensureBusinessProfile({
        existingMerchantId: existing?.merchantId ?? null,
        name,
        payoutAddress: claimedAddress,
      })
    : null;

  const claim = {
    handle,
    kind: input.kind,
    name,
    purpose,
    address: claimedAddress,
    claimSignature: input.signature,
    claimIssuedAt: input.issuedAt,
    claimNonce: input.nonce,
    claimedAt,
    userId: input.userId,
    merchantId,
  };

  try {
    return existing
      ? await prisma.handle.update({ where: { id: existing.id }, data: claim })
      : await prisma.handle.create({ data: claim });
  } catch (error) {
    // The unique index is the concurrency guard: two claims racing for the one
    // handle both pass the read above, and exactly one write wins.
    if (isUniqueViolation(error)) {
      throw new HandleClaimError(
        'handle-taken',
        409,
        `The handle ${handle} was taken while this request was in flight. Choose another name.`
      );
    }
    throw error;
  }
}

/**
 * The business profile behind a business handle.
 *
 * Kept here rather than in a route so a claim is one transaction-shaped act: the
 * handle and the profile a business mode needs either both exist or neither
 * does. An existing profile is updated in place — its id is what a customer's
 * past payments already point at, so a re-claim must not mint a new one.
 */
async function ensureBusinessProfile(input: {
  existingMerchantId: string | null;
  name: string;
  payoutAddress: string;
}): Promise<string> {
  if (input.existingMerchantId) {
    const updated = await prisma.merchant.update({
      where: { id: input.existingMerchantId },
      data: { name: input.name, payoutAddress: input.payoutAddress },
    });
    return updated.id;
  }

  const created = await prisma.merchant.create({
    data: { name: input.name, payoutAddress: input.payoutAddress },
  });
  return created.id;
}

// ---------------------------------------------------------------------------
// Handle availability — the claim path's own rule and lookup, for the preview.
// ---------------------------------------------------------------------------

/** Whether a handle is usable and free, for someone still typing a name. */
export interface HandleStatus {
  /** The name as the rule would store it. */
  name: string;
  /** The link's handle for that name — `seti.live/<m|u>/<handle>`. */
  handle: string;
  /** A name-, handle- or reserved-rule failure, or null when the name is usable. */
  problem: string | null;
  /**
   * Whoever already holds this handle, or null when it is free. Only a NAME is
   * surfaced — enough to tell the person the link is taken, and no more than a
   * claim refusal would already name.
   */
  takenBy: string | null;
}

/**
 * The claim path's validation and uniqueness, exposed for the claim form's live
 * preview.
 *
 * It calls the SAME rule functions and the SAME handle lookup the claim does, so
 * the form can never tell a person a handle is free that the claim would then
 * refuse. It is behind the same auth as the claim (see `routes/handles.ts`): a
 * signed-in user checking a handle they are about to sign for, not anonymous
 * enumeration.
 */
export async function handleStatus(rawName: string): Promise<HandleStatus> {
  const name = normalizeMerchantName(rawName);
  const handle = merchantHandle(rawName);
  const problem =
    describeHandleName(rawName) ?? describeHandleOf(rawName) ?? describeReservedHandle(rawName);

  if (problem) return { name, handle, problem, takenBy: null };

  const holder = await prisma.handle.findUnique({
    where: { handle },
    select: { name: true },
  });

  return { name, handle, problem: null, takenBy: holder?.name ?? null };
}
