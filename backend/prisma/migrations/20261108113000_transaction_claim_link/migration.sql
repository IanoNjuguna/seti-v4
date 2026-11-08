-- The durable link between a payment and the ask it settles (#447).
--
-- After `recordSend` writes its row, the settlement of an ask is attempted. If the process dies in
-- between, the money has moved and the ask would sit `open` for ever with nothing to retry it. This
-- column is what a reconcile pass reads: completed rows that name an ask, matched against open asks.
--
-- It is a LINK, never an authority: the payment is verified against its receipt, and the ask against
-- the ledger row's own figure. Nothing here decides who was paid.

ALTER TABLE "transactions" ADD COLUMN "claimPublicId" TEXT;

CREATE INDEX "transactions_claimPublicId_status_idx" ON "transactions"("claimPublicId", "status");
