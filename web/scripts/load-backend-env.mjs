/**
 * Gives a web-side suite the backend's `DATABASE_URL`.
 *
 * `check-pay-tiers` reads the backend services directly (that is what makes its #197
 * section a proof against Postgres rather than a second stub), so it needs the same
 * connection string the backend suites use. Those suites get it for free: they run with
 * `backend/` as the working directory, so `config/env.ts`'s `dotenv.config()` picks up
 * `backend/.env`. This one runs from `web/`, where there is no such file, so without
 * this module `npm run verify` would fail locally for everyone who had not exported
 * `DATABASE_URL` by hand — a gate that demands an undocumented export is a gate people
 * learn to skip.
 *
 * Deliberately narrow: it sets `DATABASE_URL` and nothing else.
 *
 *  - an ALREADY-SET value wins, so CI (which exports one for its throwaway Postgres) is
 *    never overridden by a developer file that happens to exist in the checkout;
 *  - a missing `backend/.env` is fine, and leaves the connection error to surface where
 *    the read actually runs, with the instructions that name it.
 *
 * `.env` is gitignored and never printed; only the one value is read, and nothing here
 * logs it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../../backend/.env', import.meta.url));

if (!process.env.DATABASE_URL && existsSync(ENV_FILE)) {
  const line = readFileSync(ENV_FILE, 'utf8')
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('DATABASE_URL='));

  if (line) {
    // Quoted or not, and no `#` comment handling: a URL with a `#` in a password is
    // legal and would be mangled by a naive strip.
    const value = line.slice('DATABASE_URL='.length).replace(/^(['"])(.*)\1$/, '$2');
    if (value.length > 0) process.env.DATABASE_URL = value;
  }
}
