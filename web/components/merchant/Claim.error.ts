import type { MerchantClaimState } from '@/hooks/useMerchantClaim.types';
import { CLAIM_REFERENCE_LABEL } from './Claim.constants';

/**
 * How a refused claim is rendered — the ONE decision about what goes where.
 *
 * A claim fails in four distinguishable ways and each belongs in a different
 * place on the form:
 *
 *  - a bad or reserved NAME is the person's own input, so it goes on the field;
 *  - any other refusal is the SERVER's answer about the claim itself — a name
 *    already taken, a signature that does not match, an address this account does
 *    not hold — so it is a block message, with the server's reason mapped from its
 *    code by `refusal.constants.ts`;
 *  - an UNKNOWN failure — no code, or a code this build has never seen — is the
 *    only case that gets the generic sentence. That separation is the point: the
 *    owner's mainnet claim was refused with a specific typed reason
 *    (`address-not-owned`) and the form could only say "Seti could not complete
 *    that. Try again in a moment.", which reads as a glitch and teaches nobody
 *    anything.
 *
 * The correlation id rides along when the server sent one, so the sentence a
 * person is looking at resolves to the exact log line — the graceful-fault
 * pattern's whole reason for minting the id in the first place.
 */
export interface ClaimErrorView {
  /** The message belongs on the name field. */
  nameProblem: boolean;
  /** The message to show as a block refusal, or null. */
  blockError: string | null;
  /** The support reference to print beside it, or null when there is none. */
  reference: string | null;
}

/**
 * The only part of the claim's state this view reads.
 *
 * Narrowed to the three fields deliberately: onboarding's intent step renders a
 * claim failure from the SAME view as the form, and it holds a claim's failure
 * without holding the form's whole state. Two renderers of one decision, not two
 * decisions.
 */
export type ClaimFailure = Pick<MerchantClaimState, 'error' | 'errorCode' | 'errorRequestId'>;

/** The codes fixed by EDITING THE NAME, so they belong on the field. */
const NAME_CODES = new Set(['invalid-handle-name', 'reserved-handle']);

export function claimErrorView(claim: ClaimFailure): ClaimErrorView {
  const nameProblem = claim.errorCode !== null && NAME_CODES.has(claim.errorCode);

  return {
    nameProblem,
    blockError: claim.error && !nameProblem ? claim.error : null,
    reference:
      claim.errorRequestId && claim.error
        ? `${CLAIM_REFERENCE_LABEL} ${claim.errorRequestId}`
        : null,
  };
}
