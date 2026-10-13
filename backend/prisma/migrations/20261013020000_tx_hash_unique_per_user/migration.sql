-- One ledger row per user per on-chain transfer.
--
-- `txHash` was globally unique, so a transfer between two Seti accounts could only
-- ever produce ONE row — the sender's. The recipient's side had nowhere to go,
-- which is why an account that had received money showed an empty Activity.
-- Scoping uniqueness to (txHash, userId) lets both sides exist while still refusing
-- to record the same transfer twice for one account.
DROP INDEX "transactions_txHash_key";

-- The plain index on txHash is now redundant: the composite unique index below
-- leads with the same column, so lookups by hash are still covered.
DROP INDEX "transactions_txHash_idx";

CREATE UNIQUE INDEX "transactions_txHash_userId_key" ON "transactions"("txHash", "userId");
