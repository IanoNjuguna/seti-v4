-- The customer's Polymarket wallet address, for a READ-ONLY positions card (#599).
--
-- Nullable on purpose, and NULL is a product state rather than a gap. It means "this
-- account has not linked a Polymarket wallet", which the card renders as the link
-- prompt. It never means "no positions": that is a linked wallet whose position list
-- came back empty, and a surface that collapsed the two would tell a customer they hold
-- nothing when in fact they never told us where to look.
--
-- Stored rather than passed per request because it is a standing fact about the
-- account. Nothing in this repository signs for this address, sends a Polygon
-- transaction, or holds a key that could: the column is a claim about an external
-- account, read through Polymarket's public Data API.
--
-- Not indexed and not unique. Two customers of the same household may legitimately
-- watch the same wallet, and no query here looks a customer up BY this value, so an
-- index would only cost writes.
ALTER TABLE "users"
  ADD COLUMN "polymarketAddress" TEXT;
