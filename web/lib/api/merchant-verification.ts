/**
 * Read a merchant payload's verification flag.
 *
 * The resolve response carries `verified`, but the `Merchant` shape the pay flow
 * is typed with predates it and is owned elsewhere. This reads the field the
 * backend actually sent without widening that shared type, and — the important
 * part — returns `null` when the field is absent instead of guessing. A missing
 * flag is not a "yes": nothing is shown as verified unless the server said so.
 */
export function merchantVerification(merchant: unknown): boolean | null {
  if (typeof merchant !== 'object' || merchant === null) return null;
  const value = (merchant as { verified?: unknown }).verified;
  return typeof value === 'boolean' ? value : null;
}
