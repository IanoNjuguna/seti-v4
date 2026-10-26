/**
 * No stablecoin names where a customer is looking.
 *
 * The account holds what it holds — OUSD, USDC.e, pathUSD, USDT0 — and the
 * settlement pass turns the bridged ones into OUSD in the background. None of that
 * is a customer's business: the balance is one USD figure, activity rows are
 * amounts, and the receipt explains a fee in words. A screen that says "USDC.e" is
 * a screen that has leaked the ledger's vocabulary into someone's money.
 *
 * This script is the rule. It scans the SHIPPED client source for a token symbol
 * inside a string literal or JSX text, and fails with the file and line when it
 * finds one outside the allowlist below.
 *
 * Rules that keep it honest:
 *
 *  - The allowlist is per FILE with a reason, never per pattern. A regex that
 *    tolerates "symbols in this shape" is a regex that tolerates the next leak.
 *  - The chain table, the receipt's symbol map and the page metadata are the only
 *    places that may name a token, because they are the places a token is a FACT
 *    rather than a label shown to a customer.
 *  - Comments are not scanned. Explaining a token in code is not showing it to
 *    anyone, and pretending otherwise would push the reasoning out of the code.
 *
 * Run: npm run check:asset-words --workspace web (part of `npm run verify`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = ['components', 'app', 'lib'];

/** Symbols as a customer would read them, plus the ledger labels. */
const SYMBOLS = /\b(OUSD|USDC\.e|USDC|USDT0|USDT|pathUSD)\b/;

/**
 * Files that may name a token, each for a stated reason. Anything else is a leak.
 */
const ALLOWED = new Map([
  ['lib/chain/chain.assets.ts', 'the chain table: a symbol is the asset\'s identity'],
  ['app/layout.tsx', 'page metadata keywords for search, never rendered'],
  [
    'components/receipt/Receipt.constants.ts',
    'the receipt\'s symbol map: the one surface that names the token that moved (#238)',
  ],
  [
    'components/receipt/receipt.format.ts',
    'the comment explaining how a stored label is printed',
  ],
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Strip block/line comments so only what ships is scanned. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const leaks = [];
let scanned = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    if (ALLOWED.has(rel)) continue;

    scanned += 1;
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');

    lines.forEach((line, index) => {
      const match = line.match(SYMBOLS);
      if (match) {
        leaks.push(`${rel}:${index + 1}: "${match[1]}" — ${line.trim().slice(0, 100)}`);
      }
    });
  }
}

if (leaks.length > 0) {
  console.error(`No stablecoin names in customer-facing source. ${leaks.length} found:\n`);
  for (const leak of leaks) console.error(`  ${leak}`);
  console.error(
    '\nShow the amount, not the token. If a screen genuinely needs the asset, it goes in an internal surface (admin, statement internals) or the allowlist above, with a reason.'
  );
  process.exit(1);
}

console.log(`ok  ${scanned} files, no stablecoin names outside the allowlist`);
