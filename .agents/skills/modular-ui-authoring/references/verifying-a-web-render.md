# Verifying a web render when someone else's `next dev` is running

`npm run typecheck` and `npm run lint` do not prove a Tailwind token compiles — an
unstyled page passes both. Render it. Two things block the obvious route:

- **One `next dev` per project directory.** A second one exits with "Another next dev
  server is already running" and names the PID. Never kill that process: it is usually
  someone else's session, and its `.next` state is not yours to reset.
- **Turbopack rejects a symlinked `node_modules`** ("Symlink [project]/node_modules is
  invalid, it points out of the filesystem root"), so the usual
  copy-the-app-and-symlink-deps trick does not work.

## The procedure

Work inside the repo, so module resolution still finds the hoisted root
`node_modules`, and hard-link the deps (same filesystem — instant, no extra space):

```bash
cd <repo>
mkdir .web-check
rsync -a --exclude .next --exclude node_modules --exclude AGENTS.md web/ .web-check/
cp -al web/node_modules .web-check/node_modules
cp web/.env.local .web-check/.env.local
printf '\nNEXT_PUBLIC_API_URL=http://localhost:4100\nNEXT_PUBLIC_AUTH_SOURCE=dev\n' >> .web-check/.env.local
(cd .web-check && npx next dev -p 3200)     # a port nothing else holds
```

Signing in needs a backend that allows the dev bypass, on its own port so it does not
collide with the running one. `dotenv` does not override an existing variable, so the
env prefix wins over `.env`:

```bash
cd backend && PORT=4100 HOST=127.0.0.1 DEV_BYPASS_AUTH=true NODE_ENV=development npm run dev
curl -s -X POST http://localhost:4100/auth/dev -H 'content-type: application/json' -d '{}'
```

Then drive a real browser at `http://localhost:3200/app`, click Sign in (source `dev`
renders the local-development card), and inspect the DOM. `getComputedStyle` on the new
elements is the evidence that the tokens compiled — background, colour, radius, font:

```js
const s = getComputedStyle(document.querySelector('form input'));
({ bg: s.backgroundColor, color: s.color, radius: s.borderRadius });
```

Assertions worth making in this order: the copy renders, a bad input produces the field
message (and no wallet prompt), and the computed colours match the tokens you intended.
The first `GET /app` compiles for well over a minute — curl with a long timeout before
concluding the server is down.

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

`rm -rf .web-check` and stop both processes. Nothing else in the tree should change —
check `git status` for strays before reporting.

### Use a UNIQUE copy directory, not `.web-check`

`.web-check` is gitignored and the name this procedure has always used, so **two agents
working the same repo at once will both claim it** — and each one's cleanup `rm -rf
.web-check` deletes the other's copy out from under a running `next dev`. The failure is
loud but late: the server logs `ENOENT: scandir .../.web-check/app`, then `The directory
.../.next/dev was deleted`, then dies with `Cannot find module .../.web-check/node_modules/
next/dist/server/lib/start-server.js` — mid-verification, after the compiles you waited
two minutes for. Pick a task-specific name that still matches the `.web-check*/` ignore
rule (e.g. `.web-check-<item>/`) and clean up only that.

## If a client component never hydrates, suspect the HMR socket

`next dev`'s HMR WebSocket can be blocked from upgrading by the sandbox
(`ws://…/_next/hmr … Error during WebSocket handshake: net::ERR_INVALID_HTTP_RESPONSE`).
When it is, the dev client defers the initial hydration: server HTML renders, the JS
chunks load with 200, React logs its DevTools banner — and **no element ever gets a
`__reactFiber` key**, so a client-only branch (a skeleton gated on mount, a
`useSyncExternalStore` mount guard) stays frozen forever with **zero console errors**.

Diagnose with
`[...document.querySelectorAll('*')].some(e=>Object.keys(e).some(k=>k.startsWith('__reactFiber')))`,
not by eyeballing the DOM. False on a route that should have hydrated means the
environment is at fault, not the component.

**Verify against a production build instead**, which has no HMR socket to negotiate:
`npx next build` then `npx next start -p <spare port>`, and re-check the fiber key. A
Turbopack production build of this app measured ~15 min on a loaded box, so budget for
it rather than concluding the build hung.

## Warm the route before you drive a browser
`next dev` compiles a route on its **first** request. Measured in this repo, the first
`GET /app/activity` on a warm filesystem cache took **2m02s**. A browser tool that gives
up after ~60s (Playwright MCP's `page.goto`, `browser-use`'s `Page.navigate`) fails
before that, and a navigation that times out mid-compile looks exactly like a dead
server — it is not; the compile is still running.

So block on `curl` first — it waits out the compile and then answers `200`:

```bash
curl -s -m 180 -o /tmp/page.html -w '%{http_code}\n' localhost:<port>/app/activity
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

**The general lesson: drive the flow against `next build && next start`, not only
`next dev`.** A dev-only pass cannot see this class of defect, and the trap is that
the page is not blank — it renders, just not as configured.

