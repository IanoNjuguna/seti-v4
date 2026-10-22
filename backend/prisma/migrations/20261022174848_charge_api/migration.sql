-- The charge API (#131): where a charge is KEPT between the request that created it
-- and the transfer that settles it, plus one row per webhook delivery.
--
-- Additive only. Two new tables and one new enum, no column on any existing table:
-- a charge has NO account (the recipient's signature is the credential), so nothing
-- here references `users` or `wallets`, and nothing an existing row does can break.
-- Rollback is `DROP TABLE charge_webhook_deliveries, charges CASCADE` + `DROP TYPE
-- "ChargeStatus"`, or simply revoking the routes — charges are inert without them.
--
-- Two constraints are the load-bearing part of the feature, and both are UNIQUE
-- indexes rather than code:
--
--   charges_recipient_publicId_key
--     One charge per id PER RECIPIENT. The id is chosen and SIGNED by the payee, so
--     the same string for two payees is two charges (a link names one payee), and a
--     second create for the same payee is a 409 rather than a silent overwrite of a
--     link someone may already hold a screenshot of.
--
--   charge_webhook_deliveries_chargeId_status_key
--     One delivery per status change. "(charge, status)" is what makes a replayed
--     transfer, a second indexer replica or a retried request unable to double-count
--     a webhook — the second INSERT collides instead of creating a second row.
--
-- `charges_recipient_idempotencyKey_key` is unique too, and Postgres treats NULLs as
-- distinct, so a charge created without an `Idempotency-Key` header does not collide
-- with any other. The key is stored as a SHA-256 (never raw), and the whole response
-- body is kept in `responseBody` so a replay returns the bytes it returned the first
-- time rather than re-deriving them.
--
-- NOTE ON A DELIBERATE OMISSION: this migration does NOT contain the
-- `DROP INDEX "handles_kind_handle_idx"` that `prisma migrate dev` wanted to write.
-- That index is created by 20261014140000_global_person_handles and is not declared
-- in schema.prisma — pre-existing drift between the hand-written migration and the
-- Prisma model. Dropping it here would delete an index another change added on
-- purpose, for a reason this PR knows nothing about. It stays; the drift is for its
-- owner to resolve.

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('pending', 'paid', 'underpaid', 'overpaid', 'expired');

-- CreateTable
CREATE TABLE "charges" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "expiresAtRaw" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "nonce" TEXT NOT NULL,
    "scope" TEXT,
    "signature" TEXT NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'pending',
    "network" TEXT NOT NULL DEFAULT 'testnet',
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT,
    "received" TEXT NOT NULL DEFAULT '0.000000',
    "settledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "webhookUrl" TEXT,
    "idempotencyKey" TEXT,
    "idempotencyAt" TIMESTAMP(3),
    "responseBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_webhook_deliveries" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" "ChargeStatus" NOT NULL,
    "url" TEXT NOT NULL,
    -- `pending` (awaiting a retry), `sending` (claimed by one process), `delivered`,
    -- `failed` (no signing secret, or attempts exhausted). Text rather than an enum so
    -- an operational state can be added without a migration.
    "state" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastStatusCode" INTEGER,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "charges_publicId_idx" ON "charges"("publicId");

-- CreateIndex
CREATE INDEX "charges_status_recipient_asset_idx" ON "charges"("status", "recipient", "asset");

-- CreateIndex
CREATE INDEX "charges_status_expiresAt_idx" ON "charges"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "charges_recipient_createdAt_idx" ON "charges"("recipient", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "charges_recipient_publicId_key" ON "charges"("recipient", "publicId");

-- CreateIndex
CREATE UNIQUE INDEX "charges_recipient_idempotencyKey_key" ON "charges"("recipient", "idempotencyKey");

-- CreateIndex
CREATE INDEX "charge_webhook_deliveries_state_nextAttemptAt_idx" ON "charge_webhook_deliveries"("state", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "charge_webhook_deliveries_chargeId_status_key" ON "charge_webhook_deliveries"("chargeId", "status");

-- AddForeignKey
ALTER TABLE "charge_webhook_deliveries" ADD CONSTRAINT "charge_webhook_deliveries_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
