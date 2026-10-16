'use client';

import { Button, Card, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { getExplorerTxUrl } from '@/lib/chain';
import { formatFiat } from '@/lib/formatCurrency';

export interface PaySuccessSummary {
  /** Who was paid, as the customer knows them. */
  merchant: string;
  /** The principal — what the merchant received. The headline figure. */
  amountFiat: string;
  feeFiat: string;
  networkFeeFiat: string;
  /** Principal + fee + gas: what left the customer's wallet. */
  totalFiat: string;
  fiatCurrency: string;
  /** `true` when the gas figure is a live estimate rather than a reserve. */
  gasEstimated: boolean;
}

export interface PaySuccessProps {
  txHash: string | null;
  onDone: () => void;
  /**
   * What was paid, when the caller still holds it. Optional and additive: the
   * screen renders the same title, hash and button without it, which is what the
   * three earlier call sites needed.
   */
  summary?: PaySuccessSummary | null;
}

/**
 * The moment after the money left: the one screen in the product that is allowed
 * a deliberate flourish, and the one that most needs to be exact.
 *
 * It used to be a centred title, the raw 66-character hash in 14px grey (the only
 * evidence, mid-word, and the smallest, palest thing on the screen) and a Done
 * button. No amount, no merchant, no fee, no link, nothing that said the payment
 * had been recorded. For the emotional peak of a payments app that is an empty
 * screen, and the hash read as a server log line.
 *
 * Three rules decide everything here:
 *
 *  1. **The money is the hero.** The amount is the app's own balance treatment
 *     (`variant="balance"`, tabular, 24px at 360px) with the merchant under it,
 *     because the first question after paying is "how much, to whom".
 *  2. **The hash is proof, so it is legible and it links.** In a `surface-soft`
 *     well, under a label, at 13px in the mono face at which hashes align, with
 *     the check-yourself link this screen never had. A person who has just moved
 *     money is entitled to verify it.
 *  3. **Nothing here counts up or re-plays.** The figure is rendered, not
 *     animated; the only motion is the check, once, on mount
 *     (`app/app/motion.css`, `--duration-slow`) — the single deliberate moment
 *     `design/motion.md` reserves for the whole product. It is `transform` and
 *     `opacity`, it never re-runs on a re-render, and reduced motion shows it
 *     plainly.
 *
 * `role="status"` makes the whole card the announcement, so a screen reader hears
 * the amount and the merchant rather than the button.
 */
export function PaySuccess({ txHash, onDone, summary }: PaySuccessProps) {
  return (
    <Card className="space-y-4 text-center" role="status">
      <span
        aria-hidden="true"
        className="check-in mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft text-accent-light-green"
      >
        <Icon name="check" className="h-6 w-6" />
      </span>

      <div>
        <Text variant="card-title" as="h2">
          Payment sent
        </Text>

        {summary ? (
          <>
            <Text variant="balance" tabular as="p" className="mt-2">
              {formatFiat(Number(summary.amountFiat), summary.fiatCurrency)}
            </Text>
            <Text variant="body" color="secondary" as="p" className="mt-1">
              to {summary.merchant}
            </Text>
          </>
        ) : null}
      </div>

      {summary ? (
        <Text variant="micro" color="secondary" as="p">
          {/* Every figure the wallet moved from, in one sentence: the amount, the
              2% the customer funded, and the gas. Naming all three is the
              difference between a receipt and a reassurance. */}
          You paid <span className="font-tabular">{formatFiat(Number(summary.totalFiat), summary.fiatCurrency)}</span>:{' '}
          <span className="font-tabular">{formatFiat(Number(summary.feeFiat), summary.fiatCurrency)}</span>{' '}
          platform fee,{' '}
          <span className="font-tabular">
            {summary.gasEstimated ? '≈ ' : ''}
            {formatFiat(Number(summary.networkFeeFiat), summary.fiatCurrency)}
          </span>{' '}
          network gas.
        </Text>
      ) : null}

      {txHash ? (
        <div className="rounded-md bg-surface-soft p-3 text-left">
          <Text variant="micro" color="secondary" as="p">
            Transaction
          </Text>
          {/* `link` is the doc's inline-link colour on a white surface; the hash
              is a link out, so it is drawn as one. */}
          <a
            href={getExplorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all font-mono text-caption text-link underline-offset-4 hover:underline"
          >
            {txHash}
          </a>
        </div>
      ) : null}

      <Text variant="micro" color="secondary" as="p">
        It is in your activity now.
      </Text>

      <Button className="mt-2" onClick={onDone} fullWidth>
        Done
      </Button>
    </Card>
  );
}
