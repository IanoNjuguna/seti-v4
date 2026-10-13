import { env } from '../config/env.js';

/**
 * Merchant fee schedule.
 *
 * The product spec (README.md, AGENTS.md) says "merchant 2% + KES 50 minimum",
 * which is ambiguous: it does not say what happens when the flat floor exceeds
 * the percentage. Taken literally as `max(fiat * 2%, 50)`, the floor binds
 * until the payment reaches KES 2,500, so a KES 100 payment carries a KES 50
 * fee — 50% of the ticket. That is a pricing bug, not a minimum.
 *
 * Resolution: the floor still exists (it keeps tiny payments from costing more
 * to process than they are worth) but it is capped as a share of the payment.
 * The cap is configurable, so the commercial decision stays explicit rather
 * than buried in an arithmetic expression.
 */

export interface MerchantFeeSchedule {
  /** Percentage of the payment, e.g. 2 for 2%. */
  percent: number;
  /** Flat floor in KES. */
  minKes: number;
  /** Ceiling as a percentage of the payment. 0 disables the cap. */
  maxPercent: number;
}

export function getMerchantFeeSchedule(): MerchantFeeSchedule {
  return {
    percent: env.MERCHANT_FEE_PERCENT,
    minKes: env.MERCHANT_FEE_MIN_KES,
    maxPercent: env.MERCHANT_FEE_MAX_PERCENT,
  };
}

export interface MerchantFeeResult {
  /** Fee actually charged, in KES. */
  feeFiat: number;
  /** Fee before the cap was applied. Useful for audit/reconciliation. */
  uncappedFeeKes: number;
  /** True when the cap, not the schedule, determined the final figure. */
  cappedByMaxPercent: boolean;
  /** True when the flat floor, not the percentage, determined the figure. */
  floorApplied: boolean;
}

/**
 * Computes the merchant fee for a payment amount expressed in the customer's fiat.
 *
 * Precedence: percentage -> floor -> cap.
 *
 * 1. percentage: fiatAmount * percent / 100
 * 2. floor:      never less than minKes
 * 3. cap:        never more than fiatAmount * maxPercent / 100
 *
 * A zero-amount payment yields a zero fee rather than the floor, so the cap
 * cannot invert the result.
 *
 * WHAT IS ACTUALLY CHARGED: the ASSET. The customer signs a stablecoin transfer and
 * the 2% is collected as stablecoin; this fiat figure is the label on that charge —
 * the unit the customer thinks in, and the only one they see. Two consequences that
 * must not be undone:
 *
 *   - A presentation rounding (rounding a fee to the minor unit of a currency, e.g.
 *     dropping sub-yen dust for a JPY user) must never reach the charge. The rounding
 *     to 2dp below exists to strip float dust like 10.000000000000002, not to make
 *     this a currency rule; the fee that is signed is derived from the fiat at full
 *     precision.
 *   - A fee that would round to zero when displayed is still a charge. It is shown as
 *     "less than one unit" (see `formatFiat` in web/lib/formatCurrency.ts) rather than
 *     as zero, which the customer would read as free.
 */
export function calculateMerchantFee(
  fiatAmount: number,
  schedule: MerchantFeeSchedule = getMerchantFeeSchedule()
): MerchantFeeResult {
  if (!Number.isFinite(fiatAmount) || fiatAmount <= 0) {
    return {
      feeFiat: 0,
      uncappedFeeKes: 0,
      cappedByMaxPercent: false,
      floorApplied: false,
    };
  }

  const percentageFee = (fiatAmount * schedule.percent) / 100;
  const uncappedFeeKes = Math.max(percentageFee, schedule.minKes);

  const cappedByMaxPercent =
    schedule.maxPercent > 0 && uncappedFeeKes > (fiatAmount * schedule.maxPercent) / 100;
  const feeFiat = cappedByMaxPercent
    ? (fiatAmount * schedule.maxPercent) / 100
    : uncappedFeeKes;

  return {
    // Guard against float dust like 10.000000000000002.
    feeFiat: Math.round(feeFiat * 100) / 100,
    uncappedFeeKes: Math.round(uncappedFeeKes * 100) / 100,
    cappedByMaxPercent,
    floorApplied: !cappedByMaxPercent && percentageFee < schedule.minKes,
  };
}

/**
 * Splits a total that INCLUDES the merchant fee back into its principal and
 * fee components.
 *
 * v1 collects the fee inside the customer's transfer: they send `principal +
 * fee` to the merchant, so the fee is collected atomically with the payment
 * and no sweep or relayer is needed. The consequence is that the backend
 * receives a gross figure and must invert the schedule to recover the
 * principal the merchant actually gets to keep.
 *
 * With a flat percentage and no floor, `total = principal * (1 + pct/100)`,
 * so `principal = total / (1 + pct/100)`.
 *
 * This is the exact inverse of calculateMerchantFee applied to the principal,
 * up to rounding at 2dp. Rounding the principal UP is deliberate: it keeps
 * the fee slightly higher rather than slightly lower, so Seti is never the
 * party that absorbs float dust.
 */
export function splitFeeInclusiveTotal(
  total: number,
  schedule: MerchantFeeSchedule = getMerchantFeeSchedule()
): { principalFiat: number; feeFiat: number } {
  if (!Number.isFinite(total) || total <= 0) {
    return { principalFiat: 0, feeFiat: 0 };
  }

  const grossMultiplier = 1 + schedule.percent / 100;

  // Floor and cap schedules are not invertible in closed form: the fee may be
  // pinned at the floor or clamped at the cap, and several principals can map
  // to the same total. Rather than guess, resolve it by search over the range
  // of principals whose fee is determined by the floor or the cap.
  if (schedule.minKes > 0 || schedule.maxPercent > 0) {
    return solveWithFloorOrCap(total, schedule);
  }

  const principalExact = total / grossMultiplier;
  const principalFiat = Math.ceil(principalExact * 100) / 100;
  const feeFiat = Math.round((total - principalFiat) * 100) / 100;

  return { principalFiat, feeFiat };
}

/**
 * Recovers the principal when a floor or cap is in effect.
 *
 * The fee schedule has three regimes, so the inverse is piecewise. The
 * principal that reproduces `total` is found by testing the regime boundaries
 * directly: if the cap is active the fee is `total * cap/(100+cap)`, and if
 * the floor is active the principal is `total - floor`.
 */
function solveWithFloorOrCap(
  total: number,
  schedule: MerchantFeeSchedule
): { principalFiat: number; feeFiat: number } {
  const capFee =
    schedule.maxPercent > 0 ? (total * schedule.maxPercent) / (100 + schedule.maxPercent) : null;

  // Cap regime: fee is proportional to the gross total. Valid when the implied
  // fee does not exceed the floor (otherwise the floor would apply instead).
  if (capFee !== null && capFee >= schedule.minKes) {
    const principalFiat = Math.ceil((total - capFee) * 100) / 100;
    return {
      principalFiat,
      feeFiat: Math.round((total - principalFiat) * 100) / 100,
    };
  }

  // Floor regime: the fee is the flat minimum, so the principal is the
  // remainder. Valid only while that principal stays under the percentage
  // crossover.
  if (schedule.minKes > 0) {
    const principalFiat = Math.ceil((total - schedule.minKes) * 100) / 100;
    const floorHolds = calculateMerchantFee(principalFiat, schedule);
    if (floorHolds.feeFiat === schedule.minKes || principalFiat <= 0) {
      return { principalFiat, feeFiat: schedule.minKes };
    }
  }

  // Percentage regime.
  const principalExact = total / (1 + schedule.percent / 100);
  const principalFiat = Math.ceil(principalExact * 100) / 100;
  return {
    principalFiat,
    feeFiat: Math.round((total - principalFiat) * 100) / 100,
  };
}

/**
 * KES amount below which the flat floor would exceed maxPercent of the
 * payment. Below this, the cap governs the fee.
 *
 * Useful for surfacing a minimum ticket size in the UI instead of silently
 * charging a fee the merchant did not expect.
 */
export function minimumTicketForFloor(
  schedule: MerchantFeeSchedule = getMerchantFeeSchedule()
): number {
  if (schedule.maxPercent <= 0 || schedule.percent <= 0) return 0;
  return (schedule.minKes / schedule.maxPercent) * 100;
}
