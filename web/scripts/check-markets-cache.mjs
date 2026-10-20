/**
 * `npm run check:markets-cache` — the read-through cache in front of the odds feed.
 *
 * This behaviour cannot be exercised by `next dev`: Node has no `caches` global, so
 * the route falls back to "always load" locally and the caching path only ever runs
 * on the Workers deployment. That is exactly the shape of bug that shipped once
 * already — the previous version set `s-maxage` and cached nothing, and nothing in
 * the response contradicted the claim.
 *
 * So the Cache API is stubbed with a Map and the three promises are asserted
 * directly: a fresh read is a hit, an expired read with a failing load is a stale
 * serve, and a cold failure still throws so the route can answer 502.
 *
 * Run through `tsx`, not `node`: this file imports the TypeScript module under
 * test, and the CI image is Node 20, where importing a `.ts` file is an
 * ERR_UNKNOWN_FILE_EXTENSION. Node 24 strips types natively, so it works locally
 * either way and only CI catches the difference. `tsx` is the same runner the
 * backend's own check suites use.
 */
import { readThroughCache } from '../lib/markets/markets.cache.ts';

const store = new Map();

const fakeCache = {
  async match(request) {
    const hit = store.get(request.url);
    return hit ? hit.clone() : undefined;
  },
  async put(request, response) {
    store.set(request.url, response.clone());
  },
};

globalThis.caches = { default: fakeCache };

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`ok    ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

let loads = 0;
const load = async () => {
  loads += 1;
  return { n: loads };
};

const first = await readThroughCache('https://seti.test', '/api/markets', load);
check('first read is a miss', first.state === 'miss', `got ${first.state}`);

const second = await readThroughCache('https://seti.test', '/api/markets', load);
check('second read is a hit', second.state === 'hit', `got ${second.state}`);
check('the loader ran once for two reads', loads === 1, `ran ${loads}`);
check('the hit body is the miss body', JSON.stringify(second.body) === JSON.stringify(first.body));

const realNow = Date.now;
Date.now = () => realNow() + 61_000;
const stale = await readThroughCache('https://seti.test', '/api/markets', async () => {
  throw new Error('Odds feed answered 503');
});
check('expired entry plus a failing load serves stale', stale.state === 'stale', `got ${stale.state}`);
check('the stale body is the last good body', stale.body.n === 1, `got n=${stale.body.n}`);

Date.now = realNow;
let threw = false;
try {
  await readThroughCache('https://seti.test', '/api/markets/never-fetched', async () => {
    throw new Error('Odds feed could not be reached');
  });
} catch {
  threw = true;
}
check('a cold cache and a failing load throws', threw);

delete globalThis.caches;
const off = await readThroughCache('https://seti.test', '/api/markets', async () => ({ n: 9 }));
check('without a cache the read still answers', off.state === 'off' && off.body.n === 9, `got ${off.state}`);

console.log(failures === 0 ? '\n8 assertions passed.' : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
