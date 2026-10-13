-- Where a claim goes when a PROVED brand takes its name (reassignment on proof).
--
-- A brand proving ownership must be able to take a name whatever state it is in,
-- including one already claimed by someone else. The handle string is unique, so
-- the previous claimer's row must be removed for the new row to exist; this table
-- preserves it — signature and all — with the reason it was released, so a
-- reassignment is never a silent overwrite and the previous holder's record
-- survives.
--
-- No foreign keys on purpose: this is a historical record that has to outlive any
-- account or profile deletion, so it keeps the ids as plain strings.
CREATE TABLE "handle_releases" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "claimSignature" TEXT,
    "claimIssuedAt" TEXT,
    "claimNonce" TEXT,
    "userId" TEXT,
    "merchantId" TEXT,
    "reason" TEXT NOT NULL,
    "reassignedTo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handle_releases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "handle_releases_handle_idx" ON "handle_releases"("handle");
