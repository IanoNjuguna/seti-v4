import type { AskSummary, RequestState } from '@/lib/api/requests';

/**
 * The claims band's props and the shape its hook returns.
 *
 * Split so the band can be rendered from fixtures: `ActivityClaimsBand` is pure and takes
 * claims, and `ActivityClaims` wires the read. `check:claim-band` renders the pure half.
 */

/** One row, once the state has been reduced to something a customer can read. */
export interface ClaimRowModel {
  publicId: string;
  /** The customer's own memo, or a plain "Claim" when they wrote none. */
  title: string;
  /** `Shared 12 Nov · paid to @ian`. */
  subtitle: string;
  /** `KES 500.00`, formatted and never re-parsed by the caller. */
  amount: string;
  state: RequestState;
  /** The word under the amount: `Waiting`, `Paid`, `Withdrawn`, `Lapsed`. */
  stateWord: string;
  /** True only while the claim can still be paid: the one state that offers Cancel. */
  cancellable: boolean;
}

export interface ActivityClaimsBandProps {
  rows: ClaimRowModel[];
  /** Which claim is being cancelled, so its control can say so and never fire twice. */
  cancelling: string | null;
  error: string | null;
  onCancel: (publicId: string) => void;
}

export interface ClaimRowProps {
  claim: ClaimRowModel;
  cancelling: boolean;
  onCancel: (publicId: string) => void;
}

export interface UseClaimsReturn {
  /** Null until the first read answers, so an empty band never flashes on load. */
  rows: ClaimRowModel[] | null;
  cancelling: string | null;
  error: string | null;
  cancel: (publicId: string) => void;
}

export type ClaimSummaries = AskSummary[];
