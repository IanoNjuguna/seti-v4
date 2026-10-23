-- The fee leg, as a fact of its own.
--
-- A charge used to be decided by ONE comparison: did the principal arrive within
-- 1%. The 2% rides in the same atomic batch, to `SETI_TREASURY_ADDRESS`, and was
-- never checked on its own — so a transfer carrying the principal and NOT the fee
-- read exactly like a transfer carrying both, and a fee Seti claims to collect
-- could be missing with nothing anywhere saying so.
--
-- These two columns are that fact, written on the SAME conditional UPDATE that
-- moves the status (so they can never describe a different transfer), and never
-- derived from it. Both are NULLABLE on purpose:
--
--   * NULL means "not decided": a pending charge, a cancel, or a row that predates
--     this migration. A backfill would have to invent a verdict from a receipt it
--     does not have, which is the class of guess this repository refuses.
--   * FALSE never means unpaid. The money the payer sent to the recipient is real,
--     so `status` stays `paid` and this says the fee did not arrive, with
--     `feeUncollectedReason` naming which of the six reasons applies.
--
-- Additive and nullable: dropping both columns restores the previous behaviour
-- exactly, and nothing about settlement, webhooks or the signature depends on them.
-- The on-chain receipt remains the authority; this is the record of having read it.

ALTER TABLE "charges" ADD COLUMN "feeCollected" BOOLEAN;
ALTER TABLE "charges" ADD COLUMN "feeUncollectedReason" TEXT;
