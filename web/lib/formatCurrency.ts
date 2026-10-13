/**
 * Format an amount in the customer's own currency.
 * Example: formatFiat(1250, 'KES') -> "KES 1,250.00"
 *
 * The currency is an ARGUMENT, never assumed. It used to be baked in as "KES",
 * which made every figure a money claim about a currency the figure might not be
 * in — a KES-labelled number that was really a stablecoin amount overstates by
 * the fx rate, and the same label served both meanings.
 *
 * The code (not the symbol) is printed, matching how the app has always rendered
 * money, so a customer who switched currency could never mistake ₹ for KSh.
 *
 * Decimals come from the currency itself: 2 for KES and INR, 0 for JPY. Hardcoding
 * two would render a currency that has none as "JPY 1,250.00", which is a figure
 * that cannot be paid.
 */
export function formatFiat(amount: number, currency: string): string {
  const decimals = currencyDecimals(currency);

  /**
   * A figure smaller than the smallest unit of its own currency cannot be printed as
   * one — and must not be printed as zero.
   *
   * Rounding half-up to the minor unit is right for a figure that is a label (the
   * customer's fee, displayed in shillings, is a presentation of a charge that was
   * actually made in the stablecoin). But when that rounding would land on zero, the
   * zero is a lie the customer reads as "free". So a sub-unit amount is shown as
   * "less than one unit", which is true.
   *
   * Nothing here ever feeds a charge: the fee is computed and collected in the asset
   * (`backend/src/services/fees.ts`), and this formatter is display only.
   */
  if (amount !== 0 && Math.abs(amount) < 0.5 * 10 ** -decimals) {
    const unit = new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(10 ** -decimals);
    return `<${currency} ${unit}`;
  }

  return `${currency} ${new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)}`;
}

/**
 * How many decimals this currency uses, asked of the runtime rather than guessed.
 *
 * Falls back to 2: an unknown code is a configuration problem, and two decimals is
 * the safer wrong answer for a money figure than zero.
 */
function currencyDecimals(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en-KE', { style: 'currency', currency })
        .resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}
