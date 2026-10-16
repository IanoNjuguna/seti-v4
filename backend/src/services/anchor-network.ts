/**
 * THE ANCHOR-NETWORK INVARIANT for the check suites that reconcile a PINNED receipt.
 *
 * A receipt is per CHAIN: an anchor taken on Moderato proves nothing about mainnet.
 * A suite whose pinned anchor is a Moderato receipt therefore makes a statement
 * about Moderato, and it must NOT run while this deployment SERVES mainnet —
 * reconciling a Moderato receipt against entities resolved through a
 * mainnet-serving deployment is the exact cross-network mix the per-network
 * config exists to forbid, and it is the mix a green gate must never hide.
 *
 * No mainnet batch receipt is pinned yet (no mainnet batch carries both legs — see
 * `docs/internal/mainnet-flip.md`), so the honest outcome on a mainnet deployment
 * is an explicit SKIP that names the reason. A skip is NOT a pass: it is printed,
 * it says nothing about the fee arithmetic was verified, and the gate must count
 * it as a skip.
 *
 * The guard IS the invariant, asserted: a pinned-anchor suite runs only when the
 * network this deployment serves IS the network its anchor is on, and that match
 * is reported as an `ok` line so a reader can see the check ran on the right chain.
 */
import { servedNetwork, type AnchorKind } from '../config/networks.js';
import { chainIdForNetwork, NETWORK_LABEL, type Network } from '../lib/network.js';

/**
 * Whether this deployment serves the network a suite's pinned anchor is on.
 *
 * True  → prints an `ok` naming the served network, and the caller proceeds.
 * False → prints a loud `skip` naming the anchor's network, the served network,
 *         and the reason no anchor exists on the served one, and returns false.
 *
 * The caller MUST treat false as SKIP (exit 0 with the reason shown), never as a
 * pass and never as a failure: whether the fee arithmetic holds is simply not
 * testable against a network with no anchor.
 */
export function anchorNetworkPermitsRun(input: {
  suite: string;
  kind: AnchorKind;
  /** The network the suite's PINNED anchor receipt is on. */
  anchorNetwork: Network;
  /** The env var that would pin a receipt on the served network, for the message. */
  envVar?: string;
  /** The noun for the message when the suite is not one of the three anchor kinds. */
  anchorNoun?: string;
}): boolean {
  const { suite, kind, anchorNetwork } = input;
  const noun = input.anchorNoun ?? kind;

  if (servedNetwork === anchorNetwork) {
    console.log(
      `ok    ${suite}: this deployment serves the anchor's network, ` +
        `${NETWORK_LABEL[servedNetwork]} (${servedNetwork}, chain ${chainIdForNetwork(servedNetwork)})`
    );
    return true;
  }

  const anchorLabel = NETWORK_LABEL[anchorNetwork];
  const servedLabel = NETWORK_LABEL[servedNetwork];
  const envName = input.envVar ?? `TEMPO_${servedNetwork.toUpperCase()}_${kind.toUpperCase()}_ANCHOR_TX`;

  console.error(
    `skip  ${suite}: this suite reconciles a pinned ${noun} receipt and cannot run against a\n` +
      `      network with no anchor.\n` +
      `      Its ${noun} anchor is a ${anchorLabel} receipt ` +
      `(${anchorNetwork}, chain ${chainIdForNetwork(anchorNetwork)}), while this deployment\n` +
      `      SERVES ${servedLabel} (${servedNetwork}, chain ${chainIdForNetwork(servedNetwork)}). ` +
      `No ${servedLabel} anchor is\n` +
      `      pinned yet: no ${servedNetwork} batch receipt exists. A receipt is per CHAIN, so\n` +
      `      reconciling the ${anchorNetwork} receipt against entities resolved through the ` +
      `${servedNetwork}-serving\n` +
      `      deployment is the cross-network mix this gate must never do.\n` +
      `      SKIPPED — NOT passed: nothing about this suite's assertions was verified.\n` +
      `      To run it for real, pin a ${servedLabel} receipt as ${envName},\n` +
      `      or run this suite on ${anchorLabel} with TEMPO_CHAIN_ID=${chainIdForNetwork(anchorNetwork)}.`
  );
  return false;
}
