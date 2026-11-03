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
 *   - the page is long enough in a browser. The word floor (section 8) counts COPY
 *     CONSTANTS taken out of the landing tree and `page.tsx`; a string built at runtime, a
 *     `title` attribute and copy in a shared component outside that tree are all invisible
 *     to it, so its number is a floor of the floor rather than a rendered word count.
 *   - the outline a browser receives. Section 9 reads the heading levels the bands and
 *     the shared header declare and the `.map` each item title is rendered in. Nothing
 *     here renders React, so a heading produced by a component this check does not know
 *     about is not in its count.
 *   - the JSON-LD is what a validator would accept. Section 10 proves the FAQPage node is
 *     built from the band's own constants and that the answers are in the component tree;
 *     it does not parse the emitted `@graph` or run the Rich Results test.
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
// helpers the copy, outline and FAQ checks share
// ---------------------------------------------------------------------------------

/** Directories that hold a copy of somebody else's code: never scanned for copy. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'build', 'out', 'coverage']);

/** `walk`, but it does not descend into a dependency or a build output. */
function walkTree(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walkTree(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Every string literal in a source, with the characters that precede it.
 *
 * The context is what lets a rule tell copy from an attribute value: `eyebrow="What it
 * costs"` and `title="Seti"` are the same shape to a parser and different things on a
 * page, and only the name before the `=` separates them.
 */
function literalsWithContext(source) {
  const out = [];
  const re = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g;
  for (const m of source.matchAll(re)) {
    const before = source.slice(0, m.index).trimEnd().slice(-24);
    out.push({ value: m[2], before });
  }
  return out;
}

/**
 * The text between a bracket and its match, or null when it never closes.
 *
 * Quoted strings are skipped so a bracket inside copy cannot end the slice early, which
 * is the difference between reading a band's `.map(...)` body and reading half of it.
 */
function balanced(source, openIndex, open = '(', close = ')') {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (c === '\\') { i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === '`' || c === "'") { quote = c; continue; }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return null;
}

const HEADING_LEVEL = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };

/**
 * The heading elements a source renders, as `{ level, expr }`.
 *
 * Both styles in this tree are read: the literal tag (`<h3 ...>{step.title}</h3>`, whose
 * child expression is kept because that is what proves the text comes from an item) and
 * the `as="h2"` prop the design system's `Text` primitive and `SectionEyebrow` take. A
 * check that knew only the literal tag would read a band built on the primitive as having
 * no headings and pass a page with none.
 *
 * `as` is only counted when it is a literal. `as={title ? 'p' : 'h2'}` is a choice made
 * at render time and is asserted where it lives (`SectionHeader`), not counted as this
 * band's own heading.
 */
function headingSites(source) {
  const out = [];
  for (const m of source.matchAll(/<(h[1-6])\b[^>]*>\s*(?:\{\s*([\w$.[\]'"]+)\s*\})?/g)) {
    out.push({ level: HEADING_LEVEL[m[1]], expr: m[2] ?? null, via: 'tag' });
  }
  for (const m of source.matchAll(/\bas\s*=\s*(?:\{\s*)?['"](h[1-6])['"]/g)) {
    out.push({ level: HEADING_LEVEL[m[1]], expr: null, via: 'as' });
  }
  return out;
}

/**
 * The `.map(...)` calls in a source: the list each one iterates, and its body.
 *
 * This is what makes an "h3 per item" assertion structural rather than a count of the
 * word `<h3` in a file: one marker inside a map over a three-item list renders three
 * headings, and one marker outside any map renders one whatever the list says.
 */
function mapBlocks(source) {
  const out = [];
  for (const m of source.matchAll(/([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*\.map\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const body = balanced(source, open, '(', ')');
    if (body === null) continue;
    out.push({ target: m[1], body, index: m.index });
  }
  return out;
}

/** The `./x` and `./x.constants` module specifiers a source imports. */
function localImports(source) {
  const out = new Set();
  for (const m of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) out.add(m[1]);
  return [...out];
}

/** The names bound by the import whose specifier ends with `suffix`, e.g. `.constants`. */
function importedNames(source, suffix) {
  const names = [];
  const re = new RegExp(String.raw`import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]*${suffix.replace('.', '\\.')}['"]`, 'g');
  for (const m of source.matchAll(re)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.push(name);
    }
  }
  return names;
}

/**
 * The item lists a constants module declares: `key: [ {...}, ... ]` under `const NAME`.
 *
 * `count` is the number of object literals at the top level of the array and `fields`
 * is every key those objects carry, which is how a band's own copy says whether its
 * items have titles (`title:`) or only labels (`label:`, `detail:`). Nothing here reads
 * a value: the point is the shape the band declared.
 */
function itemLists(source) {
  const out = [];
  for (const m of source.matchAll(/(\w+)\s*:\s*\[/g)) {
    const open = m.index + m[0].length - 1;
    const body = balanced(source, open, '[', ']');
    if (body === null) continue;
    const objects = [];
    for (let i = 0; i < body.length; i += 1) {
      if (body[i] !== '{') continue;
      const inner = balanced(body, i, '{', '}');
      if (inner === null) break;
      objects.push(inner);
      i += inner.length + 1;
    }
    if (objects.length === 0) continue;
    const fields = new Set();
    for (const object of objects) for (const f of object.matchAll(/(\w+)\s*:/g)) fields.add(f[1]);
    const owner = source.slice(0, m.index).match(/const\s+([A-Za-z_$][\w$]*)[^;]*$/s);
    out.push({ key: m[1], owner: owner ? owner[1] : null, count: objects.length, fields: [...fields] });
  }
  return out;
}

// ---------------------------------------------------------------------------------
// 8. the landing page ships enough copy to be quotable
// ---------------------------------------------------------------------------------
/**
 * THE WORD FLOOR COUNTS COPY CONSTANTS, NOT A RENDERED PAGE. Read that twice, because
 * the number below is smaller than the page and always will be.
 *
 * What is counted: the string literals in `web/app/components/landing/**` and in
 * `web/app/page.tsx` that read as prose, by the rules in `notProse` below. Those rules
 * are written out rather than implied so a reader can argue with the number: a literal
 * needs a space and a letter, and it must not be a class list, a CSS variable, a path, a
 * URL, an interpolation, a module directive, a keyword list or SVG path data.
 *
 * What is NOT counted, and why the total is a floor of the floor:
 *
 *   - a string built at runtime. `${SITE_NAME}, payments` is one literal here and an
 *     unknown number of words in a browser, so it is skipped rather than guessed at.
 *   - a `title` or `alt` attribute. Those are attributes, not the page's prose.
 *   - copy in a shared component OUTSIDE the landing tree: `components/ui`,
 *     `hooks/`, `lib/`. It ships with the page and is in no file this walk reads.
 *   - copy a band would render from a rich-text or markdown blob. Nothing here parses a
 *     format, so a page that padded its prose there would pass this check with words no
 *     assertion had looked at. That is the failure mode this number cannot see, and it
 *     is stated here rather than left for someone to discover from a green tick.
 *
 * So: the page ships at least this many words. The useful direction for a regression
 * gate is the floor, since copy gets cut quietly and added loudly. It is not a claim
 * that the page reads long enough in a browser, and a green line here is not evidence
 * that the copy is any good.
 */
const WORD_FLOOR = { min: 600, max: 800 };

/** A token in a utility list: lower case, digits, and the punctuation Tailwind uses. */
const UTILITY_TOKEN = /^-?[a-z0-9]+(?:[-:[\]()._%]+[a-z0-9]+)*$/;
/** A token with no capital and no punctuation: a keyword or a utility, not a word. */
const PLAIN_TOKEN = /^[a-z0-9%]+$/;
/** Class prefixes a literal can open with and still be layout rather than copy. */
const CLASS_PREFIX = /^(?:text-|bg-|border-|font-|max-|min-|w-|h-|p[xytrbl]?-|m[xytrbl]?-|gap-|flex-|grid-|items-|justify-|col-|order-|inset-|z-|translate-|opacity-|rounded-|shadow-|object-|overflow-|whitespace-|tracking-|leading-|duration-|ease-|first-|last-|hover-|focus-|group|sm:|md:|lg:|xl:)/;
/** SVG path data: a token soup with no word in it. */
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]+$/;

/**
 * Why a literal is not prose, or null when it is. Every rule names what it keeps out.
 *
 * The two heuristics at the end are the ones that need defending, because they are
 * judgements rather than grammar:
 *
 *   - "utility soup": every token is a utility and at least one carries `-`, `[`, `.` or
 *     `%`. That is a class list. A sentence made only of such tokens does not occur in
 *     this tree, and one that did would be a sentence a person could not read either.
 *   - "keyword list": four or more tokens, all plain lower case, no capital and no
 *     punctuation. That is a search index (`home top start seti pay name`), not copy a
 *     reader meets. Short strings of the same shape are left alone: "2 min ago" is copy.
 *
 * The cost is stated rather than hidden: a genuinely lower-case, unpunctuated phrase of
 * four words would be undercounted. The cost of the other choice is worse, because a
 * page padded with class names would clear the floor without a word of copy.
 */
function notProse(literal, before) {
  const s = literal.trim();
  if (!s.includes(' ')) return 'one word: a label, not a sentence';
  if (!/[A-Za-z]/.test(s)) return 'no letters';
  if (s.includes('${')) return 'built at runtime: the count cannot see what it becomes';
  if (s.includes('var(--')) return 'a CSS variable reference';
  if (s.includes(':')) return 'a class or namespace separator';
  if (s.includes('/')) return 'a path';
  if (s.includes('#')) return 'an anchor or a colour';
  if (/(?:^|\s)(?:title|alt|placeholder)=$/.test(before)) return 'an attribute value';
  if (CLASS_PREFIX.test(s)) return 'a class list';
  if (PATH_DATA.test(s)) return 'SVG path data';
  if (/^use (?:client|server)$/.test(s)) return 'a module directive';
  const tokens = s.split(/\s+/);
  if (tokens.every((t) => UTILITY_TOKEN.test(t)) && tokens.some((t) => /[-[\]._%]/.test(t)))
    return 'a class list: every token is a utility';
  if (tokens.length >= 4 && tokens.every((t) => PLAIN_TOKEN.test(t)))
    return 'a keyword list: no capital and no punctuation';
  return null;
}

/** The prose literals the landing ships, and the words in them. */
function landingProse() {
  const files = [...walkTree(LANDING), HOME].filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f));
  const perFile = [];
  let words = 0;
  for (const file of files) {
    const code = stripComments(read(file) ?? '');
    let n = 0;
    for (const { value, before } of literalsWithContext(code)) {
      if (notProse(value, before)) continue;
      n += value.trim().split(/\s+/).length;
    }
    if (n > 0) perFile.push({ file, words: n });
    words += n;
  }
  perFile.sort((a, b) => b.words - a.words);
  return { words, perFile };
}

const prose = landingProse();
const largest = prose.perFile.slice(0, 3).map((p) => `${rel(p.file)}:${p.words}`).join(', ');
if (prose.words >= WORD_FLOOR.min && prose.words <= WORD_FLOOR.max) {
  pass(
    `8. the landing ships ${WORD_FLOOR.min}-${WORD_FLOOR.max} words of copy`,
    `${prose.words} words in ${prose.perFile.length} files, from constants only`,
  );
} else if (prose.words < WORD_FLOOR.min) {
  fail(
    `8. the landing ships ${WORD_FLOOR.min}-${WORD_FLOOR.max} words of copy`,
    `${prose.words} words, ${WORD_FLOOR.min - prose.words} short. largest: ${largest}`,
    `add copy to the landing (a band, or a paragraph in one): below ${WORD_FLOOR.min} words a crawler has little to quote and the page competes for nothing. Do not lower WORD_FLOOR to make this line pass, and remember this counts copy constants only, so read what the page renders before deciding the copy is thin`,
  );
} else {
  fail(
    `8. the landing ships ${WORD_FLOOR.min}-${WORD_FLOOR.max} words of copy`,
    `${prose.words} words, ${prose.words - WORD_FLOOR.max} over. largest: ${largest}`,
    `cut copy from the landing: past ${WORD_FLOOR.max} words the page has started restating itself, which is the failure it has been corrected for more than once`,
  );
}

// ---------------------------------------------------------------------------------
// 9. the heading outline
// ---------------------------------------------------------------------------------
/**
 * A BAND IS DISCOVERED BY SHAPE, NOT BY NAME. A band opens a section of the page, which
 * it does by rendering the shared `Reveal` wrapper or a bare `<section>`. Names are
 * avoided on purpose: a band added under a name this file did not predict is the case
 * this assertion has to survive, and `Reveal` itself is excluded because it renders the
 * `<section>` it is handed rather than a band of its own.
 */
const BAND_SHELL = /<Reveal\b|<section\b/;
const LANDING_INFRA = new Set(['Reveal', 'SectionHeader', 'SectionEyebrow', 'LandingBackdrop']);

const bandFiles = walkTree(LANDING)
  .filter((f) => path.dirname(f) === LANDING && f.endsWith('.tsx'))
  .filter((f) => !LANDING_INFRA.has(path.basename(f, '.tsx')))
  .filter((f) => BAND_SHELL.test(stripComments(read(f) ?? '')));

if (bandFiles.length === 0) {
  fail(
    '9a. the landing tree has bands to outline',
    `no top-level component under ${rel(LANDING)} renders <Reveal> or <section>`,
    'the bands moved or lost their wrapper: point LANDING in scripts/check-seo.mjs at them. A page with no band is a page with no outline, whatever its h1 says',
  );
} else {
  pass('9a. the landing tree has bands to outline', `${bandFiles.length}: ${bandFiles.map((f) => path.basename(f, '.tsx')).join(', ')}`);
}

/**
 * ONE h2 FROM THE SHARED HEADER, WHICHEVER BRANCH IT TAKES.
 *
 * `SectionHeader` renders a literal `<h2>` when it is handed a title and hands the
 * eyebrow `as={title ? 'p' : 'h2'}` when it is not, so a band using it has exactly one
 * h2 either way. Both halves are asserted: a header that hardcoded the eyebrow to `h2`
 * would give two headings to every band with a title, and one that stopped passing `as`
 * would leave the three title-less bands with no heading at all, silently, which is the
 * failure an outline check exists to catch.
 */
const sectionHeaderPath = path.join(LANDING, 'SectionHeader.tsx');
const sectionHeaderSource = read(sectionHeaderPath);
if (sectionHeaderSource === null) {
  fail(
    '9b. SectionHeader yields exactly one h2 with or without a title',
    `${rel(sectionHeaderPath)} not found`,
    'restore SectionHeader: every band over h3 titles takes its heading from it, and without it their outline is whatever each band guessed',
  );
} else {
  const headerCode = stripComments(sectionHeaderSource);
  const hasTitleH2 = /<h2\b/.test(headerCode);
  const eyebrowAs = headerCode.match(/<SectionEyebrow\b[\s\S]{0,300}?\bas\s*=\s*\{([^}]*)\}/);
  const conditional =
    eyebrowAs !== null && /\btitle\b/.test(eyebrowAs[1]) && /['"]h2['"]/.test(eyebrowAs[1]);
  if (hasTitleH2 && conditional) {
    pass('9b. SectionHeader yields exactly one h2 with or without a title', 'literal h2 for a title, eyebrow promoted on the title-less branch');
  } else {
    fail(
      '9b. SectionHeader yields exactly one h2 with or without a title',
      [
        hasTitleH2 ? null : 'no literal <h2> for the title branch',
        conditional ? null : `eyebrow \`as\` is ${eyebrowAs ? `\`${eyebrowAs[1].trim()}\`` : 'not passed'}, so it is not tied to whether there is a title`,
      ]
        .filter(Boolean)
        .join('; '),
      `make ${rel(sectionHeaderPath)} render one h2 in each branch: a literal <h2> for the title, and as={title ? 'p' : 'h2'} on the eyebrow. Hardcoding either one gives a band two headings or none`,
    );
  }
}

/** No heading deeper than h3 anywhere in the landing: the outline never skips a level. */
const deepHeadings = [];
for (const file of walkTree(LANDING).filter((f) => /\.tsx$/.test(f))) {
  const sites = headingSites(stripComments(read(file) ?? '')).filter((s) => s.level >= 4);
  if (sites.length) deepHeadings.push(`${rel(file)} (${sites.map((s) => `h${s.level}`).join(' ')})`);
}
if (deepHeadings.length === 0) {
  pass('9c. no landing heading is deeper than h3', 'h1 in the hero, h2 per band, h3 per item');
} else {
  fail(
    '9c. no landing heading is deeper than h3',
    deepHeadings.join(', '),
    'demote these to h3 or to a paragraph: an outline that reaches h4 under an h3 item says the page has a level it never introduced',
  );
}

/**
 * ONE h2 PER BAND, AN h3 PER ITEM, AND EVERY ITEM TITLE FROM THE BAND'S OWN CONSTANTS.
 *
 * Per band, from the band's own file and the components it renders inside a `.map`:
 *
 *   - at most one h2, and exactly one in any band that also renders an h3. A band that
 *     starts its outline at h3 is a band whose heading either went missing or was never
 *     one, and no crawler can tell an item from a section there.
 *   - an h1 and an h2 in the same band is two subjects on one page.
 *   - every h3 sits inside a `.map` over a list the band declares in a `*.constants`
 *     module, or reads an item field directly. That is what makes the count of headings
 *     follow the count of items, and it is what stops a band restating its items inline
 *     so the copy and the schema can drift apart later.
 *   - a list whose items carry a `title` renders those titles as an h3, or as a `dt` in a
 *     definition list. `dt` is allowed because two bands are genuinely lists of terms and
 *     a term announced as a heading reads as a section (see the note printed for one of
 *     them); a title rendered as a `p` or a `div` is what this fails on.
 */
for (const band of bandFiles) {
  const name = path.basename(band, '.tsx');
  const code = stripComments(read(band) ?? '');
  const problems = [];

  const own = headingSites(code);
  const usesHeader = /<SectionHeader\b/.test(code);
  const h2Count = own.filter((s) => s.level === 2).length + (usesHeader ? 1 : 0);
  const h1Count = own.filter((s) => s.level === 1).length;
  const ownH3 = own.filter((s) => s.level === 3).length;

  if (h1Count > 0 && h2Count > 0) problems.push(`an h1 and ${h2Count} h2`);
  if (h2Count > 1) problems.push(`${h2Count} h2 (one band, one heading)`);

  const constantsFiles = localImports(code)
    .filter((spec) => spec.endsWith('.constants'))
    .map((spec) => path.join(LANDING, `${spec.slice(2)}.ts`))
    .filter((file) => existsSync(file));
  const constantsNames = constantsFiles.flatMap((file) => importedNames(code, path.basename(file, '.ts')));
  const lists = constantsFiles.flatMap((file) =>
    itemLists(stripComments(read(file) ?? '')).map((list) => ({ ...list, file })),
  );

  const blocks = mapBlocks(code);
  const sitesPerBlock = blocks.map((block) => {
    const inline = headingSites(block.body).filter((s) => s.level === 3);
    if (inline.length > 0) return { target: block.target, inline, child: [], body: block.body };
    // A band can own the row in a child: FaqItem and MoneyCard both hold the h3 their
    // band maps over. One hop is enough, and it is resolved by name for that reason.
    let child = [];
    for (const match of block.body.matchAll(/<([A-Z][\w]*)\b/g)) {
      const childPath = path.join(LANDING, `${match[1]}.tsx`);
      if (!existsSync(childPath)) continue;
      child = child.concat(headingSites(stripComments(read(childPath) ?? '')).filter((s) => s.level === 3));
    }
    return { target: block.target, inline, child, body: block.body };
  });

  const inlineH3 = sitesPerBlock.reduce((n, b) => n + b.inline.length, 0);
  const childH3 = sitesPerBlock.reduce((n, b) => n + b.child.length, 0);
  const h3Sites = ownH3 + childH3;
  const perBlock = (block) => block.inline.length + block.child.length;
  if (h3Sites > 0 && h2Count === 0) {
    problems.push('h3 item titles under no h2: the outline starts at h3');
  }
  if (ownH3 > inlineH3) {
    problems.push(`${ownH3 - inlineH3} h3 in ${name} outside any .map over its constants: an item title that is not read from an item is a section heading in the wrong element`);
  }

  // every h3 must be one of the item titles, not a second heading in disguise
  for (const block of sitesPerBlock) {
    if (perBlock(block) === 0) continue;
    if (!constantsNames.some((ident) => block.target.split('.')[0] === ident)) {
      problems.push(`${block.target}.map renders headings but ${block.target.split('.')[0]} is not imported from a *.constants module`);
    }
    if (perBlock(block) > 1) {
      problems.push(`${perBlock(block)} h3 render paths in the ${block.target} map: an item has one title`);
    }
  }

  const titledLists = lists.filter((list) => list.fields.includes('title'));

  for (const list of titledLists) {
    const block = sitesPerBlock.find((b) => b.target.endsWith(`.${list.key}`));
    if (block && perBlock(block) > 0) continue;
    // a term list is legitimate: dt/dd for "a phone, and what it needs"
    const termList = blocks.some(
      (b) => b.target.endsWith(`.${list.key}`) && /<dt\b[\s\S]{0,200}?\.title\b/.test(b.body),
    );
    if (termList) continue;
    problems.push(`${list.owner}.${list.key} declares ${list.count} titles and none is rendered as an h3 or a dt`);
  }

  const detail = `${h2Count} h2, ${h3Sites} h3 render path(s) from ${lists.length} constant list(s)`;
  if (problems.length === 0) {
    pass(`9d. ${name}: one h2, and an h3 per item title`, detail);
  } else {
    fail(
      `9d. ${name}: one h2, and an h3 per item title`,
      problems.join('; '),
      `give ${rel(band)} one h2 (a SectionHeader, or a literal h2) and render each item title from its constants as an h3. A band whose heading level is inherited rather than declared is a band the outline cannot see`,
    );
  }

  if (ownH3 === 0 && titledLists.length > 0 && problems.length === 0) {
    console.log(`note  9d. ${name}: item titles are dt terms, not h3 (a definition list, so the outline has no h3 here)`);
  }
}

// ---------------------------------------------------------------------------------
// 10. the FAQ's structured data
// ---------------------------------------------------------------------------------
/**
 * THE FAQ IS THE ONE BAND A SEARCH RESULT CAN QUOTE WORD FOR WORD, so it is the one band
 * whose markup and whose JSON-LD have to be the same strings. Four things are asserted,
 * and each of them is a way that promise breaks:
 *
 *   1. the band's questions and answers exist as ONE constant, and the band renders it;
 *   2. the `FAQPage` node lives in `web/lib/faq-schema.ts`, is imported by the module the
 *      layout renders, and declares the type a search engine looks for;
 *   3. the node is a projection of the band's constant, not a second list: it imports the
 *      constants module, maps over the band's own items, and no answer string is written
 *      a second time anywhere under `web/`;
 *   4. every answer is in the component tree, not behind a click: no `<details>`, no
 *      `useState`, no client component in the band's files, and the answer field is read
 *      by the band's JSX. A collapsible FAQ is an FAQ no crawler reads.
 */
const FAQ_QUESTIONS = /\bquestion\s*:\s*(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g;
const FAQ_ANSWERS = /\banswer\s*:\s*(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g;

/** The landing constants module that declares the questions, with what it declares. */
function faqCopy() {
  let best = null;
  for (const file of walkTree(LANDING).filter((f) => /\.(ts|tsx)$/.test(f))) {
    const code = stripComments(read(file) ?? '');
    const questions = [...code.matchAll(FAQ_QUESTIONS)].map((m) => m[2]);
    if (questions.length === 0) continue;
    if (best === null || questions.length > best.questions.length) best = { file, code, questions };
  }
  if (best === null) return null;
  const answers = [...best.code.matchAll(FAQ_ANSWERS)].map((m) => m[2]);
  const owner = best.code.match(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)[^=]*=\s*\{/);
  return {
    file: best.file,
    basename: path.basename(best.file, '.ts'),
    questions: best.questions,
    answers,
    owner: owner ? owner[1] : null,
  };
}

const faq = faqCopy();
if (faq === null) {
  fail(
    '10a. the FAQ band declares its questions in one constant',
    `no file under ${rel(LANDING)} declares \`question:\` and \`answer:\` items`,
    'create the FAQ band\'s copy as `*.constants.ts` items carrying `question` and `answer`: that constant is the only place either string may live, because the band and the JSON-LD both read it',
  );
  console.log('note  10b-10h. the FAQ structured data is not checked (there is no FAQ copy to check)');
} else {
  pass(
    '10a. the FAQ band declares its questions in one constant',
    `${faq.questions.length} questions, ${faq.answers.length} answers in ${rel(faq.file)}`,
  );

  if (faq.answers.length !== faq.questions.length) {
    fail(
      '10a. every question has an answer',
      `${faq.questions.length} questions, ${faq.answers.length} answers`,
      `give every item in ${rel(faq.file)} an \`answer\`: a Question node with no acceptedAnswer is a node Google drops`,
    );
  } else {
    pass('10a. every question has an answer', `${faq.answers.length} pairs`);
  }

  // 10b. the band renders the constant, not a copy of it
  const faqComponents = walkTree(LANDING)
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => {
      const code = stripComments(read(f) ?? '');
      return code.includes(`./${faq.basename}'`) || code.includes(`./${faq.basename}"`);
    });
  const rendersItems =
    faq.owner !== null &&
    faqComponents.some((f) => {
      const code = stripComments(read(f) ?? '');
      return mapBlocks(code).some((b) => b.target === faq.owner || b.target.startsWith(`${faq.owner}.`));
    });
  if (faqComponents.length === 0 || !rendersItems) {
    fail(
      '10b. the FAQ band renders the questions it declares',
      faqComponents.length === 0
        ? `no .tsx under ${rel(LANDING)} imports ${faq.basename}`
        : `${faqComponents.map(rel).join(', ')} imports it but maps over nothing of ${faq.owner}`,
      `render ${faq.owner}.items in the FAQ band with a .map over that constant: an answer a band builds inline is an answer the schema cannot be checked against`,
    );
  } else {
    pass('10b. the FAQ band renders the questions it declares', `${faqComponents.map((f) => path.basename(f)).join(', ')} maps ${faq.owner}`);
  }

  // 10c. the node exists, where it belongs, and is the right type
  const faqSchemaPath = path.join(WEB, 'lib/faq-schema.ts');
  const faqSchemaSource = read(faqSchemaPath);
  if (faqSchemaSource === null) {
    fail(
      '10c. web/lib/faq-schema.ts declares the FAQPage node',
      `${rel(faqSchemaPath)} not found`,
      `create ${rel(faqSchemaPath)} exporting a node with '@type': 'FAQPage' built from ${faq.owner}: a FAQ nobody marks up is a page a search result can quote without ever crediting the answer`,
    );
    console.log('note  10d-10f. the FAQPage node is not checked (there is no module to read)');
  } else {
    const schemaCode = stripComments(faqSchemaSource);
    if (/'@type'\s*:\s*'FAQPage'|"@type"\s*:\s*"FAQPage"/.test(schemaCode)) {
      pass('10c. web/lib/faq-schema.ts declares the FAQPage node', rel(faqSchemaPath));
    } else {
      fail(
        '10c. web/lib/faq-schema.ts declares the FAQPage node',
        'no `@type: FAQPage`',
        `add an object with '@type': 'FAQPage' to ${rel(faqSchemaPath)}: without the type the node is JSON a crawler reads and ignores`,
      );
    }

    // 10d. built from the band's constants
    if (schemaCode.includes(faq.basename)) {
      pass('10d. the schema is built from the band\'s own constants', `imports ${faq.basename}`);
    } else {
      fail(
        '10d. the schema is built from the band\'s own constants',
        `${rel(faqSchemaPath)} never names ${faq.basename}`,
        `import ${faq.owner} from the band's constants in ${rel(faqSchemaPath)} and build the node from it: a schema with its own array is the drift this whole group exists to prevent, and it will be the answer a search result shows after the page has changed`,
      );
    }

    // 10e. one Question per question, by construction
    const questionNodes = [...schemaCode.matchAll(/'@type'\s*:\s*'Question'|"@type"\s*:\s*"Question"/g)].length;
    const questionsBlocks = mapBlocks(schemaCode).filter((b) => /'@type'\s*:\s*'Question'|"@type"\s*:\s*"Question"/.test(b.body));
    const overFaq = questionsBlocks.some((b) => b.target.startsWith(`${faq.owner}`));
    if (questionNodes === 1 && overFaq) {
      pass(
        '10e. one Question node per question the band renders',
        `1 template mapped over ${faq.owner} (${faq.questions.length} items), so ${faq.questions.length} nodes`,
      );
    } else if (questionNodes === 0) {
      fail(
        '10e. one Question node per question the band renders',
        'no `@type: Question` in the node',
        `map ${faq.owner}.items into mainEntity entries with '@type': 'Question' in ${rel(faqSchemaPath)}: a FAQPage with no Question has nothing for a result to quote`,
      );
    } else if (questionNodes !== 1) {
      fail(
        '10e. one Question node per question the band renders',
        `${questionNodes} Question templates`,
        `write one Question template inside a .map over ${faq.owner}.items in ${rel(faqSchemaPath)}: a template per question is a list restated, and it will fall out of step with the band`,
      );
    } else {
      fail(
        '10e. one Question node per question the band renders',
        `the Question template is not inside a .map over ${faq.owner}`,
        `map ${faq.owner}.items in ${rel(faqSchemaPath)} so the number of nodes is the number of questions the band renders, by construction rather than by hand`,
      );
    }

    // 10f. the fields are the band's strings, not new ones
    const readsQuestion = new RegExp(String.raw`name\s*:\s*[\w$.[\]]*\.question\b`).test(schemaCode);
    const readsAnswer = new RegExp(String.raw`text\s*:\s*[\w$.[\]]*\.answer\b`).test(schemaCode);
    const restated = faq.answers.filter((answer) => schemaCode.includes(answer));
    if (readsQuestion && readsAnswer && restated.length === 0) {
      pass('10f. the schema reads the band\'s question and answer fields', `${faq.owner}.items[].question / .answer`);
    } else {
      fail(
        '10f. the schema reads the band\'s question and answer fields',
        [
          readsQuestion ? null : 'no `name: ... .question`',
          readsAnswer ? null : 'no `text: ... .answer`',
          restated.length ? `${restated.length} answer string(s) written out in the module` : null,
        ]
          .filter(Boolean)
          .join('; '),
        `in ${rel(faqSchemaPath)} set name from the item's \`question\` and acceptedAnswer.text from its \`answer\`. Do not paste an answer in: the copy a search result shows would then be the one nobody edits`,
      );
    }

    // 10g. every answer string lives in exactly one place under web/
    const duplicated = [];
    if (faq.answers.length) {
      const files = walkTree(WEB).filter((f) => SOURCE_EXTS.has(path.extname(f)));
      for (const answer of faq.answers) {
        const hits = [];
        for (const file of files) {
          const raw = read(file);
          if (raw === null) continue;
          const count = raw.split(answer).length - 1;
          if (count > 0) hits.push(`${rel(file)}${count > 1 ? ` x${count}` : ''}`);
        }
        const elsewhere = hits.filter((hit) => !hit.startsWith(rel(faq.file)));
        if (elsewhere.length || hits.length !== 1) duplicated.push(`"${answer.slice(0, 40)}...": ${hits.join(', ') || 'nowhere'}`);
      }
    }
    if (faq.answers.length === 0) {
      console.log('note  10g. no answer is written twice  (not checked, there are no answers)');
    } else if (duplicated.length === 0) {
      pass('10g. no FAQ answer is written twice anywhere under web/', `${faq.answers.length} answers, one copy each, in ${path.basename(faq.file)}`);
    } else {
      fail(
        '10g. no FAQ answer is written twice anywhere under web/',
        duplicated.join(' | '),
        `keep each answer in ${rel(faq.file)} only: a second copy is the copy that gets missed when the answer changes, and it is what a search result ends up quoting`,
      );
    }

    // 10h. the node the layout renders carries it
    const structuredPath = STRUCTURED_DATA.find((f) => existsSync(f));
    if (!structuredPath) {
      fail('10h. the layout\'s graph carries the FAQPage node', 'no structured-data module', 'restore web/lib/structured-data.ts: the layout renders its graph and nothing else');
    } else {
      const structuredCode = stripComments(read(structuredPath) ?? '');
      const imported = /from\s+['"][^'"]*faq-schema['"]/.test(structuredCode);
      if (imported) {
        pass('10h. the layout\'s graph carries the FAQPage node', `${path.basename(structuredPath)} imports faq-schema`);
      } else {
        fail(
          '10h. the layout\'s graph carries the FAQPage node',
          `${rel(structuredPath)} does not import ${path.basename(faqSchemaPath)}`,
          `import the FAQ nodes into ${rel(structuredPath)} and spread them into siteSchemas: a FAQPage module nothing renders is JSON that ships nowhere`,
        );
      }
    }
  }

  // 10i. the answers are in the tree, not behind an interaction
  const faqFilePaths = new Set(faqComponents);
  for (const file of faqComponents) {
    const code = stripComments(read(file) ?? '');
    for (const block of mapBlocks(code)) {
      // The row can live in a child (FaqItem), so the row's file is part of the band for
      // this question: a control there hides the answer just as effectively.
      for (const match of block.body.matchAll(/<([A-Z][\w]*)\b/g)) {
        const childPath = path.join(LANDING, `${match[1]}.tsx`);
        if (existsSync(childPath)) faqFilePaths.add(childPath);
      }
    }
  }
  const uniqueFaqFiles = [...faqFilePaths];
  const gatedIn = uniqueFaqFiles.filter((f) => {
    const code = stripComments(read(f) ?? '');
    return /<details\b|<summary\b|\buseState\b|\buseReducer\b|['"]use client['"]/.test(code);
  });
  const answerRead = uniqueFaqFiles.some((f) => /\.answer\b/.test(stripComments(read(f) ?? '')));
  if (gatedIn.length === 0 && answerRead) {
    pass('10i. every FAQ answer is rendered, not hidden behind a control', `${uniqueFaqFiles.length} files, no details/summary/useState/client`);
  } else {
    fail(
      '10i. every FAQ answer is rendered, not hidden behind a control',
      [
        gatedIn.length ? `interaction in ${gatedIn.map(rel).join(', ')}` : null,
        answerRead ? null : 'no file reads the answer field',
      ]
        .filter(Boolean)
        .join('; '),
      `render the answers as static text in the FAQ band: a <details>, a useState or a client component means the answer is not in the HTML a crawler and an assistant read, which is the whole reason the FAQ is on the page`,
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
