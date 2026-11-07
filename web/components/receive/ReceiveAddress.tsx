'use client';

import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { ReceiveAddressBlock } from './ReceiveAddressBlock';

/**
 * The account's own address, printed under the code and the name (#419).
 *
 * A Seti account pays a username. A BRIDGE, a CEX withdrawal, or a wallet from anywhere else
 * has nothing but an address, and until this block there was no screen in the product that
 * would tell a customer what theirs is. The money that funded this week's vault deposit
 * arrived that way.
 *
 * One source, `useEmbeddedWallet()`: the same wallet every signing path uses, so this block
 * cannot disagree with the address a swap or a payment actually signed with. Nothing is
 * requested here — and nothing is drawn while that wallet is still being resolved, because a
 * label with no address under it is worse than no label.
 *
 * The shape itself lives in `ReceiveAddressBlock`, which takes the string, so it can be
 * rendered and checked without a live session.
 */
export function ReceiveAddress() {
  const { address } = useEmbeddedWallet();

  if (!address) return null;

  return <ReceiveAddressBlock address={address} />;
}
