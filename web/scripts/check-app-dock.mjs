/**
 * `npm run check:app-dock` — the app has ONE nav, and it floats (#542).
 *
 * The defect this suite exists for is arrangement and identity, so the assertions are about
 * MEMBERSHIP and GEOMETRY rather than paint: a screenshot proves a dock rendered, it cannot prove
 * that the desktop rail is gone rather than merely hidden, that the dock is a rounded rectangle
 * and not the pill its reference draws, or that a signed-out visitor still has a door.
 *
 * Nine claims:
 *
 *  1. **One nav at every width.** `AppShell` mounts the dock once; the rail and the old bottom bar
 *     are deleted and imported nowhere.
 *  2. **It floats and it does not hide at a breakpoint.** `fixed`, `bottom-0`, centred, and no
 *     `md:hidden` / `hidden md:` pair — the two classes whose removal is the whole point.
 *  3. **Rounded rectangle, not a pill.** A 14px radius on the slab and an 8px radius on the wells;
 *     `rounded-full` appears nowhere in either file.
 *  4. **The head is the mark, wearing the friendly face**, on the dark colourway, and it is not a
 *     second way to `/app`.
 *  5. **A hairline separates the head from the destinations**, so it cannot be counted as one.
 *  6. **A signed-out visitor has a door**: the dock's tail links to `/signin`.
 *  7. **The reserved space is the dock's own geometry** — inset + slab + hairline + safe area — so
 *     the fixed dock cannot rest on content.
 *  8. **The content column no longer pays for a rail**: no `md:pl-56`, and no `md:ml-56` on the
 *     practice strip.
 *  9. **The brand rule still has an owner**: the lockup map carries both expressions, the three
 *     chrome surfaces draw the lockup, and a document draws `neutral` explicitly.
 *
 * Run from `web/`: npm run check:app-dock (part of the root `verify` gate).
 */
import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppNavLink } from '../components/app/AppNavLink.tsx';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const shell = read('../components/app/AppShell.tsx');
const dock = read('../components/app/AppDock.tsx');
const link = read('../components/app/AppNavLink.tsx');
const topBar = read('../components/app/AppTopBar.tsx');
const state = read('../components/app/TopBarState.tsx');
const css = read('../app/globals.css');

console.log('one nav, at every width:');
{
  check('the shell mounts the dock', shell.includes('<AppDock />'));
  check('exactly once', (shell.match(/<AppDock \/>/g) ?? []).length === 1);
  check('and mounts nothing else as nav', !/<App(Nav|Rail)\b/.test(shell));

  for (const name of ['AppRail', 'AppNav']) {
    const file = new URL(`../components/app/${name}.tsx`, import.meta.url);
    check(`${name}.tsx is deleted`, !existsSync(file));
  }

  const railParts = ['RailNetworkRow', 'RailIdentityCard', 'RailIdentitySignedOut'];
  for (const name of railParts) {
    const file = new URL(`../components/app/${name}.tsx`, import.meta.url);
    check(`${name}.tsx is deleted`, !existsSync(file));
    check(`and ${name} is imported nowhere`, !read('../components/app/AppShell.tsx').includes(name));
  }
}

console.log('it floats, and it does not hide at a breakpoint:');
{
  check('the wrapper is fixed to the bottom', dock.includes('fixed inset-x-0 bottom-0'));
  check('and centres the slab', dock.includes('justify-center'));
  check('the slab sits off the bottom edge by the inset token', dock.includes('pb-[calc(var(--app-nav-inset)'));
  check('the old bar\'s md:hidden is gone', !dock.includes('md:hidden'));
  check('the old rail\'s hidden md:flex is gone', !dock.includes('hidden md:flex'));
  check('the grain is clipped to the slab', dock.includes('overflow-hidden'));
}

console.log('a rounded rectangle, not a pill:');
{
  check('the slab has a 14px radius', dock.includes('rounded-[14px]'));
  check('and no pill radius', !dock.includes('rounded-full'));
  check('the wells have an 8px radius', link.includes('rounded-lg'));
  check('and are not circles', !link.includes('rounded-full'));
  check('the well is the tap target', link.includes('h-11 flex-1'));
}

console.log('the head is in the header, not the dock:');
{
  check('the header draws BrandMark', topBar.includes('<BrandMark'));
  check('with the friendly expression', topBar.includes('expression="friendly"'));
  check('on the dark colourway', topBar.includes('canvas="dark"'));
  check('larger than the glyphs it sits above', topBar.includes('className="h-7"'));
  check('and it is not a link to /app', !topBar.includes('href="/app"'));

  check('the dock carries no mark at all', !dock.includes('BrandMark'));
  check('and no sign-in control', !dock.includes('SIGN_IN_PATH'));
}

console.log('the header and the dock are one system:');
{
  check('the shell mounts the header once', (shell.match(/<AppTopBar \/>/g) ?? []).length === 1);
  check('both slabs cap at the same width', topBar.includes('max-w-[26rem]') && dock.includes('max-w-[26rem]'));
  check('the header is a rounded slab too', topBar.includes('rounded-[14px]'));
  check('with the chrome grain', topBar.includes('chrome-grain') && dock.includes('chrome-grain'));
  check('it sticks, so the state it carries stays visible', /className="sticky [?a-z0-9:.-]*/.test(topBar));
  check('and it is not fixed', !/className="[^"]*\bfixed\b/.test(topBar));
}

console.log('the dock spreads its three destinations:');
{
  check('each item takes an equal share', link.includes('flex-1'));
  check('the slab is full width up to its cap', dock.includes('w-full max-w-[26rem]'));
  check('and no divider crowds them', !dock.includes('w-px'));
}

console.log('a signed-out visitor still has a door:');
{
  check('the header renders the state slot', topBar.includes('<TopBarState />'));
  check('which links to the front door', state.includes('SIGN_IN_PATH'));
  check('signed in, the row is the account mark', state.includes('<Mark size="sm"'));
  check('and it opens the profile', state.includes('href="/app/profile"'));
  check('never an empty right-hand slot', !state.includes('return null'));
  check('and does not tell a restoring visitor to sign in', state.includes("session.status === 'restoring'"));
  check('practice is stated there too, linking to where it is switched', state.includes('practice') && state.includes('/app/profile'));
  check('in the attention ink the practice strip used', state.includes('color="attention"'));
  check('both controls are a full touch target', (state.match(/h-11/g) ?? []).length >= 2);
}

console.log('the reserved space is the dock\'s own geometry:');
{
  check('there is an inset token', css.includes('--app-nav-inset: 1rem'));
  check('the slab keeps the doc\'s row height', css.includes('--app-nav-bar: 4rem'));
  check('and the reservation adds all four pieces', /--app-nav-reserved:\s*calc\([\s\S]{0,200}var\(--app-nav-inset\)[\s\S]{0,120}var\(--app-nav-bar\)[\s\S]{0,120}env\(safe-area-inset-bottom\)/.test(css));
  check('the shell reserves the dock plus its clearance', shell.includes('--app-nav-reserved') && shell.includes('--app-nav-clearance'));
}

console.log('the content column no longer pays for a rail:');
{
  check('no rail offset on the shell', !shell.includes('md:pl-56'));
  check('and no practice strip is left to double-state it', !existsSync(new URL('../components/app/PracticeFrame.tsx', import.meta.url)));
}

console.log('the brand rule has one owner, and it is the component:');
{
  const constants = read('../components/ui/BrandMark.constants.ts');
  check('the lockup is drawn per expression', constants.includes('BRAND_LOCKUP_SRC: Record<BrandExpression, string>'));
  check('friendly has its own artwork', constants.includes("friendly: '/seti-lockup-friendly.png'"));

  const mark = read('../components/ui/BrandMark.tsx');
  check('the rule names chrome for friendly', /friendly`? — every CHROME surface/.test(mark));
  check('and documents for neutral', /neutral`? — DOCUMENTS/.test(mark));

  for (const surface of ['landing/LandingNav', 'landing/FooterRail', 'marketing/MarketingHeader']) {
    const source = read(`../app/components/${surface}.tsx`);
    check(`${surface} draws the lockup`, source.includes('<BrandLockup'));
    check(`${surface} does not pin the face`, !source.includes('expression='));
  }

  const legal = read('../app/legal/LegalDocument.tsx');
  check('a document still draws the neutral face', legal.includes('expression="neutral"'));
}

console.log('one destination, rendered:');
{
  const html = renderToStaticMarkup(
    createElement(AppNavLink, {
      item: { href: '/app/activity', label: 'Activity', icon: 'activity' },
      active: true,
    })
  );

  check('the label is drawn, not only the glyph', html.includes('Activity'));
  check('the active destination is a filled well', html.includes('bg-surface-elevated'));
  check('and it says so to a screen reader', html.includes('aria-current="page"'));
  check('the well is rounded, not round', html.includes('rounded-lg') && !html.includes('rounded-full'));
}

console.log(`\n${passed} assertions passed.`);
if (failed > 0) {
  console.log(`${failed} FAILED.`);
  process.exit(1);
}
