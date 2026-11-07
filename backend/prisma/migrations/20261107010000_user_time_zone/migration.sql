-- The zone an account's days are counted in (#394).
--
-- Every timestamp in this schema is stored in UTC, which is right: an instant is an instant. A DAY
-- is not an instant. "Saturday" is a business fact — the day a merchant traded, the day an
-- accountant will read on a statement — so it has to be computed against a named zone rather than
-- against UTC or against whatever the reader's device happens to be set to.
--
-- Stored on the account for that reason: a zone taken from the client at render time would let the
-- same payment fall on different days depending on where the app was opened, and would make the
-- analytics endpoint's answer depend on its caller.
--
-- `Africa/Nairobi` is the default because this product launches in Kenya: an account that has never
-- reported its own zone still buckets its days somewhere real rather than at UTC+0 in a country
-- that has never used it. The value is written from the browser's own `Intl` answer on first load.
ALTER TABLE "users"
  ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Africa/Nairobi';
