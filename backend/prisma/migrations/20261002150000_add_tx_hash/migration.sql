-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "blockNumber" BIGINT,
ADD COLUMN     "txHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_txHash_key" ON "transactions"("txHash");

-- CreateIndex
CREATE INDEX "transactions_txHash_idx" ON "transactions"("txHash");

