'use client';

import { useEffect, useRef } from 'react';
import { recordConvert } from '@/lib/api/convert';
import { fetchSettlePlan } from '@/lib/api/settle';
import { buildSettlementCall } from '@/lib/pay/build-swap';
import { buildTempoTransaction } from '@/lib/pay/build-transfer';
import type { SupportedAsset } from '@/lib/chain';
import { useSession } from '@/lib/auth';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useTempoSender } from '@/hooks/useTempoSender';
import { useAppNetwork } from '@/components/app/useAppNetwork';

/** How long to wait after mount before doing housekeeping nobody asked for. */
const SETTLE_DELAY_MS = 2500;

/**
 * Settle the account's balance into OUSD, quietly, once per app open.
 *
 * ## Why this is client-side at all
 *
 * Because the customer signs it. Seti is non-custodial, so no backend key can move
 * a customer's stablecoin; the only wallet that can is theirs, and it is available
 * only while they have the app open. That constraint IS the batching rule: settle
 * at app open, when the plan says the amount is worth a swap, one interaction with
 * the book per threshold crossing instead of one per payment.
 *
 * ## Why it is invisible
 *
 * The balance is one USD figure (#85), so which token holds it is not a customer's
 * business. Nothing here renders. Every failure — no book, a revert, an expired
 * plan, the wallet briefly unavailable — is a skip and the money stays where it is,
 * which is a supported state. A customer must never be told that housekeeping
 * failed.
 *
 * ## Ordering that matters
 *
 *  - Once per mount, and never again: a re-render must not re-sign.
 *  - Delayed, so the first paint and the balance read are not competing with it.
 *  - Sequential, stopping at the first failure: two swaps racing the same balance
 *    would have the second revert on insufficient funds, and one revert is enough
 *    information for this pass.
 *  - The plan is re-fetched at sign time rather than reused from a cache: a quote
 *    that has been sitting is not a price.
 */
export function useSettlementRunner(): void {
  const session = useSession();
  const { network } = useAppNetwork();
  const { status, getSigningWallet } = useEmbeddedWallet();
  const { sendTempoTransaction } = useTempoSender();

  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (session.status !== 'signed-in') return;
    if (status !== 'ready') return;

    started.current = true;
    let active = true;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const plan = await fetchSettlePlan();
          if (!active || plan.items.length === 0) return;

          const wallet = await getSigningWallet();

          for (const item of plan.items) {
            if (!active) return;

            const assetIn = item.assetIn as SupportedAsset;
            const assetOut = item.assetOut as SupportedAsset;

            const call = buildSettlementCall({
              assetIn,
              assetOut,
              amountIn: item.amountIn,
              minAmountOut: item.minAmountOut,
              network,
            });

            const txHash = await sendTempoTransaction(
              // The fee token is the INPUT token: the plan was priced against a
              // balance that includes the gas this swap costs.
              buildTempoTransaction({ asset: assetIn, calls: [call], network })
            );

            await recordConvert({
              assetIn,
              assetOut,
              amountIn: item.amountIn,
              minAmountOut: item.minAmountOut,
              txHash,
              walletAddress: wallet.address,
            });
          }
        } catch {
          // Silent by design: the balance is one USD figure either way, and this
          // runs while the customer is doing something else. The next app open
          // asks the server for a fresh plan.
        }
      })();
    }, SETTLE_DELAY_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
    // Deliberately keyed on the three facts that make running possible: a session,
    // a ready wallet, and a network. Re-running for anything else would re-sign.
  }, [session.status, status, network, getSigningWallet, sendTempoTransaction]);
}
