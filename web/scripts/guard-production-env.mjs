/**
 * Production build guard for the web app.
 *
 * `NEXT_PUBLIC_API_URL` is INLINED into the client bundle at build time. Once a
 * build has run there is nothing left to correct: the value is a string literal
 * inside the shipped JavaScript. A production build that baked the fallback
 * `http://localhost:4000` (what `lib/api/api.constants.ts` uses when the variable
 * is unset) therefore ships an app that talks to nothing — and it cannot be
 * repaired from the outside. A Wrangler `vars` entry does not help: `NEXT_PUBLIC_*`
 * is resolved by the bundler, not read at runtime.
 *
 * So the build REFUSES, in the same spirit as the backend's
 * `InsecureProductionConfigError` boot refusal (`backend/src/config/env.ts`):
 * fail loudly, name the variable, say why, and have no bypass.
 *
 * Development is untouched. The guard is a BUILD STEP — `next dev` and
 * `vite dev` never run it (the Vite plugin is `apply: "build"`) — and it
 * additionally stands down whenever `NODE_ENV=development`, so a development
 * server can never be blocked by it.
 *
 * Two ways in, one rule:
 *   - `node scripts/guard-production-env.mjs` — run by the `build` and
 *     `build:vinext` scripts (and pinned by `check:build-env`).
 *   - `import { productionApiUrlRefusal } from './scripts/guard-production-env.mjs'`
 *     — used by `vite.config.ts`, so a bare `vite build` that bypasses the npm
 *     script still refuses.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The one variable this guard protects. Named as a constant so the error, the
 * resolution and the check suite can never drift apart. */
export const VARIABLE = 'NEXT_PUBLIC_API_URL';

/** The value the app falls back to when the variable is unset. Kept in step with
 * `lib/api/api.constants.ts`; duplicated here deliberately so the guard states
 * the literal it is refusing rather than importing the app. */
export const LOCALHOST_FALLBACK = 'http://localhost:4000';

/** The typed code, mirroring the backend's `INSECURE_PRODUCTION_CONFIG`. */
export const ERROR_CODE = 'INSECURE_PRODUCTION_BUILD';

/**
 * The order Next.js reads environment files in, most specific first, with
 * `process.env` winning over all of them. `NODE_ENV=test` skips `.env.local`,
 * exactly as Next documents.
 */
export function envFileCandidates(nodeEnv) {
  const files = [`.env.${nodeEnv}.local`];
  if (nodeEnv !== 'test') files.push('.env.local');
  files.push(`.env.${nodeEnv}`, '.env');
  return files;
}

/**
 * A deliberately small `.env` parser: `KEY=VALUE` lines, `#` comments, blank
 * lines, optional single/double quotes, and a leading `export`. It is not a
 * shell — it only has to agree with Next's reader on the one variable checked.
 */
export function parseEnvFile(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

/**
 * The effective `NEXT_PUBLIC_API_URL` for a build rooted at `rootDir`:
 * `process.env` first (which the bundler also prefers), then the first
 * environment file that sets it. Returns `undefined` when nothing sets it.
 */
export function resolveApiUrl({ env = process.env, rootDir = process.cwd(), nodeEnv } = {}) {
  const fromProcess = (env[VARIABLE] ?? '').trim();
  if (fromProcess) return { value: fromProcess, source: 'process.env' };

  const resolvedNodeEnv = nodeEnv ?? env.NODE_ENV ?? 'production';
  for (const fileName of envFileCandidates(resolvedNodeEnv)) {
    const filePath = resolve(rootDir, fileName);
    if (!existsSync(filePath)) continue;
    const value = (parseEnvFile(readFileSync(filePath, 'utf8'))[VARIABLE] ?? '').trim();
    if (value) return { value, source: fileName };
  }
  return { value: undefined, source: 'unset' };
}

/** `true` for a literal IPv4 in a range that is not routable on the public
 * internet: loopback, RFC1918 private, and link-local (169.254/16). */
export function isPrivateIPv4(hostname) {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  if (!parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return false;
  const [a, b] = parts.map(Number);
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local
  if (a === 0) return true; // "this host"
  return false;
}

/** `true` for a loopback / unique-local / link-local IPv6 literal. */
export function isPrivateIPv6(hostname) {
  const value = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (!value.includes(':')) return false;
  if (value === '::' || value === '::1') return true;
  // Unique local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd][0-9a-f]{0,2}:/.test(value)) return true;
  if (/^fe[89ab][0-9a-f]?:/.test(value)) return true;
  // An IPv4-mapped loopback/private address, e.g. ::ffff:127.0.0.1.
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

/**
 * The reason `value` may not be shipped in a production build, or `null` when it
 * is acceptable. Every branch is a thing that "cannot be corrected after the
 * build".
 */
export function apiUrlProblem(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return (
      `${VARIABLE} is unset, so the build would inline the localhost fallback ` +
      `(${LOCALHOST_FALLBACK}).`
    );
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return `${VARIABLE} is not a valid absolute URL: "${value}".`;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `${VARIABLE} must be an http(s) URL, got "${url.protocol}//".`;
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return `${VARIABLE} points at localhost ("${value}").`;
  }
  if (hostname.endsWith('.local')) {
    return `${VARIABLE} points at an mDNS (.local) name ("${value}"), which no visitor can resolve.`;
  }
  if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    return `${VARIABLE} points at a private address ("${value}").`;
  }

  return null;
}

/**
 * Resolve and judge the URL for one build. Never throws — returns a verdict so
 * the CLI, the build scripts and `vite.config.ts` can act on it.
 */
export function checkProductionApiUrl({ env = process.env, rootDir = process.cwd() } = {}) {
  const nodeEnv = env.NODE_ENV ?? 'production';

  // Development stands down: the guard is a build step, and `next dev` /
  // `vite dev` must never be blocked by it.
  if (nodeEnv === 'development') {
    return { ok: true, skipped: true, reason: 'NODE_ENV=development', nodeEnv, source: 'skipped' };
  }

  const { value, source } = resolveApiUrl({ env, rootDir, nodeEnv });
  const problem = apiUrlProblem(value);
  if (!problem) {
    return { ok: true, skipped: false, value, source, nodeEnv };
  }

  return { ok: false, skipped: false, value, source, nodeEnv, problem };
}

/** The loud, self-explaining refusal. Names the variable and says why the value
 * cannot be fixed later. */
export function refusalMessage(problem, { source, nodeEnv }) {
  return (
    `[${ERROR_CODE}] Refusing to build: ${problem}\n\n` +
    `  ${VARIABLE} is INLINED into the client bundle at build time — the value is\n` +
    `  frozen into the shipped JavaScript. A localhost or private address that is\n` +
    '  baked in cannot be corrected after the build: no server setting, no Wrangler\n' +
    '  `vars` entry and no environment variable at runtime can change it, because\n' +
    '  NEXT_PUBLIC_* variables are resolved by the bundler, not read at boot.\n\n' +
    `  resolved from: ${source}\n` +
    `  NODE_ENV:      ${nodeEnv}\n\n` +
    `  Set ${VARIABLE} to the public URL of the Seti API before building, e.g.\n\n` +
    `    ${VARIABLE}=https://api.seti.example npm run build\n\n` +
    '  This check has no bypass.'
  );
}

/**
 * The refusal message for a build rooted here, or `null` when the build may
 * proceed. Callers (the build scripts, `vite.config.ts`) use this rather than
 * reaching into the verdict object, so they never depend on its shape.
 */
export function productionApiUrlRefusal({ env = process.env, rootDir = process.cwd() } = {}) {
  const verdict = checkProductionApiUrl({ env, rootDir });
  if (verdict.ok) return null;
  return refusalMessage(verdict.problem, verdict);
}

function main() {
  const verdict = checkProductionApiUrl();

  if (verdict.skipped) {
    console.log(`[guard] ${verdict.reason} — ${VARIABLE} not checked (development).`);
    return;
  }
  if (verdict.ok) {
    console.log(`[guard] ${VARIABLE}=${verdict.value} (from ${verdict.source}) — ok.`);
    return;
  }

  console.error(refusalMessage(verdict.problem, verdict));
  process.exit(1);
}

// Run only when invoked directly (`node scripts/guard-production-env.mjs`),
// never when imported as a module by `next.config.ts`.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
