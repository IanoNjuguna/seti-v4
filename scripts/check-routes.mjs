#!/usr/bin/env node
/**
 * `npm run check:routes` — every route we promise is a route that exists.
 *
 * ## Why this exists (#254)
 *
 * `mcp-server/src/tools/seti.ts` called `GET /users/:id/balance` for as long as that tool
 * existed, and `docs/api-reference.md` documented it with a sample response. No such route
 * was ever written. Nothing in a chain of 68 checks looked at route registration, so it took
 * a human reading the code to notice, and until then an agent-facing tool could only fail.
 *
 * This reads two kinds of claim and checks both against the registrations:
 *
 *   docs/api-reference.md        "### `GET /health`"            the promise to integrators
 *   mcp-server/src/tools/*.ts    path: `/users/${id}/home`      the promise to agents
 *
 * ## What green does and does not mean
 *
 * Green means the PATH is registered. It does not mean the route answers correctly, returns
 * the shape the docs describe, or is authorised the way the tool assumes. This catches a
 * fictional path, which was the failure that shipped.
 *
 * ## The two things that make such a check cry wolf
 *
 * 1. PREFIXES. Routes are registered as `app.register(userRoutes, { prefix: '/users' })` and
 *    declare `app.get('/:id/home')` locally, so the path is only real after composition. A
 *    checker that ignores the prefix reports every prefixed route as missing.
 * 2. PARAMETERS. A tool builds its URL at call time —
 *    `/users/${encodeURIComponent(userId)}/home` — so the literal in the source is not a
 *    path until the expression is normalised to `:param`.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SERVER = path.join(ROOT, 'backend/src/server.ts');
const ROUTES_DIR = path.join(ROOT, 'backend/src/routes');
const DOCS = path.join(ROOT, 'docs/api-reference.md');
const TOOLS_DIR = path.join(ROOT, 'mcp-server/src/tools');

let passed = 0;
const failures = [];

function ok(claim) {
  passed += 1;
  console.log(`ok    ${claim}`);
}

function fail(claim, detail) {
  failures.push(claim);
  console.log(`FAIL  ${claim}${detail ? `\n      ${detail}` : ''}`);
}

function read(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

/** Normalise a path for comparison: leading slash, params to `:p`, no trailing slash. */
function normalise(p) {
  let out = p.trim().split('?')[0].split('#')[0];
  if (!out.startsWith('/')) out = `/${out}`;
  out = out.replace(/\$\{[^}]*\}/g, ':p'); // template expressions
  out = out.replace(/\{[^}]+\}/g, ':p'); // {id} style
  out = out.replace(/(^|\/):[A-Za-z_][\w]*/g, '$1:p'); // :id -> :p
  out = out.replace(/(^|\/)\*+.*$/, '$1*'); // wildcards
  out = out.replace(/\/+$/, '');
  return out === '' ? '/' : out;
}

const key = (method, p) => `${method.toUpperCase()} ${normalise(p)}`;

// ---- 1. the registrations, composed from server.ts ------------------------------
const server = read(SERVER);
if (!server) {
  console.error(`check:routes cannot read ${SERVER}`);
  process.exit(1);
}

/** import { userRoutes } from './routes/users.js'  ->  userRoutes -> routes/users.ts */
const importTargets = new Map();
for (const m of server.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/routes\/([\w-]+)\.js'/g)) {
  for (const name of m[1].split(',')) importTargets.set(name.trim(), `${m[2]}.ts`);
}

const registered = new Map(); // key -> "file:line"
let modulesSeen = 0;

for (const m of server.matchAll(/app\.register\(\s*([\w]+)\s*(?:,\s*\{([^}]*)\})?\s*\)/g)) {
  const identifier = m[1];
  const file = importTargets.get(identifier);
  if (!file) continue; // a plugin, not a route module: cors, etc.

  const prefixMatch = (m[2] ?? '').match(/prefix:\s*'([^']*)'/);
  const prefix = prefixMatch ? prefixMatch[1] : '';
  modulesSeen += 1;

  const source = read(path.join(ROUTES_DIR, file));
  for (const r of source.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
    const full = key(r[1], `${prefix}${r[2]}` === '' ? '/' : `${prefix}${r[2]}`);
    const line = source.slice(0, r.index).split('\n').length;
    registered.set(full, `backend/src/routes/${file}:${line}`);
  }
}

ok(`${registered.size} routes registered across ${modulesSeen} route modules`);

// ---- 2. the promises in the docs -------------------------------------------------
const docs = read(DOCS);
const documented = new Map(); // key -> line number
for (const line of docs.split('\n')) {
  const m = line.match(/^#+\s*`(GET|POST|PUT|PATCH|DELETE)\s+([^`]+)`/);
  if (!m) continue; // prose and curl examples are not claims about our own routes
  documented.set(key(m[1], m[2]), docs.slice(0, docs.indexOf(line)).split('\n').length);
}

// ---- 3. the promises in the MCP tools --------------------------------------------
const toolClaims = [];
if (existsSync(TOOLS_DIR)) {
  for (const file of readdirSync(TOOLS_DIR).filter((f) => f.endsWith('.ts'))) {
    const source = read(path.join(TOOLS_DIR, file));
    const lines = source.split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/(?:path|url):\s*`([^`]+)`/);
      if (!m) return;
      if (!m[1].startsWith('/')) return; // an absolute URL belongs to somebody else
      // the method is the other field of the same request block
      const around = lines.slice(Math.max(0, i - 4), i + 1).join('\n');
      const method = (around.match(/method:\s*'(GET|POST|PUT|PATCH|DELETE)'/i) || [])[1] ?? 'GET';
      toolClaims.push({ key: key(method, m[1]), where: `mcp-server/src/tools/${file}:${i + 1}` });
    });
  }
}

// ---- 4. the assertion ------------------------------------------------------------
const missingDocs = [...documented].filter(([k]) => !registered.has(k));
const missingTools = toolClaims.filter((c) => !registered.has(c.key));

if (documented.size === 0) {
  fail('the docs declare at least one route', 'no "### `METHOD /path`" headings were found, so this check proves nothing');
} else {
  ok(`${documented.size} routes documented, ${documented.size - missingDocs.length} of them exist`);
}

if (toolClaims.length === 0) {
  fail('the MCP tools call at least one path', 'no `path:` template strings were found');
} else {
  ok(`${toolClaims.length} tool calls checked, ${toolClaims.length - missingTools.length} resolve`);
}

for (const [k, line] of missingDocs) {
  fail(`the docs promise a route that is not registered: ${k}`, `docs/api-reference.md:${line}`);
}
for (const c of missingTools) {
  fail(`a tool calls a route that is not registered: ${c.key}`, c.where);
}

// A route nobody documents is not a failure: internal routes exist on purpose. But the count
// is printed so a route that silently disappears from the docs is visible in the log.
const undocumented = [...registered.keys()].filter((k) => !documented.has(k));
console.log(`\n${undocumented.length} registered routes are not documented (informational):`);
for (const k of undocumented.slice(0, 12)) console.log(`      ${k}   (${registered.get(k)})`);
if (undocumented.length > 12) console.log(`      ... and ${undocumented.length - 12} more`);

console.log('\n' + '-'.repeat(74));
if (failures.length) {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  process.exit(1);
}
console.log(`${passed} assertions passed.`);
