-- The handle namespace: ONE table where a person's username and a business's name
-- are the same kind of signed handle.
--
-- Why a new table: a handle belongs to an ADDRESS, and a merchant profile is a
-- MODE on top of it. The claim therefore moves OFF the Merchant row (whose
-- `handle`/`nameKey`/`claimSignature`… columns only ever described a business)
-- and ONTO `handles`, where a person and a business compete for the same string.
-- Without this, a person could claim `kfc` beside the business that holds it:
-- two tables, two uniqueness rules, one customer paying the wrong party.
--
-- This migration is a MOVE, not a destroy. Every existing merchant handle is
-- copied verbatim into the namespace FIRST, then the now-duplicated columns are
-- dropped from `merchants`. The identity a customer sees for each merchant —
-- its name, its address, and whether its binding verifies — is unchanged: the
-- signature, its issued-at and its nonce are carried across byte-for-byte, so
-- re-verification recomputes to the same address it did before.
--
-- `purpose` is left NULL for the backfilled rows on purpose. Those signatures
-- were made BEFORE the purpose field existed (the message was
-- `MerchantNameClaim { name, address, issuedAt, nonce }`), so `handleClaimVerifies`
-- re-derives them against that legacy shape. Rewriting them with a purpose would
-- make every one of them stop verifying, and there is no key to re-sign with.
-- Every handle claimed through the API stores a purpose; NULL is only ever a row
-- that predates the field.

-- CreateTable
CREATE TABLE "handles" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'business',
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "address" TEXT NOT NULL,
    "claimSignature" TEXT,
    "claimIssuedAt" TEXT,
    "claimNonce" TEXT,
    "claimedAt" TIMESTAMP(3),
    "userId" TEXT,
    "merchantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "handles_handle_key" ON "handles"("handle");
CREATE UNIQUE INDEX "handles_merchantId_key" ON "handles"("merchantId");
CREATE INDEX "handles_userId_idx" ON "handles"("userId");
CREATE INDEX "handles_name_idx" ON "handles"("name");

-- AddForeignKey
ALTER TABLE "handles"
    ADD CONSTRAINT "handles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "handles"
    ADD CONSTRAINT "handles_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing merchant handle enters the namespace, verbatim.
--
-- A merchant with no handle (a row that predates the column) is skipped: it is
-- still reachable by id, and it reserves no string in the namespace because it
-- never held one. An address is required by the shape; a merchant with a handle
-- but no payout address keeps its handle with an empty address so the string it
-- already holds stays reserved rather than becoming claimable by someone else.
INSERT INTO "handles" (
    "id", "handle", "kind", "name", "purpose", "address",
    "claimSignature", "claimIssuedAt", "claimNonce", "claimedAt",
    "userId", "merchantId", "createdAt", "updatedAt"
)
SELECT
    'handle_' || m."id",
    m."handle",
    'business',
    m."name",
    NULL,
    COALESCE(m."payoutAddress", ''),
    m."claimSignature",
    m."claimIssuedAt",
    m."claimNonce",
    m."claimedAt",
    m."claimedByUserId",
    m."id",
    m."createdAt",
    NOW()
FROM "merchants" m
WHERE m."handle" IS NOT NULL AND m."handle" <> '';

-- Fail loudly if the move would have produced an ambiguous namespace. The unique
-- index above already refuses a collision, but naming it makes the fix obvious
-- rather than an opaque Postgres error mid-migration.
DO $$
DECLARE
  collisions integer;
BEGIN
  SELECT count(*) INTO collisions
  FROM (
    SELECT "handle" FROM "handles" GROUP BY "handle" HAVING count(*) > 1
  ) d;

  IF collisions > 0 THEN
    RAISE EXCEPTION
      'handle namespace collision after backfill (% handles shared). Resolve by hand before applying this migration.',
      collisions;
  END IF;
END $$;

-- Drop the claim columns from the Merchant row. Their values live in `handles`
-- now; leaving them would be a second copy of the signed binding, and a second
-- unique `handle` column beside the namespace's own is exactly the ambiguity
-- this feature exists to remove.
ALTER TABLE "merchants"
    DROP COLUMN "nameKey",
    DROP COLUMN "handle",
    DROP COLUMN "claimSignature",
    DROP COLUMN "claimIssuedAt",
    DROP COLUMN "claimNonce",
    DROP COLUMN "claimedAt",
    DROP COLUMN "claimedByUserId";
