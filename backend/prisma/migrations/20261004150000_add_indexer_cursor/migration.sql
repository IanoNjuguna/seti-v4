-- Durable indexer cursor.
--
-- The cursor previously lived in process memory, so a restart reset it to 0
-- and re-scanned a lookback window, and two replicas each advanced their own
-- independent cursor. Persisting it fixes both. The lock columns let replicas
-- coordinate so only one scans at a time.

CREATE TABLE "indexer_cursors" (
    "chain" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL DEFAULT 0,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_cursors_pkey" PRIMARY KEY ("chain")
);
