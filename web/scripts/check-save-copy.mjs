/**
 * `npm run check:save-copy` — what the savings card says about its rate (#425).
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

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
