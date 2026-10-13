-- The identity a session is ESTABLISHED with, snapshotted on the account.
--
-- `users.email` is the entry key at login and a mutable attribute; resolving a
-- live session by it means a per-request lookup re-derives "who this is" from a
-- value that can change after the session was established. `users."privyDid"`
-- holds the immutable Privy subject the account was bound to at
-- `POST /auth/verify`, and the auth middleware resolves the caller by it.
--
-- Nullable: accounts that predate this column and the dev bypass user have no
-- Privy identity. A Postgres unique index permits many NULLs, so those accounts
-- coexist without colliding; they re-authenticate once to be bound.
ALTER TABLE "users" ADD COLUMN "privyDid" TEXT;

CREATE UNIQUE INDEX "users_privyDid_key" ON "users"("privyDid");
