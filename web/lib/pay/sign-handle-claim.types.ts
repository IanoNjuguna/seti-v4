import type { Address } from 'viem';
import type { HandleKind } from '@/lib/api/handles.types';

/**
 * The exact fields the wallet is asked to display and sign.
 *
 * A TYPE ALIAS, not an interface, and deliberately: TypeScript gives an object
 * type alias an implicit index signature, which is what makes it assignable to the
 * `Record<string, unknown>` a signing library types its `message` as. An interface
 * has no implicit index signature, so the same fields would need a cast at the call
 * site, and a cast is where a field quietly stops being checked.
 */
export type HandleClaimMessage = {
  name: string;
  address: string;
  /** `username` or `merchant-name` — the kind of claim these bytes authorise. */
  purpose: string;
  issuedAt: string;
  nonce: string;
};

/** What the message is built from: everything except the one-time fields. */
export interface BuildHandleClaimInput {
  /** Person or business — selects the purpose that goes INTO the signed message. */
  kind: HandleKind;
  /** The username or the business name as typed. Normalised before it is signed. */
  name: string;
  /** The embedded wallet's address — the address the handle is claimed FOR. */
  address: Address;
}

/** A signed claim: the bytes, and the signature over them. */
export interface HandleClaimSignature {
  /** The signed message, verbatim, to send back with the signature. */
  message: HandleClaimMessage;
  signature: string;
}

export interface HandleClaimTypedData {
  domain: { name: string; version: string; chainId: number };
  types: HandleClaimTypes;
  primaryType: string;
  message: HandleClaimMessage;
}

/**
 * The EIP-712 type table, in the mutable shape a signing library expects.
 *
 * Not `as const`: the arrays are handed to Privy's `signTypedData`, whose
 * `types` is `Record<string, TypedDataParameter[]>`, and a readonly tuple is not
 * assignable to it. The FIELD ORDER is what must not move, and `satisfies` keeps
 * that checked without freezing the arrays.
 */
export type HandleClaimTypes = Record<string, { name: string; type: string }[]>;
