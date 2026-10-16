-- One person, one username — on every network.
--
-- WHY: handles landed PER NETWORK in 20261014090000_network_scope, which was the
-- right rule for a business name and the wrong one for a person's username. A
-- per-network namespace means somebody else can claim YOUR username on the other
-- network — impersonation in the exact surface where the name is the trust signal
-- (a payer reads `seti.live/u/<name>` and sends money to whoever it resolves to).
-- A person's username is therefore GLOBAL: one string, one account, both networks.
--
-- BUSINESS NAMES STAY PER NETWORK, deliberately, and this migration must not
-- change that. The owner's reason (2026-10-14): when KYB lands the real merchant
-- carries a VERIFIED MARK, so a squatter holding `kfc` is visually distinguishable
-- from the real one on the page a customer pays from. The namespace is not the
-- trust mechanism for a business — the verification badge is. Making business
-- handles global here would take a practice merchant's name away on live and
-- decide a question the owner has deliberately left open.
--
-- So this adds ONE partial unique index over the PERSON rows and leaves both
-- per-network indexes exactly as they are:
--
--   handles_handle_testnet_key  UNIQUE (handle) WHERE network = 'testnet'
--   handles_handle_mainnet_key  UNIQUE (handle) WHERE network = 'mainnet'
--   handles_person_handle_key   UNIQUE (handle) WHERE kind    = 'person'   <-- new
--
-- The three coexist and each still holds: every row must satisfy the per-network
-- index for its network, and a person row must additionally be unique across
-- networks. Nothing about business uniqueness is relaxed — a business name is
-- still unique within a network, and still collides with a person's name on that
-- same network (the "one string, one thing, per network" rule the checks pin).

-- ---------------------------------------------------------------------------
-- 1. Guard FIRST: a person string held by two DIFFERENT accounts cannot be made
--    global without picking a winner. Picking one silently would change someone's
--    identity and the person it happens to cannot see it, so this RAISES and names
--    the rows. It is a five-minute fix by hand, in the open.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  conflict record;
BEGIN
  FOR conflict IN
    SELECT h.handle,
           count(DISTINCT h."userId") AS accounts,
           string_agg(h.id || ' (' || h.network || ', user ' || coalesce(h."userId", '<none>') || ')', ', ' ORDER BY h.handle) AS rows
      FROM "handles" h
     WHERE h.kind = 'person'
     GROUP BY h.handle
    HAVING count(DISTINCT h."userId") > 1
  LOOP
    RAISE EXCEPTION
      'person handle "%" is held by % different accounts (%) — one person name cannot be shared, so the global index cannot be created until that is resolved by hand',
      conflict.handle, conflict.accounts, conflict.rows;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Collapse the SAME account's duplicates down to the one row that is a real
--    binding.
--
--    The case this exists for is the first-refusal hold: on the switch to Live,
--    `grantFirstRefusal` wrote a `reserved` row on the new network holding a string
--    the account already held on the old one. It carries NO signature, does NOT
--    verify and does NOT resolve — its only job was to stop another account taking
--    the string on that network, which the global index above now does by itself.
--    It is therefore removed rather than carried: a hold that protects nothing is
--    noise, and two rows for one person name is exactly what the index forbids.
--
--    Two SIGNED rows for one string under one account is a different matter: that
--    is a genuine ambiguity about which address the name pays, so it RAISES and
--    leaves the decision to a human.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  conflict record;
BEGIN
  FOR conflict IN
    SELECT h.handle, count(*) AS signed_rows,
           string_agg(h.address, ', ' ORDER BY h.id) AS addresses
      FROM "handles" h
     WHERE h.kind = 'person' AND h."claimSignature" IS NOT NULL
     GROUP BY h.handle
    HAVING count(*) > 1
  LOOP
    RAISE EXCEPTION
      'person handle "%" carries % SIGNED claims (%) — which address the name pays is a human decision, not a migration''s',
      conflict.handle, conflict.signed_rows, conflict.addresses;
  END LOOP;
END $$;

-- The unsigned person rows: a hold, or a half-written claim. Neither verifies and
-- neither resolves, so removing them frees nothing that was in use.
DELETE FROM "handles"
 WHERE kind = 'person'
   AND "claimSignature" IS NULL;

-- ---------------------------------------------------------------------------
-- 3. The rule itself. One person handle, globally.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "handles_person_handle_key"
  ON "handles" ("handle") WHERE ("kind" = 'person');

-- The claim path has always STORED the lowercased handle (`merchantHandle`,
-- mirroring the web's `merchant-link.ts`), and every existing row is lowercase —
-- so `CaseProbeOne` and `caseprobeone` have always been the same string. This
-- pins that as a schema fact rather than a property of one writer: with the column
-- constrained to its own lowercase form, the unique index above IS an index on the
-- normalised value, and a future writer that bypasses `claimHandle` (raw SQL, an
-- import, a migration) cannot create a second claim that differs from an existing
-- one only by case.
--
-- Also load-bearing for the global person rule: `@Ian`, `@IAN` and `@ian` are one
-- string on one network AND across networks, so a case variant is not a way to
-- get a second row for a name somebody else already holds.
--
-- (`name` is deliberately NOT constrained: it keeps the person's own typography —
-- "Case Probe One" — and uniqueness is on the handle, not on the display name.)
ALTER TABLE "handles"
  ADD CONSTRAINT "handles_handle_lowercase_check" CHECK ("handle" = lower("handle"));

-- The claim path and the resolver both look a person handle up WITHOUT a network
-- filter now, so the global index doubles as their index.
CREATE INDEX "handles_kind_handle_idx" ON "handles" ("kind", "handle");
