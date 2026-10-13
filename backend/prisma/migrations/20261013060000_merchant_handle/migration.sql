-- The merchant handle: a stored, unique identity for `seti.live/m/<handle>`.
--
-- Additive only. No table is dropped or rewritten; the one existing column this
-- touches (`name`) is only read, to derive the handle that every row gets.
--
-- Why a stored column at all: the handle is the name with everything outside
-- [a-z0-9._-] removed, and that rule DROPS characters — `Mama's Kitchen & Grill`
-- and `Mamas Kitchen Grill` are two distinct NAMES (their `nameKey` keeps the
-- space, the apostrophe and the ampersand) that both reduce to
-- `mamaskitchengrill`. Uniqueness therefore cannot be derived from the name; it
-- has to be stored and enforced. `handle` is computed by `merchantHandle` in
-- `backend/src/lib/merchant-name.ts`, mirrored exactly by the web in
-- `web/lib/merchant-link.ts`.

-- AlterTable
ALTER TABLE "merchants" ADD COLUMN "handle" TEXT;

-- Fail loudly on a pre-existing collision.
--
-- The unique index below cannot be created if two existing rows derive the same
-- handle, and the migration would abort with Postgres's own opaque error. Name
-- the colliding handles instead: the fix is a human decision (which merchant
-- keeps the link), and silently renaming one would move a link a merchant may
-- already have printed.
DO $$
DECLARE
  colliding text;
BEGIN
  SELECT string_agg(dup, ', ' ORDER BY dup) INTO colliding
  FROM (
    SELECT lower(regexp_replace(btrim("name"), '[^a-zA-Z0-9._-]', '', 'g')) AS dup
    FROM "merchants"
    GROUP BY 1
    HAVING count(*) > 1
  ) d;

  IF colliding IS NOT NULL THEN
    RAISE EXCEPTION
      'merchant handle collision on existing rows: %. Resolve by hand before applying this migration.',
      colliding;
  END IF;
END $$;

-- Backfill. Expressed in SQL exactly as `merchantHandle` does it in JS:
-- trim, drop everything outside [a-zA-Z0-9._-], lowercase.
UPDATE "merchants"
SET "handle" = lower(regexp_replace(btrim("name"), '[^a-zA-Z0-9._-]', '', 'g'));

-- A name with no usable character (none today) would derive an empty handle — a
-- link to `seti.live/m/` that names nobody. Leave it NULL (not reachable by
-- handle) rather than store ''.
UPDATE "merchants" SET "handle" = NULL WHERE "handle" = '';

-- CreateIndex
CREATE UNIQUE INDEX "merchants_handle_key" ON "merchants"("handle");
