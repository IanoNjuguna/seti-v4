'use client';

import { useCreateWallet, useUser, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Address, EIP1193Provider } from 'viem';
import { tempoChainFor } from '@/lib/chain';
import { useAppNetwork } from '@/components/app/useAppNetwork';
import { PRIVY_APP_ID } from '@/components/providers/PrivyAppProvider.constants';
import { useSession } from '@/lib/auth';
import { registeredWalletAddress, resolveEmbeddedWallet } from '@/lib/auth/account-wallet';
import { fetchAccountWallets, registerAccountWallet } from '@/lib/api/wallets';
import {
  NoEmbeddedWalletError,
  type EmbeddedWalletValue,
  type SigningWallet,
  type WalletRepairFailureCode,
} from './useEmbeddedWallet.types';

/**
 * The Privy-backed embedded wallet, ready to sign a Tempo transaction.
 *
 * ## The list is a view, the account is the record
 *
 * Privy can surface several wallets (external ones, older HD indices), so the
 * embedded one is picked explicitly by `walletClientType === 'privy'` rather than
 * taking `wallets[0]` and hoping.
 *
 * That list, though, is a view of the user object the SDK last FETCHED — and it is
 * the view that fails. A wallet created headlessly during sign-in (the app has no
 * Privy UI to prompt through) resolves from `createWallet()` while the list catches
 * up a render later; when it never catches up, `status` stayed `missing` on a
 * browser whose account had held a registered wallet all along, and every signing
 * path refused. So the address comes from `resolveEmbeddedWallet` — Privy's wallet
 * first, the account's registered one second — and the surface stops refusing a
 * session the server itself calls wallet-holding.
 *
 * ## Two questions, and #233 is what happens when one answers both
 *
 * `ready` means "an address is known to bind". It does NOT mean "this device can
 * sign", because the second source is the account and its key may be elsewhere. For
 * a while `status` was read as if it meant both, and the claim offered its two
 * intents on a device with nothing to sign with: one tap, one Privy throw, one
 * `wallet-missing` classification, and the repair appearing only AFTER the failure it
 * was supposed to pre-empt. So the hook answers both questions separately — `status`
 * for knowledge, `canSign` for capability — and `status` keeps the meaning the other
 * four surfaces already rely on (#233).
 *
 * ## Why a repair refreshes before it creates
 *
 * `refreshUser()` re-reads the user from Privy and is what makes the list catch up;
 * it costs one call and no prompt, so the hook makes that call by itself the once
 * (below) and again when a person asks for the repair. Creating is the LAST step,
 * taken only when the account's own rows say it holds no wallet at all — a second
 * address is the failure `wallet-registry.ts` records, and `createWallet()` errors
 * outright once an embedded wallet exists.
 */
function usePrivyEmbeddedWallet(): EmbeddedWalletValue {
  const { wallets, ready } = useWallets();
  /**
   * `refreshUser` is the SDK's own "ask again": it re-reads the user and the
   * identity token, which is what makes a wallet list that lagged a render (or a
   * login) catch up. `usePrivy` does not expose it — `useUser` does, and its
   * documented purpose is exactly this: programmatically picking up a change the
   * client has not seen.
   */
  const { refreshUser } = useUser();
  const { createWallet } = useCreateWallet();
  const session = useSession();
  /**
   * The network the ACCOUNT is acting on. The wallet is switched to it before
   * signing, so a practice account is not first moved onto the live chain — the
   * deployment's chain is the wrong answer here for the same reason it is on the
   * signing path itself.
   */
  const { network } = useAppNetwork();

  const signedIn = session.status === 'signed-in';
  const userId = signedIn ? (session.user?.id ?? null) : null;

  /**
   * The address the ACCOUNT holds, or the one a repair just created.
   *
   * State rather than a derivation, because two things write it: the read below and
   * the repair, which must survive the render in which `useWallets()` has not
   * caught up yet. It is the same value the sign-in flow kept in a ref — kept,
   * this time, somewhere the app can still read it.
   */
  const [accountAddress, setAccountAddress] = useState<Address | null>(null);
  /**
   * The address a repair CREATED in this browser, or null.
   *
   * Kept apart from `accountAddress` because the two are different evidence, and
   * #233 exists because one address was being read as both: the account's rows name
   * a wallet the account holds, which may be a key on another device; a wallet
   * `createWallet()` just made here is a key this browser has. Only the second is
   * proof that this device can sign (#233).
   *
   * State rather than a flag on the repair's result, because the fact outlives the
   * one render that created it: Privy's list catches up a render or more later, and
   * for that window the wallet exists and can sign while `wallets` still says it
   * does not.
   */
  const [createdAddress, setCreatedAddress] = useState<Address | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairFailure, setRepairFailure] = useState<WalletRepairFailureCode | null>(null);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    fetchAccountWallets(userId)
      .then((rows) => {
        if (active) setAccountAddress(registeredWalletAddress(rows));
      })
      .catch(() => {
        // A read that failed is not an answer: the browser's own wallet list is
        // still consulted, and `missing` stays reachable. Nothing is written, so a
        // transient outage cannot deprecate an address the account does hold.
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const wallet = useMemo(
    () => wallets.find((candidate) => candidate.walletClientType === 'privy') ?? wallets[0] ?? null,
    [wallets]
  );
  const privyAddress = (wallet?.address as Address | undefined) ?? null;

  const { status, address } = resolveEmbeddedWallet({
    ready,
    signedIn,
    privyAddress,
    accountAddress,
  });

  /**
   * Whether a control may ask for a signature — and NOT `status === 'ready'`, which
   * is the bug #233 fixes.
   *
   * `resolveEmbeddedWallet` answers a question about ADDRESSES, and since #226 it
   * says `ready` for an address it read from the account. That address is inside the
   * signed bytes but its key may be on a different device, so `ready` on its own
   * cannot tell a surface that a tap will finish. This can:
   *
   *  - a wallet Privy lists. It is a signing provider, so it signs;
   *  - a wallet the repair created HERE, through the second term, for the render or
   *    two before Privy's list catches up. It is the same key the list is about to
   *    report, and it is in this browser, so it signs. Without that term the claim
   *    would disable its own two options again the instant a successful repair
   *    returned — the control going dead under the finger that had just fixed it —
   *    and re-offer the repair it had already spent.
   *
   * What is deliberately NOT a term: `accountAddress`. An account's registered
   * address is a fact about the account, and treating it as proof of a local key is
   * exactly what made row two of #233 offer a tap that could not complete.
   */
  const canSign = privyAddress !== null || createdAddress !== null;

  /**
   * The one automatic catch-up attempt, per address.
   *
   * The documented failure is a wallet LIST that lags the wallet that exists, and
   * `refreshUser()` is the supported way to ask for it again. It runs only when
   * there is evidence the browser SHOULD see a wallet — a signed-in account whose
   * rows name an address — so a genuinely walletless account costs no extra call.
   * The ref, not the state, is what stops it repeating: a refresh that changes
   * nothing must not loop, and `refreshUser` is not referentially stable enough to
   * depend on for that.
   */
  const refreshedFor = useRef<Address | null>(null);
  useEffect(() => {
    if (!ready || privyAddress || !signedIn || !accountAddress) return;
    if (refreshedFor.current === accountAddress) return;

    refreshedFor.current = accountAddress;
    void refreshUser().catch(() => {
      // Left to the repair action below, which says something when it fails.
    });
  }, [ready, privyAddress, signedIn, accountAddress, refreshUser]);

  const getSigningWallet = useCallback(async (): Promise<SigningWallet> => {
    if (!wallet) throw new NoEmbeddedWalletError();

    try {
      // Ask for the Tempo chain first: the embedded wallet may be sitting on
      // another one, and signing for the wrong chain is a silent money bug. Not
      // fatal if it fails — the transaction carries its own chainId, and some
      // providers report the chain as already-set this way.
      await wallet.switchChain(tempoChainFor(network).id);
    } catch {
      // Fall through: the tx below is chain-specific anyway.
    }

    const provider = (await wallet.getEthereumProvider()) as EIP1193Provider;
    return { provider, address: wallet.address as Address };
  }, [wallet, network]);

  /**
   * Put a wallet on this device without ending the session, in the order that
   * cannot make things worse: refresh, read the account, create only if it holds
   * nothing.
   */
  const repair = useCallback(async () => {
    setRepairing(true);
    setRepairFailure(null);

    try {
      try {
        // The list lags; asking again is free and needs no prompt. A failure here
        // is not fatal — the account read below is the authority either way.
        await refreshUser();
      } catch {
        // Continue: see above.
      }

      const rows = userId ? await fetchAccountWallets(userId) : [];
      const accountWallet = registeredWalletAddress(rows);
      setAccountAddress(accountWallet);

      if (accountWallet) {
        // The account HAS a wallet, so nothing is created: minting a second one is
        // the failure the registry records, and the binding this browser is missing
        // comes from a new session, not a new key.
        setRepairFailure('wallet-missing');
        return;
      }

      // Genuinely none. This is the one case where creating is right, and the key
      // is made here because the browser is the only party that may hold it.
      const created = await createWallet();
      const newAddress = created.address as Address;

      // Written to accountAddress for the address `status` binds, and to
      // createdAddress because THIS key is in this browser — the one fact that lets
      // `canSign` stay true while Privy's list catches up, so the claim's two
      // options come back on the next render instead of waiting for a reload (#233).
      setCreatedAddress(newAddress);
      setAccountAddress(newAddress);

      // Recorded, because a claim binds a name to an ADDRESS the account holds and
      // the backend refuses one it has no row for. If this fails the wallet exists
      // but cannot be claimed with, so it is a create failure, not a silent one.
      if (userId) await registerAccountWallet(userId, newAddress);
    } catch (error) {
      setRepairFailure('wallet-create-failed');
      // Logged ONCE, with the cause: this used to fail into an empty catch, so a
      // person looped through the same button with nothing in the console at all.
      console.error(
        '[wallet] could not set up a wallet for this account:',
        (error as Error | null)?.message ?? error
      );
    } finally {
      setRepairing(false);
    }
  }, [userId, refreshUser, createWallet]);

  return {
    status,
    canSign,
    address,
    getSigningWallet,
    repair,
    canRepair: true,
    repairing,
    repairFailure,
  };
}

/**
 * With no Privy app configured there is no embedded wallet, and no provider to
 * read one from — calling `useWallets` outside `PrivyProvider` throws.
 *
 * `canRepair` is false here, and it is the honest answer rather than a limitation:
 * this build has no wallet to create and no SDK to create it with, so the surface
 * must not offer a control that cannot work.
 */
function useNoEmbeddedWallet(): EmbeddedWalletValue {
  const getSigningWallet = useCallback(async (): Promise<SigningWallet> => {
    throw new NoEmbeddedWalletError();
  }, []);

  const repair = useCallback(async (): Promise<void> => {
    // Nothing to repair with. A no-op rather than a throw, because the caller is a
    // click handler and `canRepair: false` is what keeps it from being offered.
  }, []);

  return {
    status: 'missing',
    // Nothing here can sign, and not merely "no address is known": there is no SDK
    // to sign with at all, so the two are the same answer in this build.
    canSign: false,
    address: null,
    getSigningWallet,
    repair,
    canRepair: false,
    repairing: false,
    repairFailure: null,
  };
}

/**
 * Chosen once at module scope, not inside a render.
 *
 * `PRIVY_APP_ID` is fixed for a build, so only one implementation is ever used and
 * hook order is identical on every render — the reason this is a module-level
 * ternary rather than a condition inside the hook body, which `react-hooks/rules-of-hooks`
 * rejects (rightly).
 */
export const useEmbeddedWallet: () => EmbeddedWalletValue = PRIVY_APP_ID
  ? usePrivyEmbeddedWallet
  : useNoEmbeddedWallet;
