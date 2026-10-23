-- Merchant verification: the stored attribute the pay page's verified tier reads (#154).
--
-- Anyone can make a charge naming any address, so the pay page owes the payer a
-- distinction it can act on: a merchant a person at Seti has reviewed, or a stranger's
-- request. That distinction is a STORED FACT about the merchant, never a deduction from
-- volume, age, category or anything else implicit. These two columns are it.
--
--   * `verifiedAt` — when a person approved the merchant. NULL means nobody has, which
--     is every merchant in this database today.
--   * `verifiedEvidence` — what earned it: the case, reference or document the reviewer
--     worked from. Never rendered. A badge whose reason nobody recorded is a badge the
--     next reviewer cannot defend, and the issue that asked for this tier asked for the
--     evidence in the same breath.
--
-- EXPAND ONLY, per `docs/operations.md` §3: both columns are additive and nullable, so
-- the previous revision keeps running unchanged during a rolling deploy (it never
-- selects them) and `npx prisma migrate deploy` can run before the new revision starts
-- serving. Every existing row reads `verifiedAt = NULL`, which is exactly the unverified
-- tier the page draws today, so this migration changes no merchant's appearance on its
-- own. Rolling it back is dropping two columns nothing else references.
--
-- Nothing here touches a charge, a fee, a settlement, an address or a signature. The
-- difference between the two tiers is display only, and the schema change is confined to
-- the merchant record that decides which display is drawn.
--
-- THE RULE THE CHECK ENFORCES: verification is not a bare boolean. A merchant is verified
-- only WITH the evidence that earned it, so the two columns are written and cleared
-- together and a stray UPDATE cannot verify somebody and forget why. Prisma cannot
-- express a CHECK, so it lives here, next to the columns it protects.

ALTER TABLE "merchants" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "merchants" ADD COLUMN "verifiedEvidence" TEXT;

ALTER TABLE "merchants" ADD CONSTRAINT "merchants_verified_evidence_chk" CHECK (
  ("verifiedAt" IS NULL AND "verifiedEvidence" IS NULL)
  OR (
    "verifiedAt" IS NOT NULL
    AND "verifiedEvidence" IS NOT NULL
    AND length(btrim("verifiedEvidence")) > 0
  )
);
