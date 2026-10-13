-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('active', 'frozen', 'deprecated');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('none', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "KycTier" AS ENUM ('tier_0', 'tier_1', 'tier_2');

-- DropIndex
DROP INDEX "wallets_userId_asset_key";

-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "bridgeRecipientId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dailyVolume" DECIMAL(24,8) NOT NULL DEFAULT 0,
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'none',
ADD COLUMN     "kycTier" "KycTier" NOT NULL DEFAULT 'tier_0',
ADD COLUMN     "monthlyVolume" DECIMAL(24,8) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "wallets" DROP COLUMN "encryptedKey",
ADD COLUMN     "keyId" TEXT,
ADD COLUMN     "status" "WalletStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "wallets_userId_status_idx" ON "wallets"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_asset_status_key" ON "wallets"("userId", "asset", "status");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

