/**
 * Copy for the account's network row.
 *
 * ## Why there is no "practise, then go Live" sentence any more
 *
 * The row states the chain the account acts on (`CHAIN_NAME`, from `lib/chain`) and,
 * on Live, the account's deposit address. It carries no sentence about what a
 * network's money is: the practice frame already says that where it matters, and a
 * note beside the chain was a second way of stating one fact.
 *
 * The Live side is DISABLED WITH A REASON, never silently grey: `liveNoteFallback` is
 * the fallback sentence for the switch, and the server's own readiness reason is what
 * the switch would show, so the control and the deployment can never disagree about
 * why Live is unavailable.
 */
export const PROFILE_NETWORK_COPY = {
  title: 'Network',
  switchLabel: 'Network',
  practiceDisabledNote: null,
  /** Shown under a Live option that cannot be chosen. */
  liveNoteFallback:
    'Live is not available yet. It opens when a mainnet batch proof lands. Real money is not moved until then.',
  /**
   * Shown under Live on a build that SERVES PRACTICE ONLY.
   *
   * Distinct from `liveNoteFallback`, which is about the mainnet batch proof and
   * only applies where Live is possible at all: on a practice-only deployment the
   * proof is irrelevant, and the honest reason is that this deployment cannot
   * serve Live — so the disabled control says that from the first render.
   */
  practiceOnlyReason:
    'This deployment is Practice only, so Live is not available here. Nothing in this app moves real money.',
  noDepositTitle: 'No live deposit address yet',
  noDepositBody:
    'A live address is registered when you go Live. Until then there is nothing to fund. This account is still practising.',
  errorTitle: 'Could not switch network',
  switching: 'Switching',
} as const;
