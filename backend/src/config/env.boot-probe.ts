/**
 * Boot probe for `env.check.ts`.
 *
 * The refusals live in `config/env.ts` at module load, so the only honest way to
 * test them is to import the config in a fresh process with a chosen environment
 * and see whether that process starts. This file is that process. It imports the
 * same modules a real boot pulls in:
 *
 *   - `config/env`       — parses the environment and runs the production guard
 *   - `config/networks`   — resolves the chain, the mainnet opt-in, the cursor lookback
 *   - `lib/signed-token`  — the quote key, whose fallback is what production must not reach
 *
 * Reaching the final `process.stdout.write` means the configuration was accepted
 * and the process would have continued to boot. A throw before it means the boot
 * refused.
 *
 * It is spawned by the check with an environment and a working directory chosen
 * per case. The child runs OUTSIDE `backend/`, so the project's own `.env` is
 * never read and the verdict depends only on the variables the case sets. That
 * is why the check does not need to (and must not) edit any real `.env`.
 */
import { env } from './env.js';
import { network } from './networks.js';
import { signingSecret } from '../lib/signed-token.js';

// Exercise the lazy key path twice. In development with no secret this emits
// exactly one warning (the documented warn-once behaviour); in production the
// secret is required, the boot would have refused already, and this is silent.
signingSecret();
signingSecret();

process.stdout.write(`[boot-probe] BOOTED node_env=${env.NODE_ENV} network=${network.name}\n`);
