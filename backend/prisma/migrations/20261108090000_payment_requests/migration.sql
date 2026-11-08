-- Payment requests (#98, #447 step 3).
--
-- A request is the UNSIGNED half of the claim idea: an ask in the customer's currency whose amount
-- the payer may change, settled by the ordinary send it points at. The signed, token-denominated
-- half already exists as "charges" and is not touched here.
--
-- Two constraints carry the product rules:
--
--  * "settledTransactionId" is UNIQUE, so ONE payment cannot satisfy two asks. The second claim on
--    the same transaction is refused by the database rather than by a read-then-write in code that
--    two concurrent callers can both pass.
--  * "payeeHandleId" RESTRICTs deletion, so a handle with a live ask on it cannot be deleted out
--    from under a link that is already in somebody's chat.

CREATE TYPE "PaymentRequestStatus" AS ENUM ('open', 'settled', 'cancelled');

CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "payeeHandleId" TEXT NOT NULL,
    "payeeHandleText" TEXT NOT NULL,
    "payeeAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "memo" TEXT NOT NULL DEFAULT '',
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'open',
    "settledTransactionId" TEXT,
    "settledTxHash" TEXT,
    "settledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_requests_publicId_key" ON "payment_requests"("publicId");
CREATE UNIQUE INDEX "payment_requests_settledTransactionId_key" ON "payment_requests"("settledTransactionId");
CREATE INDEX "payment_requests_creatorId_createdAt_idx" ON "payment_requests"("creatorId", "createdAt");
CREATE INDEX "payment_requests_status_payeeAddress_idx" ON "payment_requests"("status", "payeeAddress");

ALTER TABLE "payment_requests"
  ADD CONSTRAINT "payment_requests_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_requests"
  ADD CONSTRAINT "payment_requests_payeeHandleId_fkey"
  FOREIGN KEY ("payeeHandleId") REFERENCES "handles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
