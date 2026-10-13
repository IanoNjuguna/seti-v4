-- Persist the merchant fee and FX provenance on each payment.
--
-- Previously the fee existed only in the /preview response: it was shown to
-- the user but never written to the transaction row, so there was no record of
-- what a merchant was actually charged. These columns make the payout path
-- self-describing and auditable.

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "feeAmount" DECIMAL(24,8),
ADD COLUMN     "feeUncappedAmount" DECIMAL(24,8),
ADD COLUMN     "feeCapped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "merchantNetAmount" DECIMAL(24,8),
ADD COLUMN     "fxRate" DECIMAL(24,8),
ADD COLUMN     "fxRateSource" TEXT,
ADD COLUMN     "fxRateAsOf" TIMESTAMP(3);
