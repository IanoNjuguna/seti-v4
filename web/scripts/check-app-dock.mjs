/**
 * `npm run check:app-dock` — the app has ONE nav, and it floats (#542); the header
 * above it is the frame (#559).
 *
 * The defect this suite exists for is arrangement and identity, so the assertions are about
 * MEMBERSHIP and GEOMETRY rather than paint: a screenshot proves a dock rendered, it cannot prove
 * that the desktop rail is gone rather than merely hidden, that the dock is a rounded rectangle
 * and not the pill its reference draws, or that the header is a frame across the window rather
 * than a panel hovering over the column.
 *
 * Ten claims:
 *
 *  1. **One nav at every width.** `AppShell` mounts the dock once; the rail and the old bottom bar
 *     are deleted and imported nowhere.
 *  2. **It floats and it does not hide at a breakpoint.** `fixed`, `bottom-0`, centred, and no
 *     `md:hidden` / `hidden md:` pair — the two classes whose removal is the whole point.
 *  3. **Rounded rectangle, not a pill.** A 14px radius on the slab and an 8px radius on the wells;
 *     `rounded-full` appears nowhere in either file.
 *  4. **The head is the lockup: the product's face and its name in one image**, at the size every
 *     chrome surface draws it, and it is not a second way to `/app`.
 *  5. **The header is the frame, not a slab.** Mounted above `main` rather than inside it, edge to
 *     edge with no width cap and no corners, the dock's own black and its own height, its row on the
 *     content column's own `max-w` and padding, and `sticky` — with no edge at rest and a short dim
 *     strip under it only while content is passing beneath. Its grain is drawn at the poster
 *     strength, so the band reads as texture rather than as flat black.
 *  6. **A hairline separates the dock's head from the destinations**, so it cannot be counted as one.
 *  7. **A signed-out visitor has a door**: the dock's tail links to `/signin`.
 *  8. **The reserved space is the dock's own geometry** — inset + slab + hairline + safe area — so
 *     the fixed dock cannot rest on content.
 *  9. **The content column no longer pays for a rail**: no `md:pl-56`, and no `md:ml-56` on the
 *     practice strip.
 * 10. **The brand rule still has an owner**: the lockup map carries both expressions, the three
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
  check('the well is not a circle either', !link.includes('rounded-full'));
  check('the well is the tap target', link.includes('h-11 flex-1'));
}

console.log('the head is in the header, not the dock:');
{
  check('the header draws the lockup, not a lone glyph', topBar.includes('<BrandLockup'));
  check('at the size every other chrome surface uses', topBar.includes('className="h-7"'));
  check('with the friendly face as its default', !topBar.includes('expression='));
  check('and no canvas prop, because the artwork has one ink', !topBar.includes('canvas='));
  check('the lockup is the way home', /<Link[\s\S]{0,200}href=\{APP_HOME_PATH\}/.test(topBar));
  check('and the dock\'s Home item takes the same route', read('../components/app/AppNav.constants.ts').includes('href: APP_HOME_PATH'));

  check('the dock carries no mark at all', !dock.includes('BrandMark'));
  check('and no sign-in control', !dock.includes('SIGN_IN_PATH'));
}

console.log('the header is the frame, and the dock is the object:');
{
  check('the shell mounts the header once', (shell.match(/<AppTopBar \/>/g) ?? []).length === 1);
  check('above the content column, not inside it', shell.indexOf('<AppTopBar />') < shell.indexOf('<main'));
  check('the header is full-bleed, so it carries no width cap', !topBar.includes('max-w-[26rem]') && !topBar.includes('max-w-none'));
  const headerTag = topBar.match(/<header className="([^"]+)"/)?.[1] ?? '';
  check('and no corners on the frame itself', !/rounded/.test(headerTag));
  check('no edge is painted at rest', !topBar.includes('border-b'));
  check('it is the dock\'s own black, not a grey wash', topBar.includes('bg-canvas-dark text-on-dark'));
  check('the edge is earned, only once content is under it', topBar.includes('scrolled &&') && topBar.includes('top-full'));
  check('and it is a short dim strip, not a drop shadow', topBar.includes('h-1.5') && topBar.includes('from-canvas-dark/30'));
  {
    const scrolledHook = read('../components/app/useScrolled.ts');
    check('the scroll read is throttled to a frame', scrolledHook.includes('requestAnimationFrame'));
    check('and its listener is passive', scrolledHook.includes('passive: true'));
  }
  check('its row is the page column', topBar.includes('max-w-3xl') && topBar.includes('px-5'));
  check('it is the dock\'s own height', topBar.includes('h-[var(--app-nav-bar)]'));
  check('with the chrome grain across the band', topBar.includes('chrome-grain') && dock.includes('chrome-grain'));
  check('at the poster strength, so it reads on a full-width band', topBar.includes('--app-grain-highlight:0.10') && topBar.includes('--app-grain-shadow:0.12'));
  check('and the dock keeps the pair its 12px labels need', !dock.includes('--app-grain-'));
  check('it sticks, so the state it carries stays visible', /className="sticky top-0/.test(topBar));
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
  check('in the app\'s action fill, the one "Claim your name" carries', state.includes('bg-accent-lime'));
  check('labelled in ink, because white measures 1.64:1 on it', state.includes('color="primary"'));
  check('with a hover that steps the fill, not the label', state.includes('hover:bg-accent-lime-deep'));
  check('signed in, the row names the account by its handle', state.includes('@${handle}') && state.includes('href="/app/profile"'));
  check('and draws no second product face', !state.includes('<Mark'));
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
  /* The radius is asserted on the RENDERED markup and against the token scale, because the first
     version of this check asserted the class `rounded-lg` while its comment claimed 8px: `lg` is
     20px in this project, so the well rendered a capsule and the check agreed with it (#559). */
  check('the well is the 12px step: square with round edges', html.includes('rounded-md') && !html.includes('rounded-lg'));
  check('and the scale really is 12px and 20px for those two steps', css.includes('--radius-md: 12px') && css.includes('--radius-lg: 20px'));
}

console.log(`\n${passed} assertions passed.`);
if (failed > 0) {
  console.log(`${failed} FAILED.`);
  process.exit(1);
}
