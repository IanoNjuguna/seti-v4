-- The request's field names point the WRONG WAY (#452).
--
-- #450 named the column `payeeAddress` and documented it as "the payee", then refused creation when
-- that handle belonged to the creator. Both cannot be true: an ask is "I ask you for money and it comes
-- to me", so the handle a link pays out to is the REQUESTER's own, and refusing it rejected exactly the
-- normal case. #98 writes the same thing as `/app/pay?to=<handle>`, where `to` is the destination.
--
-- The names are corrected here rather than in #450's file because #450 is merged and its migration is
-- already applied. The table has no rows anywhere (nothing calls the service yet), which is why a rename
-- is enough and no data step is needed.

ALTER TABLE "payment_requests" RENAME COLUMN "payeeHandleId" TO "destinationHandleId";
ALTER TABLE "payment_requests" RENAME COLUMN "payeeHandleText" TO "destinationHandleText";
ALTER TABLE "payment_requests" RENAME COLUMN "payeeAddress" TO "destinationAddress";

ALTER TABLE "payment_requests" RENAME CONSTRAINT "payment_requests_payeeHandleId_fkey"
  TO "payment_requests_destinationHandleId_fkey";

ALTER INDEX "payment_requests_status_payeeAddress_idx"
  RENAME TO "payment_requests_status_destinationAddress_idx";
