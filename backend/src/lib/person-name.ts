/**
 * The name a person goes by, cleaned.
 *
 * Its own module, and for the reason `par-bands.ts` is one: two things must agree about this
 * rule and neither may drag the other's dependencies in. The route validates with it and a
 * check proves it without a database, while `services/account.ts` writes the result — and that
 * service reaches Prisma and the network config on import.
 *
 * ## What it does not decide
 *
 * It does not decide the HANDLE. A Seti name is signed, it is the string people pay by, and it
 * is immutable: nothing in this module can reach it, and the profile screen offers no edit for
 * it (#536).
 */

/** The longest name a row or a heading can carry on one line. */
export const PERSON_NAME_MAX = 60;

/**
 * Trimmed, inner runs of whitespace collapsed to one space, leading `@` dropped — or null
 * when there is no name in what was typed.
 *
 * The `@` matters more than it looks: this field sits one row above the handle, so " @ian" is
 * the mistake people actually make, and storing it would print `@@ian` under their medallion.
 *
 * Refused: nothing left, fewer than two characters, more than `PERSON_NAME_MAX`, or a control
 * character — a name with a newline breaks every row and heading it is printed in, and no
 * amount of splitting fixes that later.
 */
export function normalizePersonName(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, ' ').trim().replace(/^@+/, '').trim();
  if (collapsed.length < 2 || collapsed.length > PERSON_NAME_MAX) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(collapsed)) return null;
  return collapsed;
}
