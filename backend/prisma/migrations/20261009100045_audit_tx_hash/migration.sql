-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "txHash" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_txHash_idx" ON "audit_logs"("txHash");
