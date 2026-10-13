-- Brand review: the state a claim that matches a HELD BRAND is parked in.
--
-- A normal handle has `reviewStatus = NULL`. A claim whose name reduces to a
-- known real-world brand is stored with `reviewStatus = 'pending'` and the brand
-- it matched in `reviewBrand`. Such a row RESERVES its string (the unique
-- `handle` index is untouched) but is NOT live: every resolver filters it out, so
-- a payer who resolves it gets exactly what they get for a name that does not
-- exist. It never reads as verified.
--
-- There is no `verified` boolean here, on purpose — verification is still
-- recomputed from the stored signature. `reviewStatus` is the ONE stored state,
-- and it says WHO has looked (nobody yet), not whether the binding is genuine.
--
-- The two columns are additive and nullable, so every existing row keeps
-- `reviewStatus = NULL` — i.e. every existing handle stays exactly as live as it
-- was. The six seeded merchants are untouched.
ALTER TABLE "handles" ADD COLUMN "reviewStatus" TEXT;
ALTER TABLE "handles" ADD COLUMN "reviewBrand" TEXT;

-- The parked-claims read (`reviewStatus = 'pending'`) is the reviewer's queue.
CREATE INDEX "handles_reviewStatus_idx" ON "handles"("reviewStatus");
