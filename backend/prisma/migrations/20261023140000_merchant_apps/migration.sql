-- Merchant apps and the webhook secret Seti issues for them (#156).
--
-- What this adds: one table, two nullable columns on the delivery log, and one index.
-- Nothing is dropped, nothing is renamed, and no existing row's meaning changes.
--
-- `merchant_apps` is a merchant's own app record: a name, an optional website and
-- logo, the URL its webhooks go to, and the payout ADDRESS the app was signed for.
-- The row is owned by an account (the Privy session) and bound to an address (an
-- EIP-712 signature by that address's key), and both facts are required.
--
-- `secretBox` is the webhook secret, sealed with AES-256-GCM under a key that lives
-- in the environment (`lib/secret-box.ts`). It is deliberately NOT a hash: signing an
-- HMAC needs the key itself, so a one-way digest would make every delivery
-- unsignable. A database dump without the environment key yields nothing.
--
-- EXPAND ONLY, per `docs/operations.md` §3:
--   * A brand-new table: the previous revision never mentions it, so it keeps serving
--     unchanged while `npx prisma migrate deploy` runs before the new container starts.
--   * Both delivery columns are addable and NULLABLE. `merchantAppId = NULL` means
--     "signed with the deployment-wide key", which is exactly what every existing row
--     did, and `lastAttemptAt = NULL` means "not recorded" for rows written before this
--     migration. The previous revision never selects either column.
--
-- Rollback: drop the two columns and the table. No charge, fee, settlement, address or
-- signature is touched, and no delivery is lost — the delivery log's rows and their
-- exactly-once key are unchanged.

CREATE TABLE "merchant_apps" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "webhookUrl" TEXT NOT NULL,
    "logoUrl" TEXT,
    "payoutAddress" TEXT NOT NULL,
    "bindingSignature" TEXT NOT NULL,
    "bindingIssuedAtRaw" TEXT NOT NULL,
    "bindingNonce" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'testnet',
    "secretBox" TEXT NOT NULL,
    "secretHint" TEXT NOT NULL,
    "secretIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "secretRotations" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "merchantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_apps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_apps_publicId_key" ON "merchant_apps"("publicId");
CREATE UNIQUE INDEX "merchant_apps_ownerUserId_name_key" ON "merchant_apps"("ownerUserId", "name");
CREATE INDEX "merchant_apps_payoutAddress_network_idx" ON "merchant_apps"("payoutAddress", "network");

ALTER TABLE "merchant_apps"
  ADD CONSTRAINT "merchant_apps_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "merchant_apps"
  ADD CONSTRAINT "merchant_apps_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The delivery log learns two things and keeps everything else.
--
-- `merchantAppId` is which app's secret signed a delivery, so a merchant's log is
-- scoped by it. NULL is the deployment-wide key, i.e. every row written before this
-- migration. ON DELETE SET NULL rather than CASCADE: deleting an app must not delete
-- the record that the merchant's endpoint was tried, because that log is the answer to
-- "did we ever notify you?".
--
-- `lastAttemptAt` is the delivery log's own column because `updatedAt` moves when a
-- replay resets a row; it cannot answer "when did we last POST?".
ALTER TABLE "charge_webhook_deliveries" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "charge_webhook_deliveries" ADD COLUMN "merchantAppId" TEXT;

CREATE INDEX "charge_webhook_deliveries_merchantAppId_createdAt_idx"
  ON "charge_webhook_deliveries"("merchantAppId", "createdAt");

ALTER TABLE "charge_webhook_deliveries"
  ADD CONSTRAINT "charge_webhook_deliveries_merchantAppId_fkey"
  FOREIGN KEY ("merchantAppId") REFERENCES "merchant_apps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
