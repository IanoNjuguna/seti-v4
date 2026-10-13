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
