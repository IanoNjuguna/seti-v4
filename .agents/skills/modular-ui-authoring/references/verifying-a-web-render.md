# Verifying a web render without a production build

`npm run typecheck` and `npm run lint` do not prove a Tailwind token compiles — an
unstyled page passes both. Render it. Until recently agents believed the only way to
render this app was `next build && next start`, because dev-mode client components
never hydrated. That was a misdiagnosis with a one-line fix; this file is the corrected
recipe.

## TL;DR — the dev-hydration failure and its fix

`next dev` (Next 16) **blocks cross-origin requests to dev-only resources by default**,
including the HMR websocket at `/_next/hmr`. The only origins allowed out of the box are
`localhost`, its subdomains, and the hostname the server was started with. Load the page
from any other host — `127.0.0.1`, the printed **Network** URL, a LAN IP — and the
websocket handshake is rejected with a raw `Unauthorized` body, the dev client never
hydrates, and the page sits on its server-rendered skeleton with **zero console errors**.

Fix, in `next.config.ts` (development only, ignored by `next build`):

```ts
const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
};
```

Or, if the running `next dev` is not yours to restart, add the same line to the **copy**
you render (see the procedure below), so only the copy is affected.

**Edits to `next.config.ts` make a running `next dev` in that directory restart itself**
(``⚠ Found a change in next.config.ts. Restarting the server to apply the changes…``).
That is why the fix may be applied to the copy instead.

## Trap: a proof route that silently doesn't exist

A Next App Router folder whose name starts with `_` is **private**. A proof route created
as `app/__qa/page.tsx` builds with exit 0, appears in no route list, and 404s — with no
warning at any point. Name it without a leading underscore (`app/qa-proof/`), and if you
are rendering from a copy of the tree, create and delete it **in the copy**, never in the
working tree the owner is serving from.

## Proving it (30 seconds, no browser)

Start a dev server, then hand-shake the socket by hand. The guard only inspects
`/_next*` / `/__nextjs*` and only looks at the request's `Origin` hostname.

```bash
# blocked: Origin host is not in the allow list -> raw "Unauthorized", HTTP/0.9
curl -s -D - -o /dev/null --max-time 4 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Origin: http://127.0.0.1:3200" http://127.0.0.1:3200/_next/hmr
#   curl: (1) Received HTTP/0.9 when not allowed
#   < Unauthorized

# allowed: Origin host matches the server's own host
curl -s -D - -o /dev/null --max-time 4 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Origin: http://localhost:3200" http://127.0.0.1:3200/_next/hmr
#   HTTP/1.1 101 Switching Protocols
```

The dev server logs the block explicitly (once per distinct host):

```
⚠ Blocked cross-origin request to Next.js dev resource /_next/hmr from "127.0.0.1".
Cross-origin access to Next.js dev resources is blocked by default for safety.
```

In the browser this surfaces as `WebSocket connection to 'ws://HOST/_next/hmr?id=…'
failed: Error during WebSocket handshake: net::ERR_INVALID_HTTP_RESPONSE` — which a
previous revision of this file wrongly attributed to "the sandbox". Grep the recorded
evidence: `.playwright-mcp/console-*.log` in this repo contains that exact line against
`ws://127.0.0.1:3000` and `ws://127.0.0.1:3600`, i.e. agents were driving the browser at
**`127.0.0.1`, not `localhost`** — 1428 requests to `127.0.0.1:3000` versus 291 to
`localhost:3000` in the snapshots. The sandbox was never the problem.

Why nothing else breaks: right after the guard was added, the reference story said
"server HTML renders, JS chunks load with 200, and no element ever gets a `__reactFiber`
key". That is still exactly what you see. Chunk requests are same-origin `GET`s and
carry **no** `Origin` header, so the guard lets them through; the websocket always sends
one, so it is the only thing blocked. React loads (the DevTools banner logs), but
`hydrate()` in `node_modules/next/dist/client/app-index.js` runs `createWebSocket(...)`
and then `await initialServerResponse`, and the tree is never committed.

## The procedure (copy + hard-linked deps + spare ports)

Two things block the obvious "just run `next dev`" route:

- **One `next dev` per project directory.** A second one exits with "Another next dev
  server is already running" and names the PID. Never kill that process: it is usually
  someone else's session, and its `.next` state is not yours to reset.
- **Turbopack rejects a symlinked `node_modules`** ("Symlink [project]/node_modules is
  invalid, it points out of the filesystem root"), so the usual copy-the-app-and-symlink
  trick does not work.

Work inside the repo, so module resolution still finds the hoisted root `node_modules`,
and hard-link the deps (same filesystem — instant, no extra space):

```bash
cd <repo>
mkdir .web-check-<item>                     # UNIQUE dir — see Cleanup
rsync -a --exclude .next --exclude node_modules --exclude AGENTS.md web/ .web-check-<item>/
cp -al web/node_modules .web-check-<item>/node_modules
cp web/.env.local .web-check-<item>/.env.local
printf '\nNEXT_PUBLIC_API_URL=http://localhost:4100\nNEXT_PUBLIC_AUTH_SOURCE=dev\n' >> .web-check-<item>/.env.local
```

**Then fix the copy's hydration** — append the config line, or the browser will only
hydrate if it is pointed at `localhost`:

```bash
cat > .web-check-<item>/next.config.ts <<'EOF'
import type { NextConfig } from "next";
const nextConfig: NextConfig = { allowedDevOrigins: ["127.0.0.1"] };
export default nextConfig;
EOF
(cd .web-check-<item> && npx next dev -p 3200)     # a port nothing else holds
```

Signing in needs a backend that allows the dev bypass, on its own port so it does not
collide with the running one. `dotenv` does not override an existing variable, so the
env prefix wins over `.env`:

```bash
cd backend && PORT=4100 HOST=127.0.0.1 DEV_BYPASS_AUTH=true NODE_ENV=development npm run dev
curl -s -X POST http://localhost:4100/auth/dev -H 'content-type: application/json' -d '{}'
```

Warm the route before driving a browser (see below), then load `http://localhost:3200/app`
(or `127.0.0.1:3200` once `allowedDevOrigins` is set), click Sign in (source `dev` renders
the local-development card), and inspect the DOM. `getComputedStyle` on the new elements is
the evidence that the tokens compiled — background, colour, radius, font:

```js
const s = getComputedStyle(document.querySelector('form input'));
({ bg: s.backgroundColor, color: s.color, radius: s.borderRadius });
```

Assertions worth making in this order: the copy renders, a bad input produces the field
message (and no wallet prompt), and the computed colours match the tokens you intended.

### Assert hydration with the fiber key, never by eye

A dev page that is *not* hydrating looks identical to one that is, for the parts that
matter. Check the key, not the pixels:

```js
[...document.querySelectorAll('*')].some(e => Object.keys(e).some(k => k.startsWith('__reactFiber')))
```

`false` on a route that should have hydrated means the websocket never connected — check
the `Origin` host against the fix above before blaming the component. From the console,
`[HMR] connected` is the positive signal; a `ws://…/_next/hmr … net::ERR_INVALID_HTTP_RESPONSE`
close (code 1006, retrying forever) is the block.

### The copy's env decides whether `/app` boots at all

`web/.env.local` is a per-machine file and it has held **abbreviated** Tempo token
addresses (`0x20c0...0000`, `0x20c0...74be`). `chain.constants.ts` validates them at
module load and refuses a non-address, so every `/app` route that pulls the chain graph
answers **500** with `NEXT_PUBLIC_TEMPO_TOKEN_OUSD is not a valid 20-byte address` —
before any component runs, so it reads like a broken app rather than a bad env value.
Put the full Moderato values from `backend/src/config/networks.ts` in the **copy**
(`pathUSD 0x20c0000000000000000000000000000000000000`, `OUSD
0x20c0000000000000000000006a37da5c996874be`) and delete its `.next`.

### When the harness itself gets flaky

`Runtime.evaluate` and `capture_screenshot` intermittently time out on this box while
Turbopack is compiling — the same call succeeds on retry, so wrap both in a 3–4 attempt
loop. Scroll with real key events (`PageDown`, `End` via `Input.dispatchKeyEvent`)
instead of `window.scrollTo`, which failed most; a screenshot taken after a failed
scroll is a **blank frame**, so inspect the image rather than trusting the exit code.

## Cleanup

`rm -rf .web-check-<item>` and stop both processes — **kill by PID** (`ss -ltnp` to find
it), never by pattern: a `next dev` on 3000/4000 may be the owner's and pkill would take
it too. Nothing else in the tree should change; check `git status` for strays before
reporting.

### Use a UNIQUE copy directory, not `.web-check`

`.web-check` is gitignored and the name this procedure used to use, so **two agents
working the same repo at once will both claim it** — and each one's cleanup `rm -rf
.web-check` deletes the other's copy out from under a running `next dev`. The failure is
loud but late: the server logs `ENOENT: scandir .../.web-check/app`, then `The directory
.../.next/dev was deleted`, then dies with `Cannot find module .../.web-check/node_modules/
next/dist/server/lib/start-server.js` — mid-verification, after the compiles you waited
two minutes for. Pick a task-specific name that still matches the `.web-check*/` ignore
rule (e.g. `.web-check-<item>/`) and clean up only that.

## Warm the route before you drive a browser

`next dev` compiles a route on its **first** request. Measured in this repo, the first
`GET /app/activity` on a warm filesystem cache took **2m02s**; under load the first
`GET /app` has taken well over five minutes. A browser tool that gives up after ~60s
(Playwright MCP's `page.goto`, `browser-use`'s `Page.navigate`) fails before that, and a
navigation that times out mid-compile looks exactly like a dead server — it is not; the
compile is still running.

So block on `curl` first — it waits out the compile and then answers `200`:

```bash
curl -s -m 600 -o /tmp/page.html -w '%{http_code}\n' localhost:<port>/app/activity
```

Every later request is served in well under a second, and the browser then navigates
normally. Also note the Playwright MCP's file roots: screenshots can only be written
under the repo or `.playwright-mcp/`, never `/tmp` (`File access denied: ... outside
allowed roots` → the tool refuses before it writes anything).

## Two traps that fail as "a page that renders and does nothing"

Neither throws anything visible, and both cost a session if you don't know them:

- **Blank `NEXT_PUBLIC_PRIVY_APP_ID` in the copy.** With a real app id the copy is
  served from `127.0.0.1:3200` (or whatever spare port you picked) — an origin that
  app does not have registered. Privy's SDK never finishes initialising, the session
  gate waits on it, and the page sits in its loading shell forever: server HTML, no
  hydration, zero console errors. Blank it and the app takes its no-Privy path and
  hydrates in one pass.
- **`NEXT_PUBLIC_*` comes from the copy's `.env.local`, not a shell prefix.**
  `NEXT_PUBLIC_API_URL=… npx next dev` loses to the `.env.local` line, so the app
  talks to the environment's real backend (port 4000) instead of your scratch one,
  and every dev sign-in 404s with "the backend is not serving POST /auth/dev". Edit
  the copy's `.env.local`, delete `.next`, restart.

## Caveat

A dev-bypass session has no Privy wallet, so anything gated on a ready wallet (both
balance-card panels are) will render its empty state instead of its form. To exercise
the form, temporarily force the wallet status inside the **copy** — never in `web/` —
and say so in your report, because the screenshot then shows one branch of the code as
it is not shipped.

### A flow that SIGNS cannot be driven from a dev session at all — shim the wallet

Anything that asks the wallet for a signature (a handle claim, a payment) throws
`NoEmbeddedWalletError` on the dev path, so the flow stops at the button. Do not
conclude the feature is broken, and do not test it by hand: replace
`hooks/useEmbeddedWallet.ts` **in the copy** with a shim returning a fixed test key's
account, and have its EIP-1193 `request({method:'eth_signTypedData_v4', params:[addr,
json]})` sign via `privateKeyToAccount(key).signTypedData(JSON.parse(json))`. viem
accepts the app's typed data with no `EIP712Domain` entry, so the shim needs no
knowledge of the message. The backend still verifies for real — recovery, the
ownership check and the stored row are production code; only the key's custodian is
fake. Say so in the report.

The shimmed address must be one the account OWNS, or the claim is refused
(`address-not-owned`). Registering it is the trap: `Wallet` has
`@@unique([userId, asset, status])`, so a user can hold exactly ONE row per
(asset, status) — and `POST /auth/dev`'s own `registerWallet` deprecates the active
row on every login. `INSERT`ing a second `ousd` row therefore collides (P2002,
`wallets_userId_asset_status_key`) either immediately or on the next dev login.
Two recipes that work: (a) point the dev user's single `ousd` row at the harness
address and let the next `/auth/dev` deprecate it and insert its own — the claim's
ownership check reads rows of ANY status (`getWalletsByUser`), so a deprecated row
still proves ownership; or (b) keep `0xdede…` active and insert the harness row as
`deprecated`. Restore the original address and delete the extra row afterwards.

## A prerendered route does not see the query in a production build

`params` and `searchParams` are resolved when the route is **prerendered**, so on a
route the build reports as `○ (Static)` a client page that reads the `searchParams`
prop gets `{}` — in production only. In `next dev` the same route is rendered
on-demand and the values arrive, so `use(searchParams)` looks correct in every
screenshot taken from the dev server. This silently disables every
link-into-the-app handoff: a `?handle=`/`?to=`/`?kind=` page renders its empty state
(often the signed-out card) with no error anywhere.

Read the query with `useSearchParams()` from `next/navigation` inside a
`<Suspense>` boundary instead — the boundary is required or the build fails with
"Missing Suspense boundary with useSearchParams". It client-renders that subtree
while the rest of the route stays static (verified: `/app/merchant?kind=person`
showed business copy before, username copy after).

**The general lesson: a dev-only pass cannot see the prerender class of defect.** Drive
those routes against `next build && next start` too — a Turbopack production build of
this app measured ~15 min on a loaded box, so budget for it. But do not reach for a
production build merely to get *hydration*: that is the websocket origin guard above,
and it is fixed by one config line.

## Screenshots of a long page: slice and stitch

Playwright MCP's own `browser_take_screenshot` gives up at **5s**, so `fullPage: true`
on a ~3.5k-px marketing page always fails with `TimeoutError ... waiting for fonts to
load / fonts loaded` — the page is fine, the call budget is not. `browser_exec`'s
`capture_screenshot` fares no better over CDP/IPC on this box: any capture of a tall
page dies with `TimeoutError: timed out` while the browser is idle.

What works, in one call each, is `browser_run_code_unsafe`: scroll the page in viewport
steps first (this is also what arms an IntersectionObserver-based scroll reveal, and it
makes the reveal *stick* because it fires once), then loop `page.screenshot({path})` at
each offset at a normal viewport height (1440×900, 360×800). Slices come back in
seconds, and `PIL` joins them (`stitch.py` in the QA dir). Do not raise the viewport to
the page height to fake a full page: `min-h-screen` sections then grow with it and the
layout you capture is not the layout anyone sees.

## A token can be declared and still compile to nothing

`SKILL.md` says a class that greps to zero is a missing theme token. There is a second
cause, and it looks identical: a `@theme inline` entry whose value references the
`:root` property of the same name, in the style the colour block uses —

```css
:root { --duration-quick: 160ms; }
@theme inline { --duration-quick: var(--duration-quick); }
```

Tailwind emits `--duration-quick: var(--duration-quick)` next to the real declaration, a
custom property that references itself — invalid at computed-value time — and the
`duration-quick` utility is never generated at all. Durations, easings and distances
belong in a plain `@theme` block with their literal values. Verify on the served
stylesheet, not on the class name: fetch the page's CSS and check both
`.duration-\(--duration-quick\){--tw-duration:var(--duration-quick);...}` and
`getComputedStyle(el).transitionDuration === '0.16s'` in a live render.
