# The deploy pipeline — secrets and variables an owner must create

`.github/workflows/deploy.yml` ships `main` on every push: it runs the gate, builds
the API image, deploys it to the Lightsail box, and deploys the web Worker. It
exists because deploys were a human running commands from a laptop, and one of
those runs removed the running API container before pulling the new image — a
failed pull then left the API down until the pull was retried.

**This document is the contract.** The workflow reads only what is listed here,
and it creates none of it. Until each item exists, the first job that needs it
fails, with the secret's name in the log.

For its first months the workflow never parsed at all, so it created nothing and
failed nothing: an empty expression, written as a pair of expression braces with
nothing between them, sat in a comment inside a `run:` block. GitHub scans `run`
blocks for expressions, tries to parse that one, and rejects the whole file, so
every push to `main` produced a run with zero jobs and the `name:` never even
registered. The fix is in the file: describe the expansion in words instead of
quoting it. `actionlint .github/workflows/deploy.yml` reproduces the error
locally in about a second, and is worth running before touching this file.

Create all of it at **repository scope** (Settings → Secrets and variables →
Actions). The single exception is noted under [Environments](#environments).

```bash
# shortcuts used below; run from anywhere with the `gh` CLI authenticated
OWNER_REPO=owner/repo
```

---

## 1. Secrets (4)

| Name | Used by | What it is |
| --- | --- | --- |
| `DEPLOY_SSH_KEY` | `backend` job | The **private** half of a dedicated ed25519 key that may log into the box as `ubuntu`. |
| `DEPLOY_HOST` | `backend` job | Hostname or address of the Lightsail box (e.g. `api.seti.live` or the static IP). Not a credential, but kept here so the host is not baked into a commit. |
| `CLOUDFLARE_API_TOKEN` | `web` job | API token that may upload the Worker script. |
| `CLOUDFLARE_ACCOUNT_ID` | `web` job | The Cloudflare account that owns the `web` Worker. |

### `DEPLOY_SSH_KEY` — a deploy key, not the owner's key

A keypair that exists only for CI. Its public half is appended to the deploy
user's `authorized_keys`; its private half goes in the secret. Revoking the
pipeline is then one line on the box, and the owner's own key is never copied
into GitHub.

```bash
# 1. generate, with no passphrase — the runner cannot type one
ssh-keygen -t ed25519 -C "seti-ci-deploy" -f ./seti-ci-deploy -N ""

# 2. authorise the public half on the box (run from a laptop that already has access)
ssh ubuntu@<box> 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys' \
  < ./seti-ci-deploy.pub

# 3. put the private half in the secret, then delete it locally
gh secret set DEPLOY_SSH_KEY --repo "$OWNER_REPO" < ./seti-ci-deploy
shred -u ./seti-ci-deploy        # macOS: rm -P

gh secret set DEPLOY_HOST --repo "$OWNER_REPO" --body "api.seti.live"
```

The workflow writes the key to `$HOME/.ssh/deploy_key` with mode `600` via an
environment variable (never interpolated into a command line, because the key is
multi-line), and pins the host key it got from `ssh-keyscan` for the rest of the
run. That is trust-on-first-use: a host key captured once per run. To pin it
ahead of time instead, add the box's real host key as a fifth secret and point
`UserKnownHostsFile` at it — the workflow today does not have that secret, so it
scans.

The key only needs to run `docker` as a user in the `docker` group. It needs no
`sudo`, and nothing else in the pipeline logs in as this user.

### `CLOUDFLARE_API_TOKEN` — Workers Scripts: Edit

Create at Cloudflare → My Profile → API Tokens → *Create Token* → *Custom token*:

- Permissions: **Account → Workers Scripts → Edit**. That is the only permission
  the deploy needs; it uploads a script.
- Account resources: limit it to the one account, not *All accounts*.
- (`Cloudflare Pages` is not needed — `docs-site/` is a separate static site.)

`CLOUDFLARE_ACCOUNT_ID` is not secret in any meaningful sense (it appears in
dashboard URLs), but the token can belong to several accounts, so wrangler needs
to be told which one. Copy it from the Workers dashboard's URL or Overview page:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo "$OWNER_REPO" --body "<token>"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$OWNER_REPO" --body "<32-hex-account-id>"
```

Both are consumed by `wrangler` from the environment; neither is passed on a
command line, so neither reaches a log or a shell history.

`GITHUB_TOKEN` is **not** on this list: Actions mints it per run, and the
workflow's `permissions: packages: write` is what lets it push to GHCR.

---

## 2. Variables (10) — the build-time public values

Every one of these is `NEXT_PUBLIC_*`, which Next **inlines into the client
bundle at build time**. They are therefore public by construction — they are
literal strings in the JavaScript a visitor downloads — so they belong in
**Variables**, not Secrets. The workflow reads `vars.*` only: a value parked in
Secrets is not read, and the build fails by name rather than shipping an empty
one. That is deliberate; there is no `vars || secrets` fallback, because two
places to look is how a build ships a value nobody can find later.

| Variable | Example / rule | Why it matters |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.seti.live` | Inlined into the client bundle. A localhost or private value is refused by `web/scripts/guard-production-env.mjs` — that refusal has no bypass and CI does not weaken it. |
| `NEXT_PUBLIC_SITE_ORIGIN` | `https://seti.live` | Canonical origin for legal pages and absolute links. |
| `NEXT_PUBLIC_TEMPO_CHAIN_ID` | `42431` (practice) or `4217` (live) | Which Tempo chain the client signs on. **Must match the API's `TEMPO_CHAIN_ID`** — see the warning below. |
| `NEXT_PUBLIC_ALLOW_MAINNET` | `true` or `false` | `chainConfigFor` refuses a mainnet signature unless this is exactly `"true"`. Set `false` on a practice build. |
| `NEXT_PUBLIC_TEMPO_ASSET` | `ousd` | Default spend asset. Must be one of `ousd`, `pathusd`, `usdt0`, `usdc.e`. |
| `NEXT_PUBLIC_TEMPO_TOKEN_OUSD` | `0x20c0000000000000000000006a37da5c996874be` | OUSD override. Equal on both chains; the value is in `web/lib/chain/chain.assets.ts`. |
| `NEXT_PUBLIC_TEMPO_TOKEN_PATHUSD` | `0x20c0000000000000000000000000000000000000` | pathUSD override. Equal on both chains. |
| `NEXT_PUBLIC_PRIVY_APP_ID` | `cl…` from the Privy dashboard | Public app id. Its matching `PRIVY_APP_SECRET` belongs on the **backend** only, in the box's `.env.production` — never here. |
| `NEXT_PUBLIC_PRIVY_SYNC_CHANNEL_ID` | channel id from the Privy dashboard | Cross-tab wallet sync channel. |
| `NEXT_PUBLIC_AUTH_SOURCE` | `privy` | Which sign-in path this build uses (`privy` or `dev`). `dev` in production is a configuration error the app reports, not a fallback. |

```bash
gh variable set NEXT_PUBLIC_API_URL --repo "$OWNER_REPO" --body "https://api.seti.live"
gh variable set NEXT_PUBLIC_SITE_ORIGIN --repo "$OWNER_REPO" --body "https://seti.live"
gh variable set NEXT_PUBLIC_TEMPO_CHAIN_ID --repo "$OWNER_REPO" --body "4217"
gh variable set NEXT_PUBLIC_ALLOW_MAINNET --repo "$OWNER_REPO" --body "true"
gh variable set NEXT_PUBLIC_TEMPO_ASSET --repo "$OWNER_REPO" --body "ousd"
gh variable set NEXT_PUBLIC_TEMPO_TOKEN_OUSD --repo "$OWNER_REPO" --body "0x20c0000000000000000000006a37da5c996874be"
gh variable set NEXT_PUBLIC_TEMPO_TOKEN_PATHUSD --repo "$OWNER_REPO" --body "0x20c0000000000000000000000000000000000000"
gh variable set NEXT_PUBLIC_PRIVY_APP_ID --repo "$OWNER_REPO" --body "<privy-app-id>"
gh variable set NEXT_PUBLIC_PRIVY_SYNC_CHANNEL_ID --repo "$OWNER_REPO" --body "<channel-id>"
gh variable set NEXT_PUBLIC_AUTH_SOURCE --repo "$OWNER_REPO" --body "privy"
```

> **The chain id must agree with the API's.** The web build and the API are
> deployed by two different jobs from the same commit, but nothing in the
> pipeline compares these values. If the Worker is built for `4217` while the box
> runs `TEMPO_CHAIN_ID=42431`, the client signs on a chain the API does not
> reconcile against, and every payment fails verification. `docs/internal/mainnet-flip.md`
> is the procedure that moves both; flip them **together**, in one commit that
> changes the box's `.env.production` and these variables.

Values here are the *live* set. A practice deployment uses `42431`,
`NEXT_PUBLIC_ALLOW_MAINNET=false`, and the same token addresses.

---

## 3. Why the ordering in the deploy is load-bearing

The remote script — embedded in the `backend` job, running on the box over SSH —
does exactly this, in this order:

1. `docker pull ghcr.io/<owner>/seti-api:<commit-sha>`
2. `docker image inspect` the tag, to record its id
3. check `/home/ubuntu/seti/.env.production` exists, that `curl` is installed (the
   health poll needs it), and that `seti-net` exists (creating the network if it
   does not)
4. `docker rm -f seti-api`
5. `docker run -d --name seti-api --network seti-net --restart unless-stopped --env-file … -p 127.0.0.1:4000:4000 <image>:<sha>`
6. assert the running container's image id equals the id pulled in step 2
7. poll `http://127.0.0.1:4000/health` (30 × 2 s) and fail the job if it never answers

**Step 1 is the fix.** `set -euo pipefail` plus `if ! docker pull …; then exit 1`
means a failed pull (registry down, tag missing, credential revoked) ends the
script before step 4 has run: the old container is still up, still serving, and
the job's error says so. Steps 2 and 3 are before the removal for the same
reason — a missing env file should not cost downtime either.

`seti-db` is never touched. The pipeline deploys the API process; the database is
the one thing on that host a bad deploy cannot recreate.

### What it does not protect against

- **A pull that succeeds and a container that will not boot.** By then the old
  container is gone, so the API is down until someone acts. The job fails, prints
  the last 100 log lines, and leaves the new container running for inspection —
  failing closed onto a container that logs its own boot refusal is more
  diagnosable than one that has been removed again.
- **Rollback is manual.** GHCR keeps every SHA tag, so the previous version is
  `ghcr.io/<owner>/seti-api:<previous-sha>` on the box. Recovery is a `docker run`
  of that tag with the same flags as step 5 above. The pipeline has no automated
  rollback and does not pretend to: re-running it deploys `main`'s current commit,
  not an arbitrary earlier one.
- **No migrations.** `prisma migrate deploy` is a separate, deliberate release
  step (`docs/operations.md` §3). This pipeline does not run it, so a commit that
  ships a schema change needs that step run by an owner — deploying the API alone
  will fail at the first query against a missing column.

---

## 4. GHCR visibility — do this once, or the pull fails

`docker/build-push-action` pushes to `ghcr.io/<owner>/seti-api`. GHCR packages are
**private by default**, and an anonymous `docker pull` from the box is then refused
with `unauthorized`, which the deploy script correctly reports as a failed pull
with the old container still running.

Two ways to fix it, pick one:

- **Make the package public** (recommended): Package settings → *Change
  visibility* → Public. The image contains no secrets — every credential arrives
  at runtime from `--env-file /home/ubuntu/seti/.env.production` — and the
  `org.opencontainers.image.source` label the build sets links it back to this
  repository.
- **Keep it private** and `docker login ghcr.io` once on the box with a
  `read:packages` token. The credentials live in `/home/ubuntu/.docker/config.json`
  and nothing in the pipeline manages or rotates them.

The workflow itself does not authenticate the box, so this is a one-time owner
step either way.

---

## 5. Environments

All secrets and variables above are read at repository scope. If you would rather
scope them to a GitHub **Environment** (so a deploy can require a reviewer), you
must also add `environment: production` to the `backend` and `web` jobs — the
workflow as written does not reference an environment, so environment-scoped
values would not be found.

---

## 6. Deliberately left out

- **The indexer.** `seti-indexer` runs `node dist/worker.js` from the same image.
  This pipeline replaces `seti-api` only; the indexer keeps running whatever it
  was started with. Restarting it on every deploy was judged worse than useful —
  an indexer restart re-reads cursors, and the cursors are data
  (`docs/operations.md` §4). Nothing stops a follow-up from adding it once the
  image tag can be read back from the running container.
- **`NEXT_PUBLIC_TEMPO_{TESTNET,MAINNET}_TOKEN_*`.** The eight per-network token
  overrides are not wired. They are optional: `web/lib/chain/chain.assets.ts`
  already carries Tempo's registry address for every supported asset on both
  chains, so an unset override resolves to the correct address. Add them as
  variables only if a token moves.
- **A staging deploy.** There is one environment. `workflow_dispatch` re-runs
  production.
- **Cache invalidation / CDN warm-up.** `wrangler deploy` uploads the new script;
  `vinext-cloudflare deploy` additionally probes and warms the CDN. If cache
  staleness after a deploy becomes a problem, that is the change to make — not a
  hand-run purge.
- **Node version parity.** CI runs the gate on Node 22 (as this workflow's
  `setup-node` specifies); `backend/Dockerfile` builds the API on Node 20
  (`ARG NODE_VERSION=20`). The gate proves the code under 22 and the image
  ships 20, so a Node-22-only language or library feature would pass the gate and
  fail at container start. Pin one of them if that risk ever matters.
- **`check:send` does not verify anything here.** It reconciles a receipt pinned
  per chain (`TEMPO_<NETWORK>_SEND_ANCHOR_TX`), and no anchor is pinned in a CI
  database, so it prints `SKIPPED — NOT passed` and exits 0. A green `verify` job
  says nothing about send reconciliation.

The existing `.github/workflows/verify.yml` still runs on every push and pull
request. `deploy.yml` repeats the gate on `main` on purpose: a merge is the thing
being shipped, and a deploy job that trusts an earlier run's result is trusting a
different commit than the one it builds.
