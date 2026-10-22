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
  chainIdForNetwork,
  DEFAULT_NETWORK,
  NETWORK_LABEL,
  isNetwork,
  normalizeNetwork,
  type Network,
} from '../lib/network.js';
import {
  describeHandleName,
  describeHandleOf,
  describeReservedHandle,
  merchantHandle,
  normalizeMerchantName,
} from '../lib/merchant-name.js';
import { servedNetwork } from '../config/networks.js';
import { getWalletsByUser } from './wallet-registry.js';
import { logAuditEvent } from './audit.js';

/**
 * The network vocabulary is re-exported for the same reason the name rule is:
 * a caller of a claim imports ONE module and cannot reach for a second copy of
 * what a network is.
 */
export { DEFAULT_NETWORK, NETWORK_LABEL, isNetwork, normalizeNetwork, type Network };

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
 * The EIP-712 domain for a NETWORK's claims.
 *
 * Read from the network config rather than hardcoded, so a testnet claim and a
 * mainnet claim are different signatures and neither can be replayed on the
 * other chain. The chain id is the network's OWN chain id — a claim made while
 * practising (chain 42431) does not verify on live (chain 4217), which is what
 * makes a live claim a distinct act rather than a reuse of a practice one.
 */
export function handleClaimDomain(targetNetwork: Network = servedNetwork): HandleClaimDomain {
  return {
    name: HANDLE_CLAIM_DOMAIN_NAME,
    version: HANDLE_CLAIM_DOMAIN_VERSION,
    chainId: chainIdForNetwork(targetNetwork),
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
  network?: Network;
}): Promise<`0x${string}` | null> {
  try {
    const domain = handleClaimDomain(input.network ?? servedNetwork);

    if (input.purpose) {
      return await recoverTypedDataAddress({
        domain,
        types: HANDLE_CLAIM_TYPES,
        primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
        message: purposeMessage(input),
        signature: input.signature as `0x${string}`,
      });
    }

    return await recoverTypedDataAddress({
      domain,
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
  /**
   * The network the claim is bound on. Absent on objects that predate the
   * column reads (a hand-built literal in a check), in which case verification
   * uses the served network — which is the practice network in every existing
   * fixture, so nothing that verified before stops verifying.
   */
  network?: string | null;
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
    // Verified against the network the claim is STORED for, so a practice
    // signature is never checked against the live chain id.
    network: normalizeNetwork(handle.network, servedNetwork),
  });

  return recovered !== null && recovered.toLowerCase() === address.toLowerCase();
}

/** What a client may be told about a handle, with the verification recomputed. */
export interface HandleIdentityView {
  /** The handle row id. */
  id: string;
  /**
   * The stored, unique handle behind `seti.live/m/<handle>` or `/u/<handle>`:
   * global for a person, per network for a business (see the `Handle` model).
   */
  handle: string;
  /**
   * The network this claim was bound on — `testnet` (Practice) or `mainnet`
   * (Live): the network whose EIP-712 domain the stored signature was made for.
   * Carried on every read so a link or a receipt is never ambiguous about which
   * network the CLAIM was made on.
   *
   * For a BUSINESS handle that is also its scope: it resolves on that network only.
   * For a PERSON handle it is provenance, not scope — a username is global, so the
   * one row is honoured on both networks (see the `Handle` model).
   */
  network: Network;
  /** The network's product word: Practice | Live. */
  networkLabel: string;
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
   * verifies. There is no path that sets this to true by assertion, and a genuine
   * signature says one thing only: the claimer controls the address. It is not a
   * statement that Seti knows who the business is.
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
  /** The network the handle is bound on. Defaults to the served network. */
  network?: string | null;
  merchant?: { id: string; category: string | null } | null;
}): Promise<HandleIdentityView> {
  const storedNetwork = normalizeNetwork(handle.network, servedNetwork);

  return {
    id: handle.id,
    handle: handle.handle,
    network: storedNetwork,
    networkLabel: NETWORK_LABEL[storedNetwork],
    kind: handle.kind === 'person' ? 'person' : 'business',
    name: handle.name,
    address: handle.address || null,
    category: handle.merchant?.category ?? null,
    verified: await handleClaimVerifies({ ...handle, network: storedNetwork }),
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
  | 'handle-taken'
  /** A takedown named a handle that has no row. */
  | 'handle-not-found'
  /** A brand reassignment was attempted without the evidence that authorises it. */
  | 'evidence-required'
  /** A brand reassignment was attempted without a reason for releasing the holder. */
  | 'reason-required';

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
  /**
   * The network the claim is made ON — `testnet` (Practice) or `mainnet` (Live).
   *
   * Decided by the SERVER from the session, never taken from the client: a claim
   * belongs to the network the account is acting on, and the signature's EIP-712
   * domain is that network's chain id. Optional only so existing callers read as
   * before — an omitted network is the practice default.
   */
  network?: Network;
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
 * The rules and the cryptography every claim must pass — shape, reserved list,
 * address, issued-at, signature and ownership — factored out so the ordinary
 * claim and a brand REASSIGNMENT pass exactly the same gate. A reassignment that
 * could skip the signature would be Seti attaching a name to an address on its
 * own authority, which is the one thing this feature forbids.
 */
interface VerifiedClaim {
  name: string;
  handle: string;
  kind: HandleKind;
  purpose: ClaimPurpose;
  /** The checksummed address the signing key actually controls. */
  address: `0x${string}`;
  /** The network the claim is bound on, resolved from the input. */
  network: Network;
}

async function verifyClaim(input: ClaimHandleInput): Promise<VerifiedClaim> {
  const targetNetwork = normalizeNetwork(input.network, servedNetwork);

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
  const domain = handleClaimDomain(targetNetwork);

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
    domain,
    types: HANDLE_CLAIM_TYPES,
    primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
    message: { ...message },
    signature: input.signature as `0x${string}`,
  }).catch(() => false);

  const recovered = await recoverHandleClaimAddress({
    ...message,
    signature: input.signature,
    network: targetNetwork,
  });

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
      network: targetNetwork,
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
  //
  // Two questions, in this order, and the SECOND one is the fix for the refused
  // Live claim the owner hit (`403 address-not-owned`):
  //
  //  1. is the signer one of this account's wallets ON THE CLAIM'S NETWORK? That
  //     is the normal case — a live claim signed by the account's live wallet.
  //  2. if not, is it one of this account's wallets on the OTHER Seti network?
  //
  // Why (2) has to exist: `registerWallet` defaults to the network the deployment
  // SERVES, so an account that signed in while the box served Practice holds its
  // embedded wallet on Practice only, and a LIVE wallet is a separate registration
  // that happens on its next sign-in. Its first Live claim was therefore refused
  // even though the signed address was the account's own key — the check was
  // asking "is this registered for Live?" when the question the feature needs
  // answered is "does this ACCOUNT control the address that signed?". A claim
  // binds a name to an ADDRESS, and an address belongs to a person on both
  // networks; the `network` column on a wallet row records which network's
  // deposits that row tracks, not which chain the key can sign for.
  //
  // It stays a refusal when neither holds: nothing is bound to an address the
  // account cannot show it holds.
  const signerMatches = (wallet: { address: string }) =>
    wallet.address.toLowerCase() === recovered.toLowerCase();

  const wallets = await getWalletsByUser(input.userId, targetNetwork);
  let owned = wallets.some(signerMatches);

  if (!owned) {
    const otherNetwork: Network = targetNetwork === 'mainnet' ? 'testnet' : 'mainnet';
    const elsewhere = await getWalletsByUser(input.userId, otherNetwork);
    owned = elsewhere.some(signerMatches);
  }

  if (!owned) {
    throw new HandleClaimError(
      'address-not-owned',
      403,
      `${recovered} is not one of the wallets registered to your account on ${NETWORK_LABEL[targetNetwork]}. ` +
        'Claim with the wallet that will receive the payments.'
    );
  }

  return { name, handle, kind: input.kind, purpose, address: claimedAddress, network: targetNetwork };
}

/**
 * Claim a handle for an address, or refuse with a reason.
 *
 * The order is deliberate: cheap local validation first, then the signature,
 * then ownership, then the collision. A bad name or a bad signature never costs
 * a query, and — more importantly — a caller who does not control the address is
 * refused BEFORE anything is looked up about who else holds the handle, so a
 * failed claim cannot be used to probe which handles exist.
 *
 * ## The namespace is GLOBAL for a person and PER NETWORK for a business
 *
 * A person's username is ONE name for one account on both networks, so the
 * collision rule for `kind = 'person'` looks at every network — a DIFFERENT
 * account cannot take it on the other one (which is what the per-network rule
 * allowed: impersonation in the surface where the name is the trust signal). The
 * global partial unique index `handles_person_handle_key` is the same rule in the
 * schema, so a race cannot get past it either.
 *
 * A business name stays per network, on purpose: the owner's ruling is that a
 * merchant's trust mark is the VERIFICATION BADGE (which arrives with KYB), not
 * the string, so a practice `kfc` and a live `kfc` may both exist and a customer
 * tells them apart by the badge. See the `Handle` model in `schema.prisma`.
 */
export async function claimHandle(input: ClaimHandleInput) {
  const { name, handle, kind, purpose, address: claimedAddress, network: claimedNetwork } =
    await verifyClaim(input);

  /**
   * ONE string, ONE name, whichever kind is claiming it (#141).
   *
   * A person's username is global: one row for it, wherever it was claimed, honoured
   * on both networks. A business name is that network's. So the row holding a string
   * is either the person row on any network, or THIS network's business row, and a
   * claim has to look at both namespaces.
   *
   * Looking only for the claiming kind is what let `kfc` be a person handle AND a
   * live business handle at once: one string, two payees, and which one a customer
   * reached depended on the surface asking. Person and business are two namespaces
   * over one string, and a string belongs to one name.
   *
   * Enforced here rather than by an index: the unique indexes are per kind (the
   * person one is global, the business one per network), and a single index over the
   * string would forbid the per-network business duplicate the owner's ruling keeps
   * (a practice `kfc` and a live `kfc` are both allowed). A race between a person and
   * a business claim of one string in the same instant is therefore only caught by
   * this read, which is a gap the takedown path covers.
   */
  const personHold = await prisma.handle.findFirst({ where: { handle, kind: 'person' } });
  const businessHold = await prisma.handle.findFirst({
    where:
      kind === 'business'
        ? { handle, kind: 'business', network: claimedNetwork }
        : // A person's name is GLOBAL, so a business row holding the string on EITHER
          // network is in its way: the name would otherwise be one person here and a
          // business there, which is exactly the split this rule closes.
          { handle, kind: 'business' },
  });
  const existing = personHold ?? businessHold;

  const heldBy = existing?.address ? getAddress(existing.address) : null;

  /**
   * A string held by the OTHER kind is refused outright, with no exemption.
   *
   * Neither escape hatch below applies: the same ACCOUNT re-claiming is first refusal
   * for the same name, not a second name for one string, and the same WALLET is the
   * same person or the same business holding one string twice. One string, one name.
   */
  if (existing && existing.kind !== kind) {
    const heldOn = normalizeNetwork(existing.network, claimedNetwork);
    const heldWord = existing.kind === 'person' ? 'username' : 'business name';
    throw new HandleClaimError(
      'handle-taken',
      409,
      `"${existing.name}" already holds ${handle} as a ${heldWord} on ${NETWORK_LABEL[heldOn]} (${heldBy ?? 'with no address'}). ` +
        (existing.kind === 'person'
          ? 'A username is one name for one account across Practice and Live, so it cannot also be a business name. Choose another name.'
          : 'A business name holds this string, so it cannot also be a username. Choose another name.')
    );
  }

  // The string is held by ANOTHER account (and, for a genuine prior claim, by a
  // different address): refuse. The SAME account may re-claim its own handle — that
  // is what first refusal is.
  if (existing && existing.userId !== input.userId && heldBy !== claimedAddress) {
    const heldOn = normalizeNetwork(existing.network, claimedNetwork);
    throw new HandleClaimError(
      'handle-taken',
      409,
      `"${existing.name}" already holds the handle ${handle} on ${NETWORK_LABEL[heldOn]} (${heldBy ?? 'with no address'}). ` +
        (kind === 'person'
          ? 'A username is one name for one account on both Practice and Live, so it cannot be claimed again here. Choose another name.'
          : 'Handles are first-come: choose another, or claim with the wallet that already holds it.')
    );
  }

  /**
   * A person's name the account ALREADY holds, already signed, for the same
   * address, is done — not re-claimed.
   *
   * This is what makes "switch to Live and keep your name" work with no failure
   * mode at all: the name is global, so it is already in force on the network
   * being acted on, and pressing the claim button again returns the binding that
   * exists instead of writing a second one (which the global index forbids
   * anyway). It is deliberately narrow — a claim for a DIFFERENT address from the
   * same account still goes through the update path below, because that is a
   * genuine re-point of where the name pays, and a `reserved` hold still goes
   * live on the fresh signature.
   */
  if (
    kind === 'person' &&
    existing &&
    existing.userId === input.userId &&
    existing.claimSignature &&
    heldBy === claimedAddress &&
    existing.reviewStatus !== 'reserved'
  ) {
    return existing;
  }

  const claimedAt = new Date();

  // A business profile is a MODE on the handle, minted HERE: a claimed business
  // name is live the moment it verifies, so it must be payable at the same
  // moment. A person has no profile — the handle still resolves to an address,
  // which is all a send needs. An existing profile is updated in place, because
  // its id is what past payments already point at.
  const merchantId =
    kind === 'business'
      ? await ensureBusinessProfile({
          existingMerchantId: existing?.merchantId ?? null,
          name,
          payoutAddress: claimedAddress,
        })
      : null;

  const claim = {
    handle,
    network: claimedNetwork,
    kind,
    name,
    purpose,
    address: claimedAddress,
    claimSignature: input.signature,
    claimIssuedAt: input.issuedAt,
    claimNonce: input.nonce,
    claimedAt,
    userId: input.userId,
    merchantId,
    // A claim that takes over a row the account itself had RESERVED for first
    // refusal goes LIVE: the reservation was a hold, and the fresh signature is
    // what makes it real. Everything else keeps its stored state.
    ...(existing?.reviewStatus === 'reserved' ? { reviewStatus: null, reviewBrand: null } : {}),
  };

  try {
    return existing
      ? await prisma.handle.update({ where: { id: existing.id }, data: claim })
      : await prisma.handle.create({ data: claim });
  } catch (error) {
    // The unique index is the concurrency guard: two claims racing for the one
    // handle on one network both pass the read above, and exactly one write wins.
    if (isUniqueViolation(error)) {
      throw new HandleClaimError(
        'handle-taken',
        409,
        `The handle ${handle} was taken on ${NETWORK_LABEL[claimedNetwork]} while this request was in flight. Choose another name.`
      );
    }
    throw error;
  }
}

/**
 * FIRST REFUSAL on a network: hold this account's BUSINESS names on the target
 * network.
 *
 * The gap this closes: an account practises with the handle `kfckaribu` on
 * testnet, then switches to live — and between the practice claim and the live
 * one, ANYONE could claim `kfckaribu` on mainnet and take the name the account
 * already uses. So on the switch, every BUSINESS handle the account holds on
 * another network is written on the TARGET network as a bare HOLD (`reviewStatus =
 * 'reserved'`): it keeps the string (business uniqueness is per network), it is
 * invisible to every resolver (they filter `reviewStatus = null`), it does NOT
 * verify (no signature), and only this account may take it (`claimHandle` lets
 * the same `userId` past the collision check). The holder re-claims it with a
 * fresh live signature, which is what makes it live.
 *
 * PERSON handles are deliberately NOT held here any more (2026-10-14). A person's
 * username is global, so there is no gap to close: nobody else can take the
 * string on the other network (the global index refuses them) and the name is
 * already in force on the target network, resolved from its one row. Writing a
 * hold for it would be a SECOND row for one person name — which the global index
 * forbids — and a hold that protects nothing is noise.
 *
 * Returns how many names were newly held. Idempotent: a name already claimed or
 * already held on the target network is left alone.
 */
export async function grantFirstRefusal(userId: string, targetNetwork: Network): Promise<number> {
  const held = await prisma.handle.findMany({
    where: { userId, network: { not: targetNetwork }, kind: 'business' },
  });

  let reserved = 0;

  for (const row of held) {
    const existing = await prisma.handle.findFirst({
      where: { handle: row.handle, network: targetNetwork },
    });

    if (existing) continue;

    try {
      await prisma.handle.create({
        data: {
          handle: row.handle,
          network: targetNetwork,
          kind: row.kind,
          name: row.name,
          purpose: row.purpose,
          address: row.address,
          claimSignature: null,
          claimIssuedAt: null,
          claimNonce: null,
          claimedAt: null,
          userId,
          merchantId: null,
          reviewStatus: 'reserved',
          reviewBrand: null,
        },
      });
      reserved += 1;
    } catch (error) {
      // Lost a race for this one name; the other writer holds it. Not a failure.
      if (!isUniqueViolation(error)) throw error;
    }
  }

  if (reserved > 0) {
    await logAuditEvent({
      action: 'handle.first-refusal',
      userId,
      metadata: { network: targetNetwork, reserved },
    });
  }

  return reserved;
}

// ---------------------------------------------------------------------------
// Reassignment on proof — a brand taking a name it has PROVED is its own.
//
// First-come protects a squatter by accident if the brand has no way past it:
// the handle string is unique, so a squatter's live row BLOCKS the brand from
// claiming it. This is the door past that. It is explicit (never a silent
// overwrite), it REQUIRES the evidence that makes it legitimate, and — like every
// claim — it can only attach the name to an address whose key signs for it; Seti
// never moves a name onto an address on its own authority. The previous holder's
// record is preserved, with the reason it was released, before the string is
// taken.
// ---------------------------------------------------------------------------

/** A brand reassignment: a claim, plus the proof that authorises it. */
export interface ReassignHandleInput extends ClaimHandleInput {
  /** Proof the caller is the brand or acts for it. Required; recorded. */
  evidence: string;
  /** Why the current holder is being released. Required; recorded. */
  reason: string;
}

/**
 * Give a PROVED brand a name, whatever state it is in — free, or already held by
 * someone else.
 *
 * The new claim passes the SAME signature-and-ownership gate as any other claim
 * (`verifyClaim`): the brand signs with the wallet that will receive the
 * payments. What makes it a reassignment is the evidence and the release of the
 * previous holder — never a weaker check.
 */
export async function reassignHandleClaim(input: ReassignHandleInput): Promise<HandleIdentityView> {
  const evidence = input.evidence?.trim() ?? '';
  const reason = input.reason?.trim() ?? '';

  if (!evidence) {
    throw new HandleClaimError(
      'evidence-required',
      400,
      'A reassignment needs the evidence that proves the caller is the brand — ' +
        'it is never done on an assertion.'
    );
  }

  if (!reason) {
    throw new HandleClaimError(
      'reason-required',
      400,
      'A reassignment needs the reason the current holder is being released, so the ' +
        'record says why.'
    );
  }

  const {
    name,
    handle,
    kind,
    purpose,
    address: claimedAddress,
    network: claimedNetwork,
  } = await verifyClaim(input);

  const existing =
    kind === 'person'
      ? // A person's name is global, so the row to release is the one that exists,
        // wherever it was claimed. Looking it up per network would miss it and the
        // create below would then collide with the global index.
        await prisma.handle.findFirst({ where: { handle } })
      : await prisma.handle.findFirst({ where: { handle, network: claimedNetwork } });
  const heldBy = existing?.address ? getAddress(existing.address) : null;
  const releasesExisting = existing !== null && heldBy !== claimedAddress;

  if (existing && releasesExisting) {
    // Preserve the previous claimer's CLAIM — signature and all — with the reason,
    // BEFORE the string is taken. This is the record that makes the reassignment
    // auditable rather than a silent overwrite.
    await prisma.handleRelease.create({
      data: {
        handle,
        name: existing.name,
        kind: existing.kind,
        address: existing.address,
        claimSignature: existing.claimSignature,
        claimIssuedAt: existing.claimIssuedAt,
        claimNonce: existing.claimNonce,
        userId: existing.userId,
        merchantId: existing.merchantId,
        reason,
        reassignedTo: claimedAddress,
      },
    });
    await prisma.handle.delete({ where: { id: existing.id } });
  }

  const claimedAt = new Date();
  const merchantId =
    kind === 'business'
      ? await ensureBusinessProfile({
          existingMerchantId: releasesExisting ? null : existing?.merchantId ?? null,
          name,
          payoutAddress: claimedAddress,
        })
      : null;

  const claim = {
    handle,
    network: claimedNetwork,
    kind,
    name,
    purpose,
    address: claimedAddress,
    claimSignature: input.signature,
    claimIssuedAt: input.issuedAt,
    claimNonce: input.nonce,
    claimedAt,
    userId: input.userId,
    merchantId,
    // A reassignment IS the proof: the name goes live, with nothing withheld.
    reviewStatus: null,
    reviewBrand: null,
  };

  const saved =
    releasesExisting || !existing
      ? await prisma.handle.create({ data: claim })
      : await prisma.handle.update({ where: { id: existing.id }, data: claim });

  await logAuditEvent({
    action: 'handle.brand.reassigned',
    userId: input.userId,
    metadata: {
      handle,
      name,
      evidence,
      reason,
      releasedAddress: releasesExisting ? (existing?.address ?? null) : null,
      reassignedTo: claimedAddress,
    },
  });

  return toHandleIdentityView(saved);
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
// Takedown — removing a name from the system, whatever state it is in.
//
// There is no admin role in the schema, so this is a PLAIN FUNCTION, called by an
// operator's script. It acts on a handle, never on a customer's money: removing a
// name frees the string and contacts no funds. It is the remedy that replaced the
// held-brand list (#139): anyone may claim any name, and a name that turns out to
// be someone else's is removed rather than parked.
// ---------------------------------------------------------------------------

/** What a takedown did, for the operator to report. */
export interface HandleTakedown {
  handle: string;
  name: string;
  /** The network the removed row was on, so a same-name row elsewhere is clear. */
  network: Network;
  action: 'removed';
}

/**
 * Take a handle down: the string is FREED and the reason recorded.
 *
 * This is the takedown path, and it works on ANY handle row — a squatter's live
 * name, a `reserved` first-refusal hold, a claim made by an account that later
 * turns out not to be the business. There is no state it refuses to act on,
 * because the reason it exists is a name that should not be in the system.
 *
 * "Freed" is literal — the row is DELETED, releasing the unique handle so the
 * name can be claimed again (a takedown is not a blacklist). The reason is
 * written to the audit trail BEFORE the row goes, because afterwards that trail
 * is the only record of why.
 *
 * The row is the one the RESOLVER would return: the lowercased handle on the
 * served network first, then a global `person` row, since a username is one name
 * on both networks and taking down the row a resolver cannot see would free
 * nothing.
 */
export async function refuseHandleClaim(
  handle: string,
  reason: string
): Promise<HandleTakedown> {
  const row = await findTakedownRow(handle);

  if (!row) {
    throw new HandleClaimError(
      'handle-not-found',
      404,
      `No handle ${handle}. Nothing was removed.`
    );
  }

  await logAuditEvent({
    action: 'handle.brand.refused',
    userId: row.userId ?? undefined,
    metadata: {
      handle: row.handle,
      name: row.name,
      network: row.network,
      reason,
      takedown: true,
    },
  });

  await prisma.handle.delete({ where: { id: row.id } });

  return {
    handle: row.handle,
    name: row.name,
    network: normalizeNetwork(row.network, servedNetwork),
    action: 'removed',
  };
}

/**
 * The row a takedown should remove for a handle: this network's first (any kind,
 * any review state), then the global person row — the same two lookups
 * `findHandleByHandle` resolves with, minus its `reviewStatus: null` filter, so
 * taking a name down reaches every state a name can be in.
 */
async function findTakedownRow(handle: string, network: Network = servedNetwork) {
  const scoped = await prisma.handle.findFirst({
    where: { handle: handle.toLowerCase(), network },
  });

  if (scoped) return scoped;

  return prisma.handle.findFirst({
    where: { handle: handle.toLowerCase(), kind: 'person' },
  });
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
 * refuse. That includes the NAMESPACE RULE, which is why it takes the kind:
 *
 *  - `person` — a username is global, so availability is global. A name held on
 *    the OTHER network is taken, exactly as `claimHandle` would refuse it.
 *  - `business` — a business name is per network, so availability is the acting
 *    network's. A practice business name does not block a live one (the owner's
 *    ruling: the verification badge tells the two apart).
 *  - no kind yet (onboarding's name step, before the intent is chosen) — the
 *    UNION, because either rule could end up applying. Being conservative here is
 *    the point: this preview must never say "free" about a string a claim would
 *    then refuse, and the claim is the authority.
 *
 * It is behind the same auth as the claim (see `routes/handles.ts`): a signed-in
 * user checking a handle they are about to sign for, not anonymous enumeration.
 */
export async function handleStatus(
  rawName: string,
  network: Network = servedNetwork,
  kind?: HandleKind
): Promise<HandleStatus> {
  const name = normalizeMerchantName(rawName);
  const handle = merchantHandle(rawName);
  const problem =
    describeHandleName(rawName) ?? describeHandleOf(rawName) ?? describeReservedHandle(rawName);

  // A refused name has no handle worth looking up, so the collision answer is
  // only ever set alongside a usable handle.
  if (problem) return { name, handle, problem, takenBy: null };

  /**
   * The preview asks the SAME question the claim does (#141): the string is held if a
   * person row exists on any network or this network has a business row. Asking by
   * `kind` told a person that a business name on the other network was taken, and told
   * a business that a person's name on the other network was free.
   */
  const scope =
    kind === 'business'
      ? { OR: [{ kind: 'person' as const }, { kind: 'business' as const, network }] }
      : {};


  const holder = await prisma.handle.findFirst({
    where: { handle, ...scope },
    select: { name: true },
  });

  return {
    name,
    handle,
    problem: null,
    takenBy: holder?.name ?? null,
  };
}
