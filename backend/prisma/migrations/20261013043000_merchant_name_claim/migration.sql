-- Merchant name claims: a business name is claimed by signing EIP-712 typed
-- data with the key that controls the merchant's payout address.
--
-- Additive only. No table is dropped or rewritten, and no existing row loses a
-- value: the six columns below start NULL on every current row, and the only
-- backfill writes a normalised form of the name that is already there.

-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "nameKey" TEXT,
ADD COLUMN     "claimSignature" TEXT,
ADD COLUMN     "claimIssuedAt" TEXT,
ADD COLUMN     "claimNonce" TEXT,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedByUserId" TEXT;

-- Backfill the normalised name key.
--
-- Only the FIRST row per normalised name gets a key: two rows that already share
-- a name would otherwise make the unique index below fail, aborting the whole
-- migration on an unrelated data problem. A later duplicate keeps a NULL key —
-- it is still reachable by id, and the claim guard also matches on the name.
UPDATE "merchants" m
SET "nameKey" = lower(btrim(m."name"))
WHERE m."id" IN (
  SELECT t."id" FROM (
    SELECT "id",
           row_number() OVER (PARTITION BY lower(btrim("name")) ORDER BY "createdAt", "id") AS rn
    FROM "merchants"
  ) t
  WHERE t.rn = 1
);

-- CreateIndex
CREATE UNIQUE INDEX "merchants_nameKey_key" ON "merchants"("nameKey");
