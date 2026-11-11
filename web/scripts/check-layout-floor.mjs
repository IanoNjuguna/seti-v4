/**
 * `npm run check:layout-floor` — what the phone-width audit found, held so it cannot come back (#562).
 *
 * The audit itself was a browser pass (six widths, touch emulation, a throttled connection) and it found
 * four defects, none of them visible at 390 on a desk. Three claims hold them, each asserting the
 * mechanism rather than the picture:
 *
 *  1. **A tap target's box is not its artwork.** The header's lockup is 28px tall, so the link measured
 *     77x28 and sat under the app's 44px floor. The link now carries `min-h-11 min-w-11` while the
 *     artwork stays `h-7`, which is the distinction being asserted: the FLOOR grew, the picture did not.
 *  2. **A button recipe's padding is wrong for a tile, and `cn()` joins rather than merges.** The home
 *     tiles asked for `px-2`, lost to the recipe's `px-7` by emission order, and put a 65px word in a
 *     4px content box at 320. The fix is an important utility (`px-1!`, the only thing that beats an
 *     emitted one) plus two-per-row below 400px.
 *  3. **A visitor keeps the page they are on.** Receive's signed-out branch returned the prompt BARE, so
 *     the route lost its title and its back control at the moment a visitor reached it; Profile's
 *     visitor state had no `h1` at all. Both frames are asserted here, and so is the exception that
 *     Profile has no back control: it is a dock destination, and a tab has nowhere back to.
 *
 * The rendered numbers that prove the fixes (77x28 → 77x44; `scrollWidth 62 > clientWidth 60` → fitting
 * tiles at 320, 360 and 414; the received frame at 390) are in the pull request's screenshots; a class
 * scan cannot re-measure them, so it asserts the mechanism and says so here rather than pretending to be
 * the browser.
 *
 * Run from `web/`: npm run check:layout-floor (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';

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

const topBar = read('../components/app/AppTopBar.tsx');
const homeAction = read('../components/home/HomeAction.tsx');
const actions = read('../components/home/HomeActions.tsx');

console.log('a tap target is its box, not its picture:');
{
  check('the header lockup link carries a height floor', topBar.includes('min-h-11'));
  check('and a width floor', topBar.includes('min-w-11'));
  check('while the artwork stays the size it is drawn at', topBar.includes('<BrandLockup className="h-7"'));
  check('so the floor is not faked by scaling the brand', !topBar.includes('<BrandLockup className="h-11"'));
}

console.log('a tile overrides the recipe it borrows:');
{
  check('the tile beats the recipe\'s padding with an important utility', homeAction.includes('px-1!'));
  check('because the borrowed recipe does set 28px a side', read('../components/ui/Button.constants.ts').includes('px-7'));
  check('two per row below 400px, where four columns cannot hold the word', homeAction.includes('max-[399px]:basis-'));
  check('the row is still a wrapping flex, so that basis can take effect', actions.includes('flex flex-wrap'));
}

console.log('a visitor keeps the page they are on:');
{
  const receive = read('../components/receive/ReceiveScreen.tsx');
  const profile = read('../components/profile/ProfileSignedOut.tsx');

  check('the signed-out Receive branch draws the page frame', /status === 'signed-out'[\s\S]{0,400}<PageHeader/.test(receive));
  check('with the prompt inside that frame, not instead of it', /status === 'signed-out'[\s\S]{0,600}<SignInCard/.test(receive));
  check('and it does not return the bare card', !/status === 'signed-out'\) return <SignInCard/.test(receive));

  check('the visitor\'s Profile has a heading', profile.includes('as="h1"') && profile.includes('PROFILE_PAGE_COPY.title'));
  check('and no back control, because a tab has nowhere back to', !profile.includes('PageBack') && !profile.includes('PageHeader'));
  check('the title it draws exists for that state', read('../components/profile/ProfilePage.constants.ts').includes("title: 'Profile'"));
}

console.log(`\n${passed} assertions passed.`);
if (failed > 0) {
  console.log(`${failed} FAILED.`);
  process.exit(1);
}
