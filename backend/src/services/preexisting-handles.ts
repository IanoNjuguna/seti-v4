import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { findHandleByHandle } from './handles.js';
import { toHandleIdentityView } from './handle-claims.js';
import type { Network } from '../lib/network.js';

/**
 * The handles that were already in the database before a check suite ran, and the
 * proof that the suite left them alone.
 *
 * WHY THIS EXISTS
 *
 * Four suites (`check:claim`, `check:handle`, `check:username`, `check:network`)
 * each carried their own copy of "the six merchants" —
 * `ianllc`, `burgerking`, `kfc`, `seti`, `javahouse`, `safaricomshop` — hardcoded
 * with their addresses and their verified flags. Those rows lived in one
 * developer's database and nowhere else. CI builds its database from migrations,
 * so all six were absent there, and every "unchanged" assertion failed with
 * `false (expected true)` for a reason that had nothing to do with the code. The
 * gate was red on `main` for a day because of it.
 *
 * The promise the suites are actually keeping is "a handle that already existed is
 * not damaged by this run", which is measurable on whatever rows exist, including
 * none. So the snapshot is taken at runtime and compared at runtime, and a
 * developer's database stops being load-bearing for the gate.
 *
 * `verified` is deliberately not stored or compared: it is recomputed from the
 * stored signature on every read, so an unchanged signature and address are the
 * same fact stated by its cause.
 */

export interface PreexistingHandle {
  id: string;
  handle: string;
  name: string;
  address: string;
  network: string;
  kind: string;
  claimSignature: string | null;
  /**
   * `null` for a live handle, a status for one that holds its string without
   * resolving.
   *
   * It is snapshotted because it changes what "unchanged" means for the row: the
   * resolver filters every non-null status out, so for one of those resolving to
   * nothing is the correct behaviour and asserting otherwise is asserting the
   * opposite of the design.
   */
  reviewStatus: string | null;
}

const FIELDS = {
  id: true,
  handle: true,
  name: true,
  address: true,
  network: true,
  kind: true,
  claimSignature: true,
  reviewStatus: true,
} as const;

/** Every handle NOT belonging to the calling suite, taken before it writes. */
export async function snapshotPreexisting(
  excludeWhere: Prisma.HandleWhereInput
): Promise<PreexistingHandle[]> {
  return prisma.handle.findMany({ where: { NOT: excludeWhere }, select: FIELDS });
}

/**
 * Re-reads every snapshotted row and asserts it is byte-identical, then asks the
 * same resolver the routes use whether it still resolves on the network it is on.
 */
export async function checkPreexistingUnchanged(
  before: PreexistingHandle[],
  check: (label: string, actual: unknown, expected: unknown) => void
): Promise<void> {
  for (const row of before) {
    const after = await prisma.handle.findUnique({ where: { id: row.id }, select: FIELDS });

    check(`${row.handle}: still exists`, after !== null, true);
    check(`${row.handle}: name unchanged`, after?.name, row.name);
    check(`${row.handle}: address unchanged`, after?.address, row.address);
    check(`${row.handle}: signature unchanged`, after?.claimSignature, row.claimSignature);
    check(`${row.handle}: network unchanged`, after?.network, row.network);
    check(`${row.handle}: profile kind unchanged`, after?.kind, row.kind);

    /*
     * A handle whose `reviewStatus` is set is deliberately unresolvable:
     * `findHandleByHandle` filters `reviewStatus: null`, so a `reserved`
     * first-refusal hold resolves to nothing on purpose — and so does a `pending`
     * row left in a database from before the held-brand list was removed (#139).
     * This assertion used to demand that such a row resolve anyway, which turned a
     * correctly held row into a red gate on any machine holding one — while CI,
     * which seeds nothing, stayed green. That is the shape of failure the gate
     * exists to prevent: a red `verify` that means "your database", not "your
     * diff" (#11).
     *
     * Every identity assertion above still runs for such a row, so the hold cannot
     * hide a deletion or an edit. The exemption is one line of output rather than a
     * silent `continue`, because a skip nobody can see is indistinguishable from a
     * check that was never written.
     */
    if (row.reviewStatus !== null) {
      check(
        `${row.handle}: held (${row.reviewStatus}), so it is expected NOT to resolve`,
        row.reviewStatus,
        row.reviewStatus
      );
      continue;
    }

    const resolved = await findHandleByHandle(row.handle, row.network as Network);
    const view = resolved ? await toHandleIdentityView(resolved) : null;
    check(`${row.handle}: still resolves on its own network`, view !== null, true);
  }
}
