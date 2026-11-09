/**
 * `npm run check:raised` — the raised control is the commit button and nothing else (#491, #495).
 *
 * The recipe is four shadows on a filled button. Its value depends entirely on where it is applied: on the
 * one action that moves money it reads as a physical control, and on a chip it reads as a bevel. So the
 * assertions here are about SCOPE as much as about the shadows themselves.
 *
 * Run from `web/`: npm run check:raised (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { VARIANT_CLASSES } from '../components/ui/Button.constants.ts';

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

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

console.log('the recipe is four layers, in the order light falls:');
{
  const accent = css.slice(css.indexOf('.ctl-raised-accent {'));
  const block = accent.slice(0, accent.indexOf('}'));

  check('a top light, 1px, white', /inset 0 1px 0 rgba\(255, 255, 255, 0\.35\)/.test(block));
  check('a bottom shade, 2px, black', /inset 0 -2px 0 rgba\(0, 0, 0, 0\.2\)/.test(block));
  check('a contact shadow', /0 1px 2px rgba\(0, 0, 0, 0\.38\)/.test(block));
  check('and a wide glow in the fill', /0 8px 24px -6px rgba\(215, 207, 7, 0\.55\)/.test(block));
  check(
    'the dark fill glows neutral, not yellow',
    /\.ctl-raised-dark \{[\s\S]*?0 8px 24px -6px rgba\(0, 0, 0, 0\.55\)/.test(css)
  );
}

console.log('\npressed sinks, and disabled does not float:');
{
  check('pressed turns the lift into an inner shadow', /:active:not\(:disabled\)[\s\S]*?inset 0 2px 6px/.test(css));
  check('pressed moves down 1px', /transform: translateY\(1px\)/.test(css));
  check('disabled takes the shadow away entirely', /:disabled[\s\S]*?box-shadow: none/.test(css));
}

console.log('\nand it is worn by the commit control only:');
{
  const raised = Object.entries(VARIANT_CLASSES)
    .filter(([, cls]) => cls.includes('ctl-raised'))
    .map(([variant]) => variant)
    .sort();

  check('two variants are raised', raised.length === 2, raised.join(','));
  check('the money commit is one of them', raised.includes('accent'), raised.join(','));
  check('the dark commit on a light band is the other', raised.includes('primary'), raised.join(','));

  for (const variant of ['secondary', 'ghost', 'pill', 'destructive']) {
    check(`${variant} is not raised`, !VARIANT_CLASSES[variant].includes('ctl-raised'));
  }

  check(
    'a raised control does not also scale under the finger',
    !/ctl-raised[^']*active:scale/.test(VARIANT_CLASSES.accent) &&
      !/ctl-raised[^']*active:scale/.test(VARIANT_CLASSES.primary)
  );
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
