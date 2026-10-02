/**
 * Format an amount as KES with tabular-friendly formatting.
 * Example: formatCurrency(1250) -> "KES 1,250.00"
 */
export function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
