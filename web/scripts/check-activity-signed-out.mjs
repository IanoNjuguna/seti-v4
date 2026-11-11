/**
 * `npm run check:activity-signed-out` — the visitor's Activity screen asks, and gives them the door.
 *
 * The defect this exists for is invisible in a screenshot of the DESIGN: the screen rendered its
 * sentence and no control, so a visitor read `Sign in to see your activity.` and had to find the
 * header's pill to act on it. A picture of one state cannot say whether the state that must NOT ask
 * — the restoring frame — asks anyway, which is the failure this gate is really for (#561).
 *
 * Five claims, rendered rather than asserted against the source:
 *
 *  1. The anonymous state prints the app's one sentence for a missing account.
 *  2. It carries exactly one control, and it is a link to `SIGN_IN_PATH`.
 *  3. The label is the app's own verb (`SIGN_IN_PROMPT_COPY.action`), not a second spelling.
 *  4. The control does not stretch across the column: `inline-flex` and no `w-full`.
 *  5. The restoring state offers NO control, and says `One moment…` — the one thing a gate may not
 *     do is tell a customer who is already signed in to sign in.
 *
 * Run from `web/`: npm run check:activity-signed-out (part of the root `verify` gate).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivitySignedOut } from '../components/activity/ActivitySignedOut.tsx';
import { NO_ACCOUNT_COPY } from '../components/app/no-account.constants.ts';
import { SIGN_IN_PROMPT_COPY } from '../components/auth/SignInPrompt.constants.ts';
import { SIGN_IN_PATH } from '../lib/routes.ts';

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

const render = (view) => renderToStaticMarkup(createElement(ActivitySignedOut, { view }));
const countLinks = (html) => (html.match(/<a\b/g) ?? []).length;

console.log('a visitor is asked, and handed the door:');
{
  const html = render('anonymous');

  check('the page keeps its own title', html.includes('Activity'));
  check('and says the app\'s one sentence', html.includes(NO_ACCOUNT_COPY.anonymous('your activity')));
  check('it carries exactly one control', countLinks(html) === 1, `${countLinks(html)} anchors`);
  check('which points at the front door', html.includes(`href="${SIGN_IN_PATH}"`));
  check('with the app\'s own verb for it', html.includes(`>${SIGN_IN_PROMPT_COPY.action}<`));
  check('and it is not stretched across the column', html.includes('inline-flex') && !html.includes('w-full'));
  check('it is the primary control, not a second link', html.includes('bg-canvas-dark'));
}

console.log('the restoring state asks for nothing:');
{
  const html = render('restoring');

  check('no control at all', countLinks(html) === 0, `${countLinks(html)} anchors`);
  check('and the app\'s restoring line', html.includes(NO_ACCOUNT_COPY.restoring));
  check('it never tells a restoring visitor to sign in', !html.includes(SIGN_IN_PROMPT_COPY.action));
}

console.log(`\n${passed} assertions passed.`);
if (failed > 0) {
  console.log(`${failed} FAILED.`);
  process.exit(1);
}
