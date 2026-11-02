#!/usr/bin/env node
/**
 * `npm run check:seo` holds the website's search layer to what it promised.
 *
 * ## Why this exists
 *
 * The landing page is the only page a stranger reaches from a search result, and nothing
 * in the chain looked at the three things that decide whether it can be found and quoted:
 * its title and description, one h1, and a sitemap that names public pages only. A page can
 * lose its title length, grow a second h1 in a new band, or pick up `/app` in the sitemap,
 * and every other check stays green, because every other check is about code that runs.
 * This one is about the words and metadata that ship with it.
 *
 * It also guards deletions. Two claims were cut from the page and one from the metadata:
 * a `Neo-Bank` title that misdescribed the product, a "No hidden charges" description that
 * outlived the copy it described, and a `settles instantly` speed claim the copy cut. Each
 * came back once already through a copy-paste from an older file. They are asserted absent
 * rather than left to review.
 *
 * ## This is a SOURCE-LEVEL check, not a rendered-HTML check
 *
 * Everything here reads the repository's own files. Nothing is built, nothing is fetched
 * from a running site. That is a deliberate trade: the check runs in a second inside
 * `npm run verify`, with no server, no network and no build, which is the only way it gets
 * run at all.
 *
 * ## What green does and does not mean
 *
 * Green means: the strings and files below contain what they are supposed to.
 *
 * It does NOT mean:
 *
 *   - the emitted <head> is right. Next.js merges metadata across layout, page and route
 *     group, so what a browser receives is not the literal in `layout.tsx`. A child can
 *     override the title, and this check would not see it. Only a built page or a live
 *     fetch can prove the final head.
 *   - the JSON-LD is valid. Green means the module mentions Organization and WebSite and
 *     the layout renders a ld+json script; it does not mean the graph satisfies Google's
 *     or schema.org's rules, and nothing here fetches the Rich Results report.
 *   - the sitemap and robots.txt are served. `web/app/sitemap.ts` existing is not
 *     `/sitemap.xml` answering 200 with those entries after the route is built.
 *   - any page is actually indexed or excluded. `robots: { index: false }` in source is a
 *     declaration; whether a crawler honours it, and whether an existing index entry is
 *     removed, is outside anything a file can say.
 *   - the copy is good. Length and keyword assertions catch a title that overflows a
 *     search result and lose the words that make it findable. They cannot catch a title
 *     that is the right length and says nothing.
 *   - a deleted claim is gone from the CODE that renders it. See below, on comments.
 *
 * ## The three things that make a check like this cry wolf
 *
 * 1. QUOTES AND WRAPPED LINES. Metadata is written by hand and reformatted by tools, so
 *    the same value arrives as `'x'`, `"x"`, or a single-quoted string wrapped across
 *    lines. A checker that hard-codes one style fails on a formatting-only change, which
 *    is exactly the kind of noise that teaches people to ignore the check.
 * 2. TOMBSTONE COMMENTS. `FeesSection.tsx` explains in a comment that "No hidden charges"
 *    was deleted and why, and `sitemap.ts` names `/app` in its own docstring to say why it
 *    is excluded. Both comments are the opposite of the claim they contain. Scanning raw
 *    source flags the page's own record of its deletion and a sitemap that is correct;
 *    the first version of this check did exactly that. Every source is read with comments
 *    stripped, before any assertion looks at it. The cost: a claim hidden inside a comment
 *    passes, and a claim in a string still fails, which is the half that ships to a reader.
 * 3. COMPOSED PATHS. A sitemap builds its entries as `${BASE_URL}/privacy`, so `/privacy`
 *    does not exist as a literal until the base is composed. The extractor composes it:
 *    template expressions are removed, an absolute base is stripped, and what is left is
 *    compared as a path.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WEB = path.join(ROOT, 'web');
const WEB_APP = path.join(WEB, 'app');
const LANDING = path.join(WEB_APP, 'components/landing');
const LAYOUT = path.join(WEB_APP, 'layout.tsx');
const HOME = path.join(WEB_APP, 'page.tsx');
const SITEMAP = path.join(WEB_APP, 'sitemap.ts');
const ROBOTS = path.join(WEB_APP, 'robots.ts');
const LLMS = path.join(WEB, 'public/llms.txt');

const STRUCTURED_DATA = [
  path.join(WEB, 'lib/structured-data.ts'),
  path.join(WEB, 'lib/structured-data.tsx'),
  path.join(WEB_APP, 'structured-data.ts'),
];

/** The private surfaces: no search engine should hold a page behind a session or a payment. */
const PRIVATE_SURFACES = [
  'web/app/(product)/app/layout.tsx',
  'web/app/(product)/signin/page.tsx',
  'web/app/r/[id]/page.tsx',
  'web/app/pay/[id]/page.tsx',
  'web/app/u/[handle]/page.tsx',
];

/** Public paths the sitemap is allowed to name, and the prefixes it is never allowed to. */
const PUBLIC_PATHS = ['/', '/privacy', '/terms', '/cookies'];
const PRIVATE_PREFIXES = ['/app', '/signin', '/r/', '/pay/', '/m/', '/u/', '/i/'];

/**
 * Claims that were deleted and must stay deleted. The `why` is the origin, because the
 * only way to keep a string out is to recognise it when it comes back.
 */
const DELETED_CLAIMS = [
  {
    text: 'No hidden charges',
    why: 'a metadata description that outlived the page\'s own copy: the heading and the description that carried it were deleted (#288) when the price list below said the same thing four times',
  },
  {
    text: 'Neo-Bank',
    why: 'a title that misdescribed the product: Seti is not a bank and holds nothing of the customer\'s; the title it sat in was replaced',
  },
  {
    text: 'settles instantly',
    why: 'a speed claim the copy cut: a Tempo transfer is fast but not instant in the way the sentence implied, so the promise went',
  },
];

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.txt', '.json', '.css', '.html']);

let passed = 0;
const failures = [];

function pass(label, detail) {
  passed += 1;
  console.log(`PASS  ${label}${detail ? `  (${detail})` : ''}`);
}

function fail(label, got, fix) {
  failures.push(label);
  console.log(`FAIL  ${label}`);
  if (got) console.log(`      found: ${got}`);
  if (fix) console.log(`      fix:   ${fix}`);
}

function read(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

const rel = (file) => path.relative(ROOT, file);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Length in characters, not UTF-16 units: a title's budget is read as characters. */
const chars = (s) => Array.from(s).length;

/** `key: 'value'` in either quote style, tolerant of a value wrapped across lines. */
function metadataString(source, key) {
  // Everything before the declaration is not metadata; the first key after it is the
  // top-level one, not an `openGraph.title` further down.
  const start = source.indexOf('export const metadata');
  const region = start === -1 ? source : source.slice(start);
  const re = new RegExp(String.raw`\b${key}\s*:\s*(['"\x60])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1`);
  const m = region.match(re);
  return m ? m[2] : null;
}

/** Every quoted literal in a source file, in either quote style, escapes intact. */
function literals(source) {
  const out = [];
  const re = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g;
  for (const m of source.matchAll(re)) out.push(m[2]);
  return out;
}

/**
 * Path entries named by a sitemap module.
 *
 * A sitemap composes its URLs, so the literal is `${BASE_URL}/privacy` or a full
 * `https://seti.live/terms`. Template expressions are dropped and an absolute base is
 * stripped before the remainder is judged, which is what makes the comparison against the
 * published path list meaningful instead of a haystack search.
 */
function sitemapPaths(source) {
  const found = new Set();
  for (const literal of literals(source)) {
    let value = literal.replace(/\$\{[^}]*\}/g, '');
    value = value.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
    if (value === '') continue; // a bare base URL names no path of its own
    if (!value.startsWith('/')) continue;
    value = value.replace(/\/+$/, '') || '/';
    if (!/^\/[A-Za-z0-9\-/]*$/.test(value)) continue; // not a path: has dots, params, spaces
    found.add(value);
  }
  return [...found].sort();
}

/**
 * The source with comments removed and strings left alone.
 *
 * The scan below must not flag the tombstone comment that documents a deletion. A plain
 * regex strip would eat `//` inside a URL and `/*` inside a JSX string, so this walks the
 * file and only leaves a comment when it is in code position.
 *
 * The apostrophe case is the one that needs care: JSX prose contains "customer's", and
 * treating every `'` as the start of a string would swallow the text between two of them.
 * A `'` opens a string only when the character before it is not part of a word, which is
 * true of `'value'` in code and false of every possessive in copy.
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      out += ' ';
      continue;
    }
    if (c === '"' || c === '`') {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === "'" && !/[A-Za-z0-9_$]/.test(source[i - 1] ?? '')) {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

// ---------------------------------------------------------------------------------
// 1. the landing page's title and description
// ---------------------------------------------------------------------------------
const layoutSource = read(LAYOUT);
/** Comments out: a comment naming a key is not the key. */
const layoutCode = layoutSource === null ? null : stripComments(layoutSource);
if (layoutSource === null) {
  fail(
    '1. web/app/layout.tsx declares the site metadata',
    'file not found',
    `restore ${rel(LAYOUT)}: it is the only place the site-wide title and description live`,
  );
} else {
  const title = metadataString(layoutCode, 'title');
  const description = metadataString(layoutCode, 'description');

  if (title === null) {
    fail('1a. title is declared', 'no `title: \'...\'` in the metadata object', `add a title to the metadata object in ${rel(LAYOUT)}`);
  } else {
    const n = chars(title);
    if (n >= 45 && n <= 60) {
      pass('1a. title is 45-60 characters', `${n}: ${title}`);
    } else {
      fail(
        '1a. title is 45-60 characters',
        `${n} characters: ${title}`,
        `edit the title in ${rel(LAYOUT)} to 45-60 characters so a search result shows all of it without a mid-word cut`,
      );
    }
    if (/\bSeti\s*$/.test(title)) {
      pass('1b. title ends with the brand', title);
    } else {
      fail(
        '1b. title ends with the brand',
        title,
        `end the title in ${rel(LAYOUT)} with "Seti": a result from a domain nobody recognises needs the name in the title, not only in the URL`,
      );
    }
  }

  if (description === null) {
    fail('1c. description is declared', 'no `description: \'...\'` in the metadata object', `add a description to the metadata object in ${rel(LAYOUT)}`);
  } else {
    const n = chars(description);
    if (n >= 140 && n <= 155) {
      pass('1c. description is 140-155 characters', `${n}`);
    } else {
      fail(
        '1c. description is 140-155 characters',
        `${n} characters: ${description}`,
        `edit the description in ${rel(LAYOUT)} to 140-155 characters: shorter wastes the result, longer is cut off mid-sentence`,
      );
    }
    if (/Kenya|Thika/.test(description)) {
      pass('1d. description names where this is', /Thika/.test(description) ? 'Thika' : 'Kenya');
    } else {
      fail(
        '1d. description names Kenya or Thika',
        description,
        `name Kenya or Thika in the description in ${rel(LAYOUT)}: without a place the sentence could describe a payments app anywhere`,
      );
    }
    if (description.includes('2%')) {
      pass('1e. description states the price', '2%');
    } else {
      fail(
        '1e. description states the price (2%)',
        description,
        `state "2%" in the description in ${rel(LAYOUT)}: it is the one number that separates Seti from a payment processor`,
      );
    }
  }
}

// ---------------------------------------------------------------------------------
// 2. exactly one h1
// ---------------------------------------------------------------------------------
const landingFiles = walk(LANDING).filter((f) => /\.(tsx|jsx|ts|js)$/.test(f));
if (landingFiles.length === 0) {
  fail('2a. the landing bands are components under web/app/components/landing', `${rel(LANDING)} holds no source files`, 'the path moved: point LANDING in scripts/check-seo.mjs at the new directory');
} else {
  const h1Files = landingFiles.filter((f) => stripComments(read(f) ?? '').includes('<h1'));
  if (h1Files.length === 1) {
    pass('2a. the landing tree carries exactly one h1', `${rel(h1Files[0])}`);
  } else if (h1Files.length === 0) {
    fail(
      '2a. the landing tree carries exactly one h1',
      `no <h1> in ${landingFiles.length} files under ${rel(LANDING)}`,
      'give the hero headline the page\'s h1: a page with no h1 has no heading a crawler can treat as its subject',
    );
  } else {
    fail(
      '2a. the landing tree carries exactly one h1',
      `${h1Files.length} files: ${h1Files.map(rel).join(', ')}`,
      'keep one <h1> (the hero headline) and demote the others to <h2>: a second h1 splits the page\'s subject in two',
    );
  }
}

const homeSource = read(HOME);
if (homeSource === null) {
  fail('2b. the landing page renders it', `${rel(HOME)} not found`, 'the landing entry point moved: point HOME in scripts/check-seo.mjs at it');
} else if (stripComments(homeSource).includes('<h1')) {
  fail(
    '2b. web/app/page.tsx has no h1 of its own',
    `${rel(HOME)}:${lineOf(homeSource, homeSource.indexOf('<h1'))}`,
    'the h1 belongs to the hero band, not to the page shell: leave page.tsx to composition so the count stays at one',
  );
} else {
  pass('2b. web/app/page.tsx has no h1 of its own');
}

// ---------------------------------------------------------------------------------
// 3. sitemap and robots
// ---------------------------------------------------------------------------------
const sitemapSource = read(SITEMAP);
if (sitemapSource === null) {
  fail(
    '3a. web/app/sitemap.ts exists',
    `${rel(SITEMAP)} not found`,
    `create ${rel(SITEMAP)} exporting a default MetadataRoute.Sitemap naming exactly ${PUBLIC_PATHS.join(' ')}, or nothing tells a crawler these pages exist`,
  );
  // Printed rather than dropped: an assertion that vanishes from the log reads as a pass.
  console.log('note  3b. the sitemap names no private surface  (not checked, there is no sitemap to read)');
} else {
  const found = sitemapPaths(stripComments(sitemapSource));
  const missing = PUBLIC_PATHS.filter((p) => !found.includes(p));
  const extra = found.filter((p) => !PUBLIC_PATHS.includes(p));

  if (missing.length === 0 && extra.length === 0) {
    pass('3a. the sitemap names exactly the four public paths', found.join(' '));
  } else {
    fail(
      '3a. the sitemap names exactly the four public paths',
      [
        extra.length ? `unexpected: ${extra.join(' ')}` : null,
        missing.length ? `missing: ${missing.join(' ')}` : null,
      ]
        .filter(Boolean)
        .join('; '),
      `edit ${rel(SITEMAP)} so its entries are exactly ${PUBLIC_PATHS.join(' ')}: a path in the sitemap is an invitation to index it`,
    );
  }

  // Named separately from the exactness assertion: a private path is a leak, not a typo.
  const leaked = found.filter((p) => PRIVATE_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix)));
  if (leaked.length === 0) {
    pass('3b. the sitemap names no private surface', `none of ${PRIVATE_PREFIXES.join(' ')}`);
  } else {
    fail(
      '3b. the sitemap names no private surface',
      leaked.join(' '),
      `remove ${leaked.join(', ')} from ${rel(SITEMAP)}: those pages carry noindex because they are behind a session, and a sitemap entry asks a crawler in anyway`,
    );
  }
}

const robotsSource = read(ROBOTS);
if (robotsSource === null) {
  fail(
    '3c. web/app/robots.ts exists and points at the sitemap',
    `${rel(ROBOTS)} not found`,
    `create ${rel(ROBOTS)} exporting a default MetadataRoute.Robots with a rules entry and a sitemap key pointing at the origin plus /sitemap.xml`,
  );
} else if (/sitemap\s*:/.test(stripComments(robotsSource))) {
  pass('3c. robots.ts names the sitemap');
} else {
  fail(
    '3c. robots.ts names the sitemap',
    'no `sitemap:` key',
    `add a sitemap key (the site origin plus /sitemap.xml) to the object returned by ${rel(ROBOTS)}: robots.txt is where a crawler looks for the pointer, and a sitemap nobody is told about is found only by luck`,
  );
}

// ---------------------------------------------------------------------------------
// 4. structured data
// ---------------------------------------------------------------------------------
if (layoutSource === null) {
  fail('4a. layout.tsx renders the JSON-LD', `${rel(LAYOUT)} not found`, 'restore the root layout');
} else if (layoutCode.includes('application/ld+json')) {
  pass('4a. layout.tsx renders a ld+json script', 'application/ld+json');
} else {
  fail(
    '4a. layout.tsx renders a ld+json script',
    'no application/ld+json',
    `render the structured data in ${rel(LAYOUT)} as <script type="application/ld+json">: JSON that is only imported is JSON no crawler ever reads`,
  );
}

const structuredFile = STRUCTURED_DATA.find((f) => existsSync(f));
if (!structuredFile) {
  fail(
    '4b. the structured-data module exports Organization and WebSite',
    `${STRUCTURED_DATA.map(rel).join(' or ')} not found`,
    'create web/lib/structured-data.ts with an Organization object (name, url, logo, areaServed) and a WebSite object, both with @type',
  );
} else {
  const source = stripComments(read(structuredFile) ?? '');
  const missing = ['Organization', 'WebSite'].filter((t) => !source.includes(t));
  if (missing.length === 0) {
    pass('4b. the structured data names Organization and WebSite', rel(structuredFile));
  } else {
    fail(
      '4b. the structured data names Organization and WebSite',
      `missing: ${missing.join(', ')} in ${rel(structuredFile)}`,
      `add an object with @type '${missing[0]}': WebSite makes the site a thing a search engine can name, Organization ties it to a brand and a place`,
    );
  }
}

// ---------------------------------------------------------------------------------
// 5. llms.txt
// ---------------------------------------------------------------------------------
const llms = read(LLMS);
if (llms === null) {
  fail(
    '5. web/public/llms.txt exists and says something',
    `${rel(LLMS)} not found`,
    `create ${rel(LLMS)}: a short map of what Seti is, what it costs and which pages answer which question, for an assistant quoting the site`,
  );
} else if (chars(llms.trim()) >= 200) {
  pass('5. llms.txt exists and says something', `${chars(llms.trim())} characters`);
} else {
  fail(
    '5. llms.txt exists and says something',
    `${chars(llms.trim())} characters, needs 200`,
    `expand ${rel(LLMS)}: under 200 characters it is a stub that gives an assistant nothing to quote`,
  );
}

// ---------------------------------------------------------------------------------
// 6. noindex on the private surfaces
// ---------------------------------------------------------------------------------
for (const surface of PRIVATE_SURFACES) {
  const full = path.join(ROOT, surface);
  const source = read(full);
  if (source === null) {
    fail(
      `6. ${surface} is noindex`,
      'file not found',
      'the route moved: update PRIVATE_SURFACES in scripts/check-seo.mjs so this surface is still covered',
    );
    continue;
  }
  if (/index\s*:\s*false/.test(source)) {
    pass(`6. ${surface} is noindex`);
  } else {
    fail(
      `6. ${surface} is noindex`,
      'no `index: false` in metadata or generateMetadata',
      `add \`robots: { index: false, follow: false }\` to the metadata of ${surface}: a session or a payment behind one person does not belong in a search result`,
    );
  }
}

// ---------------------------------------------------------------------------------
// 7. deleted claims stay deleted
// ---------------------------------------------------------------------------------
const scanned = walk(WEB_APP).filter((f) => SOURCE_EXTS.has(path.extname(f)));
for (const claim of DELETED_CLAIMS) {
  const hits = [];
  for (const file of scanned) {
    const raw = read(file);
    if (raw === null || !raw.includes(claim.text)) continue;
    if (!stripComments(raw).includes(claim.text)) continue; // only in a comment: the deletion's record
    const line = raw.split('\n').findIndex((l) => l.includes(claim.text)) + 1;
    hits.push(`${rel(file)}:${line}`);
  }
  if (hits.length === 0) {
    pass(`7. "${claim.text}" appears nowhere under web/app`, claim.why.split(':')[0]);
  } else {
    fail(
      `7. "${claim.text}" appears nowhere under web/app`,
      hits.join(', '),
      `delete "${claim.text}" from ${hits[0].split(':')[0]}: it was ${claim.why}`,
    );
  }
}

// ---------------------------------------------------------------------------------
console.log(`\n${scanned.length} files scanned under web/app.`);
console.log('-'.repeat(74));
if (failures.length) {
  console.log(`${passed} passed, ${failures.length} FAILED`);
  process.exit(1);
}
console.log(`${passed} assertions passed.`);
