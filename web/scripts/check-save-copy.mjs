/**
 * `npm run check:save-copy` — what the savings card says about its rate (#426).
 *
 * The defect this suite exists for was a screen printing "Rate unavailable right now" over a
 * vault that pays 0.0001% while a 3.60% campaign paid on top of it, with the campaign's operator
 * never named anywhere a customer could see. Every one of those was a COPY decision made in a
 * component, so this file imports the real builders and asserts the four states, rather than
 * reading source text.
 *
 * Run from `web/`.
 */
process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID ??= '42431';

import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const { SAVE_COPY, rateLines } = await import('../components/save/Save.constants.ts');

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

const campaign = { apr: '3.60', endsAt: '6 Jan 2027' };
const vault = '0.0001';

console.log('a live campaign leads, and names who pays and when it stops:');
{
  const lines = rateLines(campaign, vault);
  check('the lead carries the campaign rate', lines.primary.startsWith('3.60%'), lines.primary);
  check('and says who pays it', /campaign/.test(lines.primary), lines.primary);
  check('and when it stops', lines.primary.includes('6 Jan 2027'), lines.primary);
  check(
    'the second line is the vault\'s own rate, and says so',
    lines.secondary === 'The vault itself pays 0.0001%',
    String(lines.secondary)
  );
  check(
    'the vault rate is never the lead while a campaign pays',
    !lines.primary.includes('0.0001'),
    lines.primary
  );
}

console.log('\nwith no campaign the vault stands alone:');
{
  const lines = rateLines(null, vault);
  check('one line, the vault\'s', lines.primary === 'The vault pays 0.0001%', lines.primary);
  check('and nothing under it', lines.secondary === null, String(lines.secondary));
}

console.log('\nand nothing is invented when neither number exists:');
{
  const unread = rateLines(null, null);
  check('a failed read says unavailable, not zero', unread.primary === SAVE_COPY.rateUnavailable, unread.primary);
  check('a measured zero says no rate', rateLines(null, '0.0000').primary === SAVE_COPY.rateZero);
  check(
    'and a zero vault rate still shows the campaign above it',
    rateLines(campaign, '0.0000').secondary === SAVE_COPY.rateZero
  );
}

console.log('\nthe campaign\'s operator is named once, where the claim happens:');
{
  check('the block names Merkl', SAVE_COPY.rewardsLabel.includes('Merkl'), SAVE_COPY.rewardsLabel);
  check(
    'and the rate line does not (it is not a vendor line)',
    !rateLines(campaign, vault).primary.includes('Merkl')
  );
  check(
    'the claim keeps saying the payer is the campaign, not the vault',
    /campaign, not (by )?the vault/i.test(SAVE_COPY.rewardsEndsNote ?? 'Paid by the campaign, not by the vault.')
  );
}

console.log('\nthe card itself carries one rate line, and it is tinted (#426):');
{
  const figure = read('../components/save/SaveFigure.tsx');
  const code = figure.replace(/\/\*[\s\S]*?\*\//g, '');
  check('the card prints the lead rate', code.includes('{rates.primary}'));
  check(
    'and not the vault\'s, which came off the card',
    !code.includes('rates.secondary'),
    'rates.secondary rendered'
  );
  check(
    'and not an earnings sentence, which came off with it',
    !code.includes('earnedUnknown') && !code.includes('earnedLabel')
  );
  check('the rate wears the success ink', /color="success"[\s\S]{0,40}rates\.primary/.test(code));
}

console.log('\nnone of it breaks the page voice:');
{
  const sentences = [
    SAVE_COPY.rateUnavailable,
    SAVE_COPY.rateZero,
    SAVE_COPY.campaignRateLine(campaign.apr, campaign.endsAt),
    SAVE_COPY.vaultRateLine(vault),
    SAVE_COPY.vaultOnlyLine(vault),
    SAVE_COPY.rewardsLabel,
  ];
  check(
    'no em dash, exclamation or question mark',
    sentences.every((line) => !/[—–!?]/.test(line)),
    sentences.join(' | ')
  );
  check(
    'and no sentence names a token (a campaign is not a holding)',
    sentences.every((line) => !/\b(OUSD|USDC|USDT|pathUSD)\b/i.test(line))
  );
}

console.log('\nthe page reads figure, actions, then the claim (#427):');
{
  const flow = read('../components/save/SaveFlow.tsx');
  const figureAt = flow.indexOf('<SaveFigure');
  const actionsAt = flow.indexOf('<SaveActions');
  const rewardsAt = flow.indexOf('<SaveRewards />');
  check('the figure comes first', figureAt !== -1 && figureAt < actionsAt);
  check('the actions follow it', actionsAt !== -1 && actionsAt < rewardsAt);
  check('and the claim comes last of the three', rewardsAt !== -1);

  const actions = read('../components/save/SaveActions.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
  check(
    'the two actions share one row from 380px, and stack below it',
    /grid-cols-1 gap-3 min-\[380px\]:grid-cols-2/.test(actions),
    'row grid not found'
  );
  check(
    'equal tracks come from the grid, not from flex sizing the buttons to their labels',
    !/flex-1/.test(actions)
  );
  check(
    'and both keep their own full width',
    actions.split('fullWidth').length >= 3,
    `${actions.split('fullWidth').length - 1} fullWidth props`
  );
}

console.log('\nan uncovered exit fee is a blocked state, said plainly (#521, tightened in #527):');
{
  const line = SAVE_COPY.withdrawFeeShort('KES 0.06', 'KES 0.05');
  check('it leads with the action, in the control\'s own words', line.startsWith('Add money'), line);
  check('it names what the exit costs', line.includes('KES 0.06'), line);
  check('and keeps the fee attributed to the network', /network fee/.test(line), line);
  check('and names the available figure', line.includes('KES 0.05'), line);
  check('and states the requirement, not just the numbers', /You need .* for the network fee/.test(line), line);
  check(
    'it is one instruction, not a sequence in one block',
    !/then take it out/.test(line) && !/Add money first/.test(line),
    line
  );
  check('it is no longer the "keep at least" hint it used to be', !/Keep at least/.test(line), line);
  check('and it does not narrate the failure as a transaction', !/cannot go through/.test(line), line);

  /*
   * Placement, because the complaint was placement: the sentence sat in the field's hint
   * slot while the button dimmed only to 60%. It has to render as its own alert.
   */
  const sheet = read('../components/save/SaveAmount.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
  check('the sheet renders it as an alert, not as the field hint', /role="alert"[\s\S]*withdrawFeeShort|withdrawFeeShort[\s\S]*role="alert"/.test(sheet));
  check('the field hint no longer carries it', !/hint = feeShort/.test(sheet));

  const hook = read('../hooks/useSave.ts').replace(/\/\*[\s\S]*?\*\//g, '');
  check(
    'and the signing-time refusal uses the same sentence',
    hook.includes('SAVE_COPY.withdrawFeeShort('),
    'useSave does not call withdrawFeeShort'
  );
}

console.log('\na deposit leaves one exit fee available, and says so (#522, tightened in #529):');
{
  const line = SAVE_COPY.depositKeepsExitFee('KES 0.06');
  check('the figure is the subject, not us', line.startsWith('KES 0.06'), line);
  check('it is the money that stayed, said as staying', /\bstays\b/.test(line), line);
  check('and where it stayed', /available balance/.test(line), line);
  check('the action is the withdraw sheet\'s own phrase', /take this out later/.test(line), line);
  check(
    'and it does not point "this money" at the deposit',
    !/take this money out/.test(line) && !/^We keep/.test(line),
    line
  );

  const sheet = read('../components/save/SaveAmount.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
  check('the sheet renders it', sheet.includes('SAVE_COPY.depositKeepsExitFee('));
  check('and it is not the blocked-exit sentence', !/cannot go through/.test(line), line);
}

console.log('\nthe Save custody note is deleted, and the claim still lives elsewhere (#531):');
{
  const constants = read('../components/save/Save.constants.ts');
  const actions = read('../components/save/SaveActions.tsx');
  check(
    'the sentence is gone from the copy',
    !constants.includes('Seti never holds it'),
    'the custody note came back'
  );
  check('and nothing renders it', !actions.includes('custodyNote'));

  /*
   * A deletion is not a claim being dropped. Both halves are asserted where they still
   * live, so a later pass cannot delete the survivors thinking the sentence above covered
   * them, nor restore the sentence thinking nothing carries it.
   */
  const pay = read('../components/pay-public/PayPublic.constants.ts');
  check('the pay page still says Seti never holds it', /Seti never holds it/.test(pay));
  const signIn = read('../components/signin/SignInScreen.constants.ts');
  check('and the sign-in footnote still says the money is not Seti’s', /not a bank/.test(signIn));
  check('this screen still says the position is in your own name', /in your own name/.test(constants));
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
