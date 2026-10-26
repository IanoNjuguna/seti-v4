import { claimErrorView } from '@/components/merchant/Claim.error';
import { refusalMessageFor } from '@/lib/api/refusal.constants';
import type { ClaimFailure } from '@/components/merchant/Claim.error';
import type {
  EmbeddedWalletStatus,
  PrivySessionState,
  WalletRepairFailureCode,
} from '@/hooks/useEmbeddedWallet.types';

/**
 * What step three of onboarding may offer, and what it must say.
 *
 * ## Why this is not decided in the component
 *
 * The rule is a precedence, and a precedence written inline is a rule nobody can
 * test: the render is checked by reading markup, but "does a claim's own refusal
 * outrank the wallet's absence" is a question about the decision, not the pixels.
 *
 * ## The precedence
 *
 *  1. **A claim that failed.** The person acted; what happened to that action is
 *     what they are owed, even on a device where the wallet has since gone away.
 *  2. **No wallet at all.** Nothing was attempted and nothing can be, so the step
 *     says so BEFORE it offers a tap that cannot complete, and carries the controls
 *     that fix it. This is the case that walled a new account out: the options
 *     were offered, the tap failed, and the failure was blamed on the name.
 *  3. **A wallet session that expired (#241).** Ours is signed in, Privy's is not,
 *     so the sentence names the expiry and the repair is gone: nothing can be
 *     refreshed or created without the session that ended. The sign-in is the whole
 *     answer, and it is the only control.
 *  4. **A wallet still loading.** A moment, not a fault. Same treatment, a sentence
 *     that promises nothing more than "in a moment".
 *
 * An option is only offerable when there is a wallet that can sign: `canChoose` is
 * exactly that, and the surface disables rather than hides, so the step keeps its
 * shape on a device where the answer is no.
 *
 * ## Knowledge is not capability, and #233 is the gap between them
 *
 * `canChoose` used to be `status === 'ready'`, which was the same thing only while
 * `ready` meant "Privy lists a wallet". Since #226 `ready` also covers an address
 * read from the ACCOUNT, and that address can be a wallet whose key lives on another
 * device — so the step offered its two intents there, the tap reached Privy, Privy
 * threw, and the repair appeared only AFTER the failure it exists to pre-empt. One
 * failed tap per person, for most of the people the report was about.
 *
 * So the decision takes two facts now and reads one for each question: `status`,
 * which says whether an address is KNOWN and picks the sentence (`loading` is a
 * moment, `missing` is a dead end), and `canSign`, which says whether this device
 * can produce the signature and alone decides `canChoose`. A device that knows an
 * address it cannot sign with is therefore not a `ready` state at all here: it gets
 * the `wallet-missing` sentence, the two intents disabled, and the repair offered on
 * arrival. `status` itself is untouched, because four other surfaces read it.
 *
 * ## Signing out is the FALLBACK, never the first offer (#226)
 *
 * `wallet-missing` used to carry one control, "Sign in again", because the app had
 * no other way to get a wallet onto the device. It has one now: the account's own
 * registered address can be resolved, Privy's user can be re-read, and a wallet can
 * be created in place — so `canRepair` is what the surface reads first, and
 * `needsSignIn` stays true BESIDE it rather than instead of it.
 *
 * After a repair that produced nothing, the repair is NOT offered again: the same
 * failing call, pressed again, fails identically. That state offers the sign-in
 * and the sentence that names what went wrong.
 */
export interface WalletRepairState {
  /** False on a build with no Privy app, where there is nothing to create. */
  canRepair: boolean;
  /** True while a repair is in flight, so the control can show it. */
  repairing: boolean;
  /** The cause of the last repair that produced nothing, or null. */
  failureCode: WalletRepairFailureCode | null;
}

export interface IntentWalletFailure {
  blockError: string;
  reference: string | null;
  /** True when a sign-in is a way out of this, which is most wallet states. */
  needsSignIn: boolean;
  /** True when the app can put a wallet on this device without signing out. */
  canRepair: boolean;
}

export interface IntentWalletState {
  /** False when tapping an option would start something that cannot finish. */
  canChoose: boolean;
  /** The failure to render under the options, or null when there is none. */
  failure: IntentWalletFailure | null;
}

/**
 * What the wallet contributes to the decision, as three answers and not one.
 *
 *  - `status` — whether an address is KNOWN. Decides the sentence: `loading` is a
 *    moment ("still getting ready"), `missing` is a dead end (`wallet-missing`).
 *  - `canSign` — whether THIS DEVICE can produce the signature. Decides
 *    `canChoose`, and nothing else does.
 *  - `privySession` — whether the SESSION those answers are about is still alive
 *    (#241). Decides the expiry sentence and takes the repair off the table.
 *
 * All are fields of one object rather than positional arguments because `ready`,
 * `canSign` and `privySession` are `boolean`-adjacent facts that were collapsed into
 * one and must not be able to swap places at a call site (#233, #241). `privySession`
 * is REQUIRED rather than defaulted for the same reason: the compiler then names
 * every call site that has not thought about it.
 */
export interface IntentWalletFacts {
  status: EmbeddedWalletStatus;
  canSign: boolean;
  privySession: PrivySessionState;
}

/**
 * What an untouched wallet looks like: nothing has been tried, so a repair is
 * still on the table and no cause is known.
 */
export const WALLET_UNREPAIRED: WalletRepairState = {
  canRepair: true,
  repairing: false,
  failureCode: null,
};

export function intentWalletState(
  wallet: IntentWalletFacts,
  claim: ClaimFailure,
  repair: WalletRepairState = WALLET_UNREPAIRED
): IntentWalletState {
  const view = claimErrorView(claim);
  // A repair that has already run and left nothing is spent: offering it again is
  // the same tap, and the sign-in is what remains.
  //
  // An expired wallet session is the second reason it is spent (#241), and it is a
  // TERM here rather than a branch below so the two places that can offer a repair
  // cannot disagree: a claim that failed just before Privy's session died still has
  // to stop offering a control whose refresh and create calls cannot run.
  const canRepair = repair.canRepair && repair.failureCode === null && wallet.privySession === 'live';

  if (view.blockError) {
    const walletFailed = claim.errorCode === 'wallet-missing';

    return {
      canChoose: wallet.canSign,
      failure: {
        blockError: view.blockError,
        reference: view.reference,
        needsSignIn: walletFailed,
        canRepair: walletFailed && canRepair,
      },
    };
  }

  // Privy's own session is over while OURS is not (#241). It is checked BEFORE
  // `loading`, because the two are different kinds of not-yet: a list that is late
  // will arrive, and an unauthenticated Privy will never load the user the list comes
  // from. A sentence promising "in a moment" there would be a promise the SDK cannot
  // keep, which is the same lie as the button this issue removes.
  //
  // The repair is refused whatever the caller passed, because `refreshUser()` and
  // `createWallet()` both need the session that has expired: offering it would move
  // the same lie from the button to the sentence above it. The sign-in is the one
  // control that can work, and it ends our session as well, which is what makes a new
  // Privy one possible.
  if (wallet.privySession === 'expired') {
    return {
      canChoose: false,
      failure: {
        blockError: refusalMessageFor('wallet-session-expired'),
        reference: null,
        needsSignIn: true,
        canRepair: false,
      },
    };
  }

  // The LOADING sentence comes before the dead end below, because a list that has
  // not arrived yet cannot sign either: the second branch would otherwise claim a
  // device that is a moment away is a dead end, and take its repair offer with it.
  // This is an ordering of answer, not of blame: nothing is wrong, something is late.
  if (wallet.status === 'loading') {
    return {
      canChoose: false,
      failure: {
        blockError: refusalMessageFor('wallet-not-ready'),
        reference: null,
        needsSignIn: false,
        canRepair: false,
      },
    };
  }

  // Nothing on this device can sign. Reached for `missing`, and for `ready` whose
  // address came from the account rather than from a wallet Privy lists — the case
  // in #233, where `ready` was read as "a tap will finish" and was wrong. The
  // sentence is the same because the fact is: the address is known, the signature is
  // not producible here.
  if (!wallet.canSign) {
    return {
      canChoose: false,
      failure: {
        // A failed repair says what actually happened; otherwise the sentence is
        // `wallet-missing`'s own, whose meaning has not changed: there is nothing
        // on this device that can sign.
        blockError: refusalMessageFor(repair.failureCode ?? 'wallet-missing'),
        reference: null,
        needsSignIn: true,
        canRepair,
      },
    };
  }

  return { canChoose: true, failure: null };
}
