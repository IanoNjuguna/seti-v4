-- One person name per account — and the rename that replaces it.
--
-- WHY: `User.handles` is an uncapped relation and nothing stopped ONE account
-- holding `akinyi` and `akinyi.k` at the same time. Both resolve, each to
-- whatever address it was bound to, so a single person could present two names —
-- an impersonation surface, and an invite link that cannot say which of the two
-- is really that person. The owner's ruling (2026-10-22): ONE person name per
-- account, and a rename that keeps the OLD string on that same account for 30
-- days instead of freeing it the moment it is dropped.
--
-- The rule is enforced HERE, in the schema, for the same reason the global
-- `handles_person_handle_key` is (20261014140000_global_person_handles): the
-- claim path can be raced, bypassed by a raw write or forgotten by a future
-- writer, and a duplicate person name is an identity, not a field.
--
-- Three steps, in this order, and the order is load-bearing:
--
--   (a) `handle_releases.reassigned_to` becomes NULLABLE — a rename releases a
--       string to NOBODY (`reassigned_to = NULL`), where a brand reassignment
--       releases it to the brand's proved address. Without this the data step
--       below could not record the rows it is about to move.
--   (b) the DATA step resolves accounts that already hold more than one person
--       name: keep the oldest one that resolves, and move the rest into
--       `handle_releases` (full record, signature and all) with a reason and no
--       recipient. It must run BEFORE the index, because the index is the thing
--       the duplicates would violate.
--   (c) the partial unique index itself, mirroring `handles_person_handle_key`:
--       `WHERE kind = 'person' AND "userId" IS NOT NULL`.
--
-- `userId IS NOT NULL` is deliberate, not defensive: a handle row with no owner
-- could exist (a claim posted by a session that was later deleted, an import),
-- and two ownerless rows are not two names on one account. Excluding them keeps
-- the index about the thing it is about.
--
-- RE-RUNNABLE: on a clean database every step is a no-op — no rows match the
-- duplicate ranking, and `ALTER COLUMN … DROP NOT NULL` is idempotent by
-- definition. On a database a previous run already resolved, the ranking yields
-- no rows again, so nothing is moved twice. The ids written in (b) are derived
-- from the source row (`md5` of the handle row's id), so even a half-applied run
-- cannot produce a second release record for the same row.

-- ---------------------------------------------------------------------------
-- (a) A release may now have NO recipient — and it now remembers enough to
--     re-verify.
--
-- `reassignedTo` becomes NULLABLE: a rename releases a string to NOBODY, where a
-- brand reassignment releases it to the brand's proved address. Without this the
-- data step below could not record the rows it is about to move.
--
-- `purpose` and `network` are added because a release row is a FULL COPY of the
-- claim, and those two are part of what makes a copy verifiable rather than a
-- note: the signature covers a purpose (`username` / `merchant-name`) and was made
-- against ONE network's EIP-712 domain. Without them a held string could not be
-- resolved back to a VERIFIED identity — it would resolve as an unverified name,
-- which is exactly the broken state a held rename exists to avoid. Both are
-- nullable: rows written before this migration (brand reassignments) did not
-- record them, and re-verification falls back to the served network for those.
-- ---------------------------------------------------------------------------
ALTER TABLE "handle_releases" ALTER COLUMN "reassignedTo" DROP NOT NULL;

ALTER TABLE "handle_releases" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
ALTER TABLE "handle_releases" ADD COLUMN IF NOT EXISTS "network" TEXT;

COMMENT ON COLUMN "handle_releases"."reassignedTo" IS
  'The proved address a reassigned string went to; NULL when it went to nobody — a rename, or the duplicate names resolved by 20261022200000_person_name_and_rename.';

COMMENT ON COLUMN "handle_releases"."reason" IS
  'Why the claim was released: an operator''s reason, ''renamed'' (a live person name, HELD to the same account for 30 days), ''renamed-unlive'' (a name that never resolved, nothing held), or the migration''s one-name-per-account reason.';

-- ---------------------------------------------------------------------------
-- (b) Resolve accounts that already hold more than one person name.
--
-- WHICH ONE IS KEPT: the oldest row that RESOLVES (`reviewStatus IS NULL`), so a
-- row that does not resolve (`reserved`, or a legacy `pending`) can never win over
-- a live one; if none of the account's
-- person rows resolves, the oldest row is kept so the account is not left with
-- nothing. `claimedAt` is when the backend accepted the claim, with `createdAt`
-- as the fallback for rows written without it, and the row id breaks the tie so
-- the ranking is fully deterministic — the INSERT and the DELETE below must agree
-- exactly about which rows are extra.
--
-- The moved rows are NOT deleted silently: each becomes a `handle_releases` row
-- keeping the whole claim (address, signature, issued-at, nonce, owning account)
-- with the reason it was released and no recipient. A person's name points at
-- where their money lands, so what was dropped has to stay readable.
-- ---------------------------------------------------------------------------
INSERT INTO "handle_releases" (
    "id", "handle", "name", "kind", "address",
    "purpose", "network",
    "claimSignature", "claimIssuedAt", "claimNonce",
    "userId", "merchantId", "reason", "reassignedTo", "createdAt"
)
SELECT
    'mig140_' || md5(h.id),
    h."handle",
    h."name",
    h.kind,
    h.address,
    h."purpose",
    h."network",
    h."claimSignature",
    h."claimIssuedAt",
    h."claimNonce",
    h."userId",
    h."merchantId",
    -- The reason a reader (support, a customer, this migration's own check) sees
    -- for why a name they had stopped resolving.
    'second person name on one account — one name per account, keep the oldest resolving one',
    NULL,
    CURRENT_TIMESTAMP
  FROM "handles" h
  JOIN (
    SELECT r.id
      FROM (
        SELECT h2.id,
               row_number() OVER (
                 PARTITION BY h2."userId"
                 ORDER BY (h2."reviewStatus" IS NULL) DESC,
                          coalesce(h2."claimedAt", h2."createdAt") ASC,
                          h2.id ASC
               ) AS rn
          FROM "handles" h2
         WHERE h2.kind = 'person'
           AND h2."userId" IS NOT NULL
      ) r
     WHERE r.rn > 1
  ) extra ON extra.id = h.id
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "handles" h
 USING (
   SELECT r.id
     FROM (
       SELECT h2.id,
              row_number() OVER (
                PARTITION BY h2."userId"
                ORDER BY (h2."reviewStatus" IS NULL) DESC,
                         coalesce(h2."claimedAt", h2."createdAt") ASC,
                         h2.id ASC
              ) AS rn
         FROM "handles" h2
        WHERE h2.kind = 'person'
          AND h2."userId" IS NOT NULL
     ) r
    WHERE r.rn > 1
 ) extra
 WHERE h.id = extra.id;

-- ---------------------------------------------------------------------------
-- (c) The rule: one person name per account.
--
-- Mirrors `handles_person_handle_key` (one ACCOUNT per string, in
-- 20261014140000_global_person_handles) with its other half — one STRING per
-- account. The two are independent and both hold: a name belongs to exactly one
-- account, and an account has exactly one name. Business handles are untouched:
-- a business's uniqueness stays per network, and a business name is a string, not
-- an identity.
--
-- `IF NOT EXISTS` because this is the one statement in this file that would fail
-- on a re-run, and a migration that cannot be replayed is a migration nobody can
-- recover by hand.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "handles_person_user_key"
    ON "handles" ("userId")
 WHERE (kind = 'person' AND "userId" IS NOT NULL);
