/**
 * Network types, mirroring `backend/src/lib/network.ts`.
 *
 * Values live in `network.constants.ts`, per the modular structure this repo
 * uses: one file for what a network IS (values, labels), one for the shapes that
 * carry it across an API boundary.
 */
import type { Network } from './network.constants';

export type { Network };

/**
 * Whether this deployment can move LIVE money, and the sentence that says why
 * not. Comes straight from `GET /account` (`AccountIdentity.live`), so the Live
 * control is disabled WITH A REASON rather than silently.
 */
export interface LiveReadiness {
  ready: boolean;
  /** A sentence naming the missing precondition. Null when ready. */
  reason: string | null;
}

/** The API's refusal when a network switch cannot be made. */
export interface NetworkSwitchRefusal {
  code: 'mainnet-not-ready' | 'invalid-network' | string;
  reason: string;
}
