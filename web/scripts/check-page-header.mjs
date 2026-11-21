/**
 * `npm run check:page-header` — the back control and the page title share one row (#438).
 *
 * The defect this suite exists for was layout, not logic: `PageBack` was the word `Back` in 14px
 * semibold with `8px 16px 8px 12px` of padding and no visible container, sitting on the row ABOVE
 * every page title. That put the label 12px right of the column edge every other element starts on,
 * cost 44px plus a gap before the heading, and left a control whose resting state was invisible but
 * whose hover painted a rectangle.
 *
 * Six claims:
 *
 *  1. **The header is one row.** The real component server-renders the control and an `<h1>` as
 *     siblings of a single flex row, and the heading's text is the title.
 *  2. **The control is a link, not a script call.** It carries `href`, so it works cold from a
 *     bookmark, and `aria-label` + `title`, so a glyph-only control is still named.
 *  3. **Its geometry is the icon button's**, from the shared constant: 44px, a circle, the focus
 *     ring. A back control five pixels off the button beside it is the drift being prevented.
 *  4. **Its resting state has no fill**, and hover does.
 *  5. **A centred heading keeps the control on the leading edge** rather than shifting the heading
 *     off-centre by the control's width.
 *  6. **No surface renders PageBack by hand.** Every full-page surface goes through PageHeader, so
 *     the next page added cannot reintroduce the two-row header.
 *
 * Run from `web/`: npm run check:page-header (part of the root `verify` gate).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageHeader } from '../components/app/PageHeader.tsx';
import { PageBack } from '../components/app/PageBack.tsx';
import { ICON_CONTROL_CLASS } from '../components/ui/IconButton.constants.ts';

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
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

console.log('the header is one row, control then heading:');
{
  const html = renderToStaticMarkup(createElement(PageHeader, { title: 'Save' }));

  check('it renders exactly one row', (html.match(/flex items-center gap-2/g) ?? []).length === 1);
  check('the control comes before the heading', html.indexOf('<a') < html.indexOf('<h1'));
  check('and the heading carries the title', /<h1[^>]*>Save<\/h1>/.test(html), html.slice(0, 160));
  check('the control is named, not blank', /<a[^>]*aria-label="Back"/.test(html));
  check('and titled, for a pointer', /<a[^>]*title="Back"/.test(html));
}

console.log('\nthe control is navigation with the icon button geometry:');
{
  const html = renderToStaticMarkup(createElement(PageBack, {}));
  const source = strip(read('../components/app/PageBack.tsx'));

  check('it is a link to the home tab', /href="\/app"/.test(html), html.slice(0, 120));
  check('not a button', !/<button/.test(html));
  check('it has no visible word of its own', !/>\s*Back\s*</.test(html));
  check(
    'it shares the icon-control geometry rather than copying it',
    /ICON_CONTROL_CLASS/.test(source) && !/h-11 w-11 rounded-full/.test(source)
  );
  check(
    'and that geometry is 44px and a circle',
    /h-11/.test(ICON_CONTROL_CLASS) &&
      /w-11/.test(ICON_CONTROL_CLASS) &&
      /rounded-full/.test(ICON_CONTROL_CLASS)
  );
  check('its resting state is unfilled', !/bg-surface-soft(?= .*(?:rounded|h-11))/.test(source));
  check('and it fills on hover', /hover:bg-surface-soft/.test(source));
}

console.log('\na centred heading keeps its control on the leading edge:');
{
  const html = renderToStaticMarkup(
    createElement(PageHeader, { title: 'Receive', align: 'center' })
  );

  check('the row is centred', /justify-center/.test(html));
  check('and the control is taken out of the flow', /absolute left-0/.test(html));
  check(
    'so the heading is not pushed off centre',
    /absolute left-0[\s\S]*<h1/.test(html),
    'the control no longer precedes the heading in that order'
  );
}

console.log('\nno surface renders a back control by hand:');
{
  const roots = ['../app', '../components'];
  const offenders = [];

  const walk = (dir) => {
    for (const entry of readdirSync(new URL(dir, import.meta.url))) {
      const path = join(dir, entry);
      const stat = statSync(new URL(path, import.meta.url));
      if (stat.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.tsx$/.test(entry)) continue;
      if (path.endsWith('PageHeader.tsx') || path.endsWith('PageBack.tsx')) continue;
      const source = read(path);
      if (/<PageBack/.test(source) || /import \{[^}]*PageBack[^}]*\}/.test(source)) {
        offenders.push(path.replace('../', ''));
      }
    }
  };

  roots.forEach(walk);

  check(
    'every page goes through PageHeader',
    offenders.length === 0,
    offenders.join(', ')
  );
  check(
    'and the surfaces that have a heading use it',
    ['components/send/SendFrame.tsx', 'components/save/SaveScreen.tsx', 'components/receive/ReceiveScreen.tsx', 'components/invite/InviteBody.tsx'].every(
      (path) => /<PageHeader/.test(read(`../${path}`))
    )
  );
}

console.log('\nthe bar carries three controls, and the third one opens a menu (#592):');
{
  const bar = strip(read('../components/app/TopBarState.tsx'));
  const chip = strip(read('../components/app/AccountChip.tsx'));
  const barCopy = strip(read('../components/app/TopBar.constants.ts'));
  const routes = strip(read('../lib/routes.ts'));
  const icons = read('../components/ui/icon-paths.constants.ts');

  check(
    'the bell is a link to the notifications route, imported not spelled',
    /href=\{NOTIFICATIONS_PATH\}/.test(bar) && /NOTIFICATIONS_PATH[^;]*from '@\/lib\/routes'/.test(bar)
  );
  check(
    'and that route is the one the page is served at',
    /NOTIFICATIONS_PATH = '\/app\/notifications'/.test(routes)
  );
  check('support is a mailto, so it opens a draft and not a form', /mailto:/.test(barCopy));
  check(
    'both controls share one 44px target rather than restating it',
    /BAR_TARGET/.test(bar) && /h-11/.test(barCopy) && /w-11/.test(barCopy) && !/h-11 w-11/.test(bar)
  );
  check(
    'both glyphs exist in the hand-authored set',
    /^  bell: \[/m.test(icons) && /^  envelope: \[/m.test(icons)
  );
  check('the chip is a control, not a word', /<button/.test(chip) && /aria-haspopup="menu"/.test(chip));
  check('that says whether it is open', /aria-expanded=\{open\}/.test(chip));
  check(
    'its menu carries the three things the bar can do',
    /ACCOUNT_CHIP_COPY\.profile/.test(chip) &&
      /ACCOUNT_CHIP_COPY\.copyPayLink/.test(chip) &&
      /ACCOUNT_CHIP_COPY\.signOut/.test(chip) &&
      /session\.signOut\(\)/.test(chip)
  );
  check(
    'Profile is the route constant, not a literal',
    /href=\{PROFILE_PATH\}/.test(chip) && /PROFILE_PATH = '\/app\/profile'/.test(routes)
  );
  check(
    'and the pay link is the public page, built from the origin it is pasted at',
    /\/u\/\$\{handle\}/.test(chip) && /window\.location\.origin/.test(chip)
  );
  check(
    'two densities: the handle and chevron leave the bar under 640px, the avatar stays',
    /hidden[\s\S]{0,80}sm:block/.test(chip) && /h-10 w-10/.test(chip) && /sm:block/.test(chip)
  );
  check(
    'the handle truncates at a measured width, not by luck',
    /HANDLE_CLIP/.test(chip) && /HANDLE_CLIP = \d+/.test(strip(read('../components/app/AccountChip.constants.ts')))
  );
  check('the menu closes on Escape and on a click outside', /Escape/.test(chip) && /mousedown/.test(chip));
}

console.log('\nthe notifications list separates a quiet account from an unreadable one (#592):');
{
  const hook = strip(read('../components/notifications/useArrivals.ts'));
  const screen = strip(read('../components/notifications/NotificationsScreen.tsx'));
  const row = strip(read('../components/notifications/ArrivalRow.tsx'));

  check(
    'four states, and failed is not empty',
    /kind: 'failed'/.test(hook) && /kind: 'empty'/.test(hook) && /kind: 'ready'/.test(hook)
  );
  check(
    'a failed read reaches for no cached count',
    /failedTitle/.test(screen) && !/summary/.test(screen)
  );
  check(
    'the row prints the asset beside the amount instead of inventing a rate',
    /arrival\.asset/.test(row) && !/fxRate|\* *\d/.test(row)
  );
  check(
    'the seen instant is per browser and read through a store',
    /useSyncExternalStore/.test(strip(read('../components/notifications/useSeenArrivals.ts'))) &&
      /seti\.notifications\.seenAt/.test(read('../components/notifications/Notifications.constants.ts'))
  );
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
