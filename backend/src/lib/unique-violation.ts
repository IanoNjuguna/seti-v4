import { Prisma } from '@prisma/client';

/**
 * Unique-constraint failures, and WHICH index refused the write.
 *
 * Extracted from `services/signup.ts`, which had the one copy of this test and
 * used it for the one collision sign-up expects (an email that already exists).
 * It is shared now because a second call site needs the same test AND the extra
 * half `signup` never needed: knowing which unique index fired. The two must not
 * be able to disagree about what a P2002 is, so there is one implementation.
 *
 * `instanceof Prisma.PrismaClientKnownRequestError` rather than a duck-typed
 * `'code' in error` check, because this runs on the request path: an arbitrary
 * thrown `{ code: 'P2002' }` should not be treated as a database answer. (The CLI
 * helpers that duck-type it run offline, where the Prisma runtime is not loaded.)
 */
export function isUniqueViolation(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * The columns the violated index covers, as far as the driver will say.
 *
 * Postgres (the only database this service runs on) reports the column list for a
 * unique index, e.g. `['txHash', 'userId', 'network']`. Other drivers report the
 * CONSTRAINT NAME, which arrives here as a single string. Both are normalised to
 * a list so callers can ask a column-oriented question either way. `null` means
 * the error did not say — which a caller must treat as "I cannot tell which index
 * this was", never as a match.
 */
export function uniqueViolationColumns(error: unknown): string[] | null {
  if (!isUniqueViolation(error)) return null;

  const target = (error.meta as { target?: unknown } | undefined)?.target;

  if (Array.isArray(target)) {
    const columns = target.filter((entry): entry is string => typeof entry === 'string');
    return columns.length > 0 ? columns : null;
  }

  return typeof target === 'string' ? [target] : null;
}

/**
 * True only when a unique violation was raised by an index that covers EVERY one
 * of `columns`.
 *
 * This is the guard that keeps idempotency honest: a P2002 on some other index —
 * a quote id, a handle, a wallet address — must never be read as "the row I
 * wanted already exists". Match a constraint name loosely (it contains the column
 * names) and a column list exactly, so both reports above work.
 */
export function violatesUniqueOn(error: unknown, columns: readonly string[]): boolean {
  const reported = uniqueViolationColumns(error);
  if (!reported) return false;

  const lowered = reported.map((entry) => entry.toLowerCase());
  return columns.every((column) => lowered.some((entry) => entry.includes(column.toLowerCase())));
}
