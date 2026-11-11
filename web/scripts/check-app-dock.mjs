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
const signIn = read('../components/app/DockSignIn.tsx');
const css = read('../app/globals.css');
const practice = read('../components/app/PracticeFrame.tsx');

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
  check('the well is the tap target', link.includes('h-11 min-w-11'));
}

console.log('the head is the friendly mark, and not a destination:');
{
  check('the dock draws BrandMark', dock.includes('<BrandMark'));
  check('with the friendly expression', dock.includes('expression="friendly"'));
  check('on the dark colourway', dock.includes('canvas="dark"'));
  check('at the glyphs\' own size', dock.includes('className="h-6"'));
  check('and it is not a link to /app', !dock.includes('href="/app"'));
  check('a hairline separates it from the destinations', dock.includes('bg-hairline-dark'));
}

console.log('a signed-out visitor still has a door:');
{
  check('the dock renders the sign-in control', dock.includes('<DockSignIn />'));
  check('which links to the front door', signIn.includes('SIGN_IN_PATH'));
  check('and says nothing when signed in', signIn.includes("session.status === 'signed-in'") && signIn.includes('return null'));
  check('and does not tell a restoring visitor to sign in', signIn.includes("session.status === 'restoring'"));
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
  check('no rail margin on the practice strip', !/className="[^"]*md:ml-56/.test(practice));
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
