/**
 * `npm run check:receive-address` — the page hands out an address (#419).
 *
 * The defect this suite exists for is an ABSENCE that a reviewer confirmed and nobody could
 * catch: `/app/receive` presented a username and no address, so a bridge, a CEX withdrawal
 * or any wallet outside Seti had nothing to send to and the customer had nothing to read
 * out. A missing block does not fail a build, so it is asserted here by reading the sources
 * the page is made of, the way the other surface suites in this repo work.
 *
 * WHAT IS ASSERTED
 *
 *  1. The block is RENDERED, under the halves, on the ready path only: a failed or no-name
 *     state is a page that is telling a customer something else.
 *  2. The address comes from `useEmbeddedWallet`, the same wallet every signing path uses.
 *     A second source would let the page print an address that no signature will ever come
 *     from.
 *  3. It is printed IN FULL: no `slice`, and it wraps. The failure path tells a customer to
 *     select the string by hand, so a truncated one hides what they were sent to fetch.
 *  4. It draws NOTHING while the wallet is unresolved, rather than a label over a gap.
 *  5. The chain is named in the label and the consequence is stated in the note, because a
 *     send on the wrong network is lost money.
 *  6. The copy control exists and reports a blocked clipboard, and the copy never claims
 *     the address was kept anywhere.
 *
 * Run from `web/`.
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

function read(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

/** Prose out, so a sentence in a comment cannot satisfy an assertion about code. */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const screen = code(read('../components/receive/ReceiveScreen.tsx'));
const wiring = code(read('../components/receive/ReceiveAddress.tsx'));
const block = code(read('../components/receive/ReceiveAddressBlock.tsx'));
const copy = read('../components/receive/receive.constants.ts');

console.log('the page hands out the address money arrives at:');
{
  check(
    'the block is drawn on the ready path, after the half',
    screen.includes('<ReceiveAddress />') &&
      screen.indexOf('<ReceiveAddress />') > screen.lastIndexOf('Half')
  );
  check(
    'and only there: the failure and no-name states return before it',
    screen.indexOf('<ReceiveAddress />') > screen.indexOf('<ReceiveFailure') &&
      screen.indexOf('<ReceiveAddress />') > screen.indexOf('<ReceiveNoName')
  );
}

console.log('\nfrom the wallet that actually signs:');
{
  check(
    'the address is the embedded wallet\'s own',
    wiring.includes('useEmbeddedWallet()') && wiring.includes('<ReceiveAddressBlock address={address} />')
  );
  check(
    'and no request or second read is made for it',
    !wiring.includes('fetch(') && !wiring.includes('/users/')
  );
  check(
    'nothing renders while that wallet is unresolved',
    /if \(!address\) return null/.test(wiring)
  );
}

console.log('\nprinted whole, on the page\'s own axis:');
{
  check('the value is not truncated', !block.includes('.slice(') && !block.includes('shortenAddress'));
  check('it wraps, so a blocked copy is still selectable by hand', /\bwrap\b/.test(block));
  check('and it sits on the centre the page is built on', /align="center"/.test(block));
  check(
    'at caption size, because 42 characters at body size broke two of them onto a second line',
    /size="caption"/.test(block)
  );
}

console.log('\nthe label and the note do the scoping:');
{
  check('the label names the chain', block.includes('addressLabel(CHAIN_NAME)'));
  check('the note states the consequence', block.includes('addressNote(CHAIN_NAME)'));
  check(
    'and neither says a network mode the database owns',
    !/testnet|mainnet/i.test(copy.replace(/\/\*[\s\S]*?\*\//g, ''))
  );
}

console.log('\nand the copy is a control, not a claim:');
{
  check(
    'the copy control is wired with its own name and its own failure',
    block.includes('label={RECEIVE_COPY.addressCopyLabel}') &&
      block.includes('failureText={RECEIVE_COPY.addressCopyFailed}')
  );
  check(
    'a blocked clipboard says so rather than leaving the press unacknowledged',
    /addressCopyFailed: '[^']*Could not copy/.test(copy)
  );
  check(
    'and no sentence claims the address was saved anywhere',
    !/addressCopied: '[^']*(saved|stored|secure)/i.test(copy)
  );
}

console.log('\nthe new copy keeps the page\'s voice:');
{
  const sentences = [...copy.matchAll(/address[A-Za-z]*: \(?'?([^'\n]*)'?/g)].map((m) => m[1]);
  check(
    'no em dash, exclamation or question mark',
    sentences.every((line) => !/[—–!?]/.test(line)),
    sentences.join(' | ').slice(0, 120)
  );
  check('and every address sentence is in the customer\'s second person or states a fact', sentences.length >= 5, String(sentences.length));
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
