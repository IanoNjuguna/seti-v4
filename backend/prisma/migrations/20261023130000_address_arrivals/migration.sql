-- Money that arrived at a merchant's address with no charge behind it.
--
-- Seti is non-custodial, so a payer can send straight to the address a merchant
-- published and never open our page. The transfer is real and the merchant has the
-- money, but no charge was satisfied, no fee was computed, and until this table the
-- event existed nowhere: the charge (if one existed at all) stayed `pending`
-- forever and the merchant was told nothing.
--
-- Every column here is an OBSERVATION: the sender, the token, the amount, the
-- transaction, the block, the address that received it. There is deliberately no
-- charge reference of any kind. An arrival is money with NO charge behind it, so
-- the schema has nowhere to silently attach one; a merchant (or a signed claim)
-- deciding an arrival was charge 123 is a later, separate feature.
--
-- Additive and inert: nothing reads this table to decide a charge's status, so
-- dropping it restores the previous behaviour exactly. The charge path's own rules
-- (`services/charge.ts`) are untouched, and a charge is still `paid` only against a
-- receipt the classifier accepted.

CREATE TABLE "address_arrivals" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'testnet',
    "asset" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "address_arrivals_pkey" PRIMARY KEY ("id")
);

-- ONE row per transfer per receiving address: a re-scanned window, a restart or a
-- second indexer replica must not report the same payment twice.
CREATE UNIQUE INDEX "address_arrivals_txHash_recipient_asset_network_key"
    ON "address_arrivals"("txHash", "recipient", "asset", "network");

-- The merchant's read: arrivals at their own addresses, newest first.
CREATE INDEX "address_arrivals_network_recipient_createdAt_idx"
    ON "address_arrivals"("network", "recipient", "createdAt");
