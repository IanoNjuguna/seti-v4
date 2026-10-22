-- Who invited whom: one row per attributed invitee, and the fifth table that
-- answers a question about an ACCOUNT rather than about money.
--
-- Written at `POST /auth/verify` when an account is ESTABLISHED, never when a
-- link is opened. The row is the RECORD of an arrival, so the two things it must
-- not be are: writable more than once per person, and re-derivable from a handle.
--
-- `invitedUserId` is UNIQUE, and that index IS the "one attribution per invitee"
-- rule. A second invite link, a replayed cookie and a second sign-up on one
-- account all collide here instead of writing a second row, and the collision is
-- expected rather than exceptional (the service reads it as `duplicate` and logs
-- nothing). A read-then-write in the service would have let two concurrent
-- sign-ups both see "no row yet"; the index cannot.
--
-- `referrerHandle` is a SNAPSHOT of the name the link carried, not a lookup. The
-- cookie names the referrer by ID precisely so this row is never written by
-- re-resolving a handle: a handle can be parked, released and reassigned to a
-- brand, and re-resolving it later would credit whoever holds the string then.
-- Nothing routes money or trust through this column; it is the words the invitee
-- saw when they arrived.
--
-- Both foreign keys CASCADE. Attribution is the only thing this table holds, so
-- deleting an account takes its attribution with it in both directions, and a
-- row can never outlive the accounts it joins.
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "referrerHandle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- One attribution per person, by the database rather than by a service that
-- checks first.
CREATE UNIQUE INDEX "referrals_invitedUserId_key" ON "referrals"("invitedUserId");

-- The invite screen's one read: this account's invitees, newest first.
CREATE INDEX "referrals_referrerId_createdAt_idx" ON "referrals"("referrerId", "createdAt");

ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey"
  FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitedUserId_fkey"
  FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
