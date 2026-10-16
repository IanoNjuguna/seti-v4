-- Network scoping: one account practises on testnet and goes live on mainnet.
--
-- Adds a `network` dimension to `users`, `wallets`, `handles` and
-- `transactions`, and makes EVERY uniqueness rule that could couple the two
-- networks PER NETWORK instead of global.
--
-- The load-bearing rule this migration creates: a name claimed while PRACTISING
-- must not block the same name being claimed on LIVE. A global unique on
-- `handles.handle` would do exactly that — one practice squatter and the live
-- name is gone. The same argument applies to `wallets.address` (the same key on
-- two chains is two rows) and to the one-active-wallet rule (an account holds a
-- practice wallet AND a live wallet at once).
--
-- Partial unique indexes, ONE PER NETWORK, are used where Prisma cannot express
-- the predicate: Prisma's schema language has no `WHERE`, and its `@unique` has
-- no `INCLUDE`/filter, so the per-network `WHERE network = '...'` (and, for
-- wallets, `WHERE status = 'active'`) live here — mirroring the existing
-- `wallets_userId_asset_active_key` partial index this migration replaces.

-- ---------------------------------------------------------------------------
-- The dimension itself. NOT NULL with a default so every existing row is
-- backfilled to the practice network in the same statement that adds the column.
-- ---------------------------------------------------------------------------
ALTER TABLE "users"        ADD COLUMN "network" TEXT NOT NULL DEFAULT 'testnet';
ALTER TABLE "wallets"      ADD COLUMN "network" TEXT NOT NULL DEFAULT 'testnet';
ALTER TABLE "handles"      ADD COLUMN "network" TEXT NOT NULL DEFAULT 'testnet';
ALTER TABLE "transactions" ADD COLUMN "network" TEXT NOT NULL DEFAULT 'testnet';

-- ---------------------------------------------------------------------------
-- Wallets: address unique PER NETWORK, one ACTIVE row per (userId, asset,
-- network). The old global `wallets_address_key` and the old
-- `wallets_userId_asset_active_key` are replaced by two partial indexes each.
-- ---------------------------------------------------------------------------
DROP INDEX "wallets_address_key";
DROP INDEX "wallets_userId_asset_active_key";

CREATE UNIQUE INDEX "wallets_address_testnet_key"
  ON "wallets" ("address") WHERE "network" = 'testnet';
CREATE UNIQUE INDEX "wallets_address_mainnet_key"
  ON "wallets" ("address") WHERE "network" = 'mainnet';

CREATE UNIQUE INDEX "wallets_userId_asset_testnet_active_key"
  ON "wallets" ("userId", "asset") WHERE "network" = 'testnet' AND "status" = 'active';
CREATE UNIQUE INDEX "wallets_userId_asset_mainnet_active_key"
  ON "wallets" ("userId", "asset") WHERE "network" = 'mainnet' AND "status" = 'active';

CREATE INDEX "wallets_network_userId_status_idx" ON "wallets" ("network", "userId", "status");

-- ---------------------------------------------------------------------------
-- Handles: the namespace is PER NETWORK. `handles.handle` stops being globally
-- unique and becomes unique within each network.
-- ---------------------------------------------------------------------------
DROP INDEX "handles_handle_key";

CREATE UNIQUE INDEX "handles_handle_testnet_key"
  ON "handles" ("handle") WHERE "network" = 'testnet';
CREATE UNIQUE INDEX "handles_handle_mainnet_key"
  ON "handles" ("handle") WHERE "network" = 'mainnet';

-- Prisma cannot declare the partial indexes above, so it needs a plain index on
-- the column to keep its `findFirst` lookups indexed.
CREATE INDEX "handles_handle_idx" ON "handles" ("handle");
CREATE INDEX "handles_network_handle_idx" ON "handles" ("network", "handle");

-- ---------------------------------------------------------------------------
-- Transactions: one row per user per transfer PER NETWORK.
-- ---------------------------------------------------------------------------
DROP INDEX "transactions_txHash_userId_key";

CREATE UNIQUE INDEX "transactions_txHash_userId_network_key"
  ON "transactions" ("txHash", "userId", "network");
CREATE INDEX "transactions_network_userId_createdAt_idx"
  ON "transactions" ("network", "userId", "createdAt");
