-- Sign-in must not depend on what the wallets table already holds.
--
-- `wallets` was unique over (userId, asset, status). That counts the DEPRECATED
-- row: registering a new address deprecates the current active row, so it
-- collided with the deprecated row an EARLIER registration had left behind, and
-- the request failed with a P2002 that named `wallet.create()` rather than the
-- collision. The dev account held exactly that shape (one active AND one
-- deprecated row for the same asset), so every dev login failed.
--
-- The real invariant is "at most one ACTIVE row per (userId, asset)"; deprecated
-- rows are history and may be unbounded (login deprecates the row it replaces,
-- and the money path deliberately resolves a transfer against a deprecated row
-- too). A partial unique index expresses exactly that.
DROP INDEX "wallets_userId_asset_status_key";

CREATE UNIQUE INDEX "wallets_userId_asset_active_key"
  ON "wallets" ("userId", "asset")
  WHERE "status" = 'active';
