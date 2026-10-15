import { NETWORK_LABEL, type Network } from '@/lib/network';

/**
 * Every word the "by address" half of Receive renders, and the one place the
 * payload shape is stated.
 *
 * The FILE names say `address`, the API keeps saying `deposit` (`GET
 * /account/deposit`, `DepositTarget`): the endpoint is the server's contract and
 * renaming it here would put two vocabularies on one call. What the customer sees
 * is Receive, by name or by address, and that is what this folder is named after.
 *
 * The network is named in TEXT beside the code, and it is named with the
 * product's own two words — Practice on the test network, Live on mainnet. Never
 * "testnet"/"mainnet" (those are the database's words, not a customer's) and never
 * a token name: which stablecoin the sender picks is theirs to choose, and naming
 * one here would suggest the address only accepts that one. It does not — a Tempo
 * address holds both.
 */
export const ADDRESS_COPY = {
  loading: 'Finding your deposit address…',
  title: 'Send to this address',
  qrTitle: (network: Network) =>
    `Your ${NETWORK_LABEL[network]} deposit address, as a QR code a wallet can scan.`,
  copyAction: 'Copy address',
  copiedAction: 'Copied',
  copyFailed: 'Could not copy. Select the address and copy it by hand.',
  /**
   * The one line under the address half: which network to send on, and the chain
   * behind it.
   *
   * It replaces "Send on Live. This is your Live deposit address." — the owner
   * called that redundant and it was: the network twice in one breath, plus the
   * word "deposit" on a surface called Receive. What survives is the half that
   * carries a FACT a sender has to act on: an EVM address exists on every chain, so
   * the network has to be said in words or the sender is guessing which one to send
   * on. Said once, and then the chain itself — the word a sender needs when they
   * ask "which network is this?".
   *
   * Practice and Live are the product's words for a network; Tempo is the name of
   * the network. Neither is "testnet"/"mainnet" (the database's words), and no token
   * is named (which stablecoin a sender picks is theirs to choose).
   */
  tempoNote: (network: Network) =>
    `Send on ${NETWORK_LABEL[network]}. Money arrives on Tempo, in seconds.`,
  unavailable: (network: Network) =>
    `No ${NETWORK_LABEL[network]} address is registered for this account yet, so ` +
    'nothing is shown to send to. It is registered when you sign in, and signing in ' +
    'again will do it.',
  mismatchTitle: 'That address does not match your account',
  mismatchBody:
    'The wallet in this browser is not the address this account is registered with ' +
    'on the chain this site is running on, so no code is shown: sending now would ' +
    'name a chain and a destination that have not been confirmed together. Sign out ' +
    'and back in, then try again.',
  wrongNetworkTitle: 'This app is built for a different network',
  wrongNetworkBody: (served: Network, build: Network) =>
    `This site is serving ${NETWORK_LABEL[served]}, but the copy of the app you loaded ` +
    `was built for ${NETWORK_LABEL[build]}. No address is shown, because the chain to ` +
    'send on cannot be stated correctly from here. Reload once the app has been updated.',
  unreachableTitle: 'Could not check your deposit address',
  unreachableBody:
    'The address could not be checked against your account, so none is shown. Nothing ' +
    'has changed about where money should go — try again in a moment.',
} as const;

/**
 * The exact string the deposit QR encodes: EIP-681.
 *
 * `ethereum:<address>@<chainId>` — the form EIP-681 defines, where the chain id is
 * part of the PATH (not a query parameter), so a wallet that reads it can nominate
 * the chain and switch before signing rather than guessing the sender's current
 * one. The chain id is the value the SERVER reported for the address it returned,
 * never the build's own: the point of the whole surface is that the code and the
 * address agree about which chain this is, and a code built from a stale build's
 * constant would re-introduce exactly the mismatch the server check removes.
 *
 * THE CHAIN ID IS THE LOAD-BEARING PART. An EVM address is one identifier that
 * exists on every chain — this app creates one embedded wallet per account, and
 * every wallet row carries that same address — so the address alone does not say
 * where to send. The chain id does, and it is also what decides which network view
 * the deposit then appears in: sent on the other Tempo network, the money is at a
 * real address the account controls, but it lands in that network's ledger rather
 * than the one being looked at; sent on a chain Seti does not watch at all, the
 * funds are still the account's, and Seti simply cannot show them. None of those
 * is a loss, which is exactly why the surface states the chain rather than relying
 * on the address to imply it.
 *
 * Reviewed for wallet-friendlessness and kept: EIP-681 is Final, the chain-id
 * segment is the documented form, and a bare address with no function is the case
 * wallets support best. A wallet that does not parse EIP-681 still receives the
 * address, which is why the address is also printed in full beneath the code.
 */
export function eip681PaymentUri(address: string, chainId: number): string {
  return `ethereum:${address}@${chainId}`;
}
