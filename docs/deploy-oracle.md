# Deploying the Seti backend on a single box

Two provider paths, **one set of artefacts**. Oracle Cloud Always Free is the
**$0 default** (§1–§13); [AWS](#aws) — Lightsail recommended — is the path to use
with the owner's credits. The `Dockerfile`, `docker-compose.yml`,
`deploy/systemd/` units and the backup job are **identical on both**; only the
host provisioning and the firewall differ, and each provider's steps live in its
own section.

The web app has its own deploy
([`operations.md` §7](./operations.md#7-deploying-the-web-app)); this document is
about the API, the indexer and the database — the part that **cannot** move to a
serverless platform, because the indexer is a long-running loop and the ledger is
a real Postgres.

Read §1 first: two of the Oracle choices are permanent and one of them decides
the region you can ever launch free compute in.

Everything here is a checklist. The artefacts it refers to live in the repo:

| File | What it is |
| --- | --- |
| `backend/Dockerfile` | Backend image, ARM64-native, no architecture pin |
| `.dockerignore` | Build context (root, because the workspace lockfile is there) |
| `docker-compose.yml` | The single-box stack: Postgres + API + indexer |
| `deploy/systemd/seti-api.service`, `seti-indexer.service` | The no-Docker path |
| `deploy/backup/pg-backup.sh`, `seti-backup.{service,timer}` | Nightly off-provider backup |
| `backend/src/worker.ts` | The standalone indexer entrypoint |

---

## 1. Decisions you make once (and cannot unmake)

Read these before signing up. None of them can be fixed later.

- **The home region is PERMANENT.** Always Free compute can only be created in
  the account's **home region**, and the home region is chosen at signup. Pick the
  region closest to your users (Nairobi → **Johannesburg**, `af-johannesburg-1`)
  and pick it deliberately. You cannot move it; a different region means a new
  account.
- **The card must be real.** A Visa or Mastercard with **international
  transactions** enabled. **Not** prepaid, **not** a virtual card, **not** a
  PIN-only debit. Oracle verifies with a small hold; it is refunded. A rejected
  card at signup is the most common way people bounce off this provider.
- **The `$300` trial is separate.** 30 days, spendable on *paid* shapes. It does
  **not** extend or enlarge Always Free, and Always Free resources do not consume
  it. Do not let the trial's existence tempt you into launching a paid shape "just
  for now" — that is what the budget alert in §11 is for.
- **Testnet, not mainnet, for a practice deploy.** `ALLOW_MAINNET=false` and
  `TEMPO_CHAIN_ID=42431` (Tempo Moderato). The mainnet flip is the owner-run
  procedure in `internal/mainnet-flip.md`.

## 2. The free tier, in the numbers that actually bind

| Resource | Always Free allowance | What bites |
| --- | --- | --- |
| Ampere A1 compute | **2 OCPU / 12 GB total** across all A1 instances | Split it (2×1 OCPU) or take it whole. This is the shape the backend image targets. |
| AMD micro VMs | 2 instances (VM.Standard.E2.1.Micro) | A fallback if A1 capacity is unavailable. |
| Block storage | **200 GB TOTAL, including boot volumes** | Not per instance. Two 100 GB boots consume the whole allowance. |
| Outbound transfer | 10 TB/month | Far above what Seti will use. |
| Object Storage | 20 GB | **Do not use it for the backup** — same account, same failure domain. See §8. |

**"Out of host capacity" is normal and documented.** The A1 shape is in high
demand; a launch attempt failing with that message is not an error in your
account. In order of what works best:

1. Launch the **smallest** A1 shape first — **1 OCPU / 6 GB**, not 2/12. It
   provisions far more often. This is the recommended start.
2. Retry; try a different **fault domain** (Availability Domain → fault domain
   dropdown) or a different AD in the same region.
3. Wait and retry the next day. Capacity is released continuously.

## 3. Launch the instance

1. Create the account and pick the **home region** (§1).
2. Compute → Instances → **Create instance**.
   - **Image:** Ubuntu (22.04 or 24.04). Oracle's Ubuntu images are what the
     iptables note in §5 assumes.
   - **Shape:** Ampere → `VM.Standard.A1.Flex`, **1 OCPU / 6 GB** to start.
   - **Networking:** create/assign a VCN with a public subnet. Assign a public
     IPv4.
   - **SSH key:** upload your public key.
   - **Boot volume:** the default (~47 GB) is plenty; see the 200 GB cap in §2.
3. Set the box to UTC and update it:
   ```bash
   sudo timedatectl set-timezone UTC
   sudo apt-get update && sudo apt-get -y upgrade
   ```

## 4. Install the runtime

### 4a. Docker path (uses `docker-compose.yml`)

```bash
sudo apt-get -y install docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"     # log out and back in for this to take effect
```

Then, from the repo root:

```bash
cp .env.example .env                          # set POSTGRES_PASSWORD (openssl rand -base64 24)
cp backend/.env.production.example backend/.env.production
$EDITOR backend/.env.production               # fill in every blank — see §6
docker compose run --rm migrate               # apply committed migrations (§7)
docker compose up -d                          # postgres + api + indexer
```

`docker compose ps` shows all three healthy. The API is published **only** on
`127.0.0.1:4000` — see §5.

### 4b. No-Docker path (uses systemd units)

A bare VM is a perfectly good target and avoids Docker's memory overhead on a
6 GB box.

```bash
# Node 20 (nodesource) — the repo requires >=20.
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get -y install nodejs postgresql postgresql-client
# Pin the Postgres CLIENT to the server major (§8.1). The bundled `postgresql`
# package is 16 on Ubuntu 24.04; on 22.04 install postgresql-16 +
# postgresql-client-16 from the PGDG repo so the backup job's tools match the DB.
sudo apt-get -y install postgresql-client-16 2>/dev/null || true
pg_dump --version && pg_restore --version    # verify: should print 16.x

# Postgres: create the role and database.
sudo -u postgres psql -c "CREATE ROLE seti LOGIN PASSWORD 'REPLACE_ME';"
sudo -u postgres createdb -O seti seti

# A service account and the application tree.
# Home is /var/lib/seti (where the backup job's rclone config lives, §8), NOT
# the app directory — a home that is also the checkout makes `git clone` fail
# and confusingly mixes a service's data with its code.
sudo useradd --system --create-home --home-dir /var/lib/seti --shell /usr/sbin/nologin seti
sudo install -d -o seti -g seti /opt/seti
sudo -u seti git clone <repo> /opt/seti        # cloning into an existing EMPTY dir is fine
cd /opt/seti && sudo -u seti npm ci

# Build. prisma generate MUST run before tsc.
sudo -u seti npx prisma generate --schema backend/prisma/schema.prisma
sudo -u seti npm run build --workspace backend

# Apply migrations (from the repo root).
sudo -u seti npx prisma migrate deploy --schema backend/prisma/schema.prisma

# Configuration.
sudo install -d -m 0750 -o root -g seti /etc/seti
sudo cp deploy/systemd/api.env.example /etc/seti/api.env
sudo cp deploy/systemd/indexer.env.example /etc/seti/indexer.env
sudo chmod 640 /etc/seti/api.env /etc/seti/indexer.env
sudo -e /etc/seti/api.env              # fill in every REPLACE_ME — see §6
sudo -e /etc/seti/indexer.env          # same DATABASE_URL/secrets, INDEXER_ENABLED=true

# Enable and start.
sudo cp deploy/systemd/seti-api.service deploy/systemd/seti-indexer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now seti-indexer.service seti-api.service
systemctl status seti-api.service seti-indexer.service
```

The API and the indexer are **two units on purpose**. The API is started with
`INDEXER_ENABLED=false`; the indexer runs `dist/worker.js`, which starts the
cursor loop and binds no port. Running them as one process would tie the scan
cadence to API restarts and make `systemctl restart seti-api` interrupt a scan for
no reason.

## 5. The two-firewall trap (read this before you wonder why nothing works)

On Oracle, **two independent firewalls** sit between the internet and your
process, and **both** must allow traffic. Allowing one and not the other is the
single most common reason a deploy "starts fine but the URL times out".

1. **The VCN Security List (cloud side).** In the console: Networking → VCN →
   Security Lists → the default list → **Add Ingress Rule**. Source `0.0.0.0/0`,
   protocol TCP, destination port `443` (and `80` if you use Let's Encrypt's HTTP
   challenge). This is the rule everyone remembers.
2. **The instance's own iptables (host side).** Oracle's Ubuntu images ship an
   `INPUT` chain that ends in a `REJECT` for everything but SSH. A rule appended
   with `iptables -A` lands **below** that REJECT and does nothing. You must
   **insert above it**, and you must read the line number rather than hardcode
   one — the image's chain is not stable across releases:

   ```bash
   sudo iptables -L INPUT -n --line-numbers
   #  ... find the line number of the REJECT, say line 6 ...
   sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -p tcp --dport 80  -j ACCEPT
   ```

   The `-I INPUT 6` inserts at position 6, pushing the REJECT down. Get the
   number from the command above — do **not** copy `6` from this document.
   Persist across reboots:

   ```bash
   sudo apt-get -y install iptables-persistent
   sudo netfilter-persistent save
   # or: sudo iptables-save | sudo tee /etc/iptables/rules.v4
   ```

**The recommendation: skip both firewalls entirely.**

### Expose the API with Cloudflare Tunnel, opening no inbound port

A Cloudflare Tunnel makes an **outbound** connection from the box to Cloudflare
and serves your hostname through it. No inbound port is opened on the oracle, so
**neither firewall needs a rule** — the security list stays as it shipped and the
iptables REJECT is never a problem. It is free, needs no card, and gives you TLS
without a certificate to renew.

```bash
# 1. Install cloudflared.
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb

# 2. Authenticate (opens a browser; on a headless box it prints a URL to visit).
cloudflared tunnel login

# 3. Create the tunnel and route a hostname to it.
cloudflared tunnel create seti-api
cloudflared tunnel route dns seti-api api.seti.example   # a domain you control on Cloudflare

# 4. Point it at the LOCAL API. Config at ~/.cloudflared/config.yml:
#    tunnel: seti-api
#    credentials-file: /home/<you>/.cloudflared/<tunnel-id>.json
#    ingress:
#      - hostname: api.seti.example
#        service: http://127.0.0.1:4000
#      - service: http_status:404

# 5. Run it as a service so it survives reboots.
sudo cloudflared service install
sudo systemctl enable --now cloudflared
curl https://api.seti.example/health      # {"status":"ok","service":"seti-api","version":"0.1.0","network":"mainnet","chainId":4217,"networkLabel":"Live"}
```

The API never listens on a public interface: it is bound to `127.0.0.1:4000`
(host mode) or published as `127.0.0.1:4000:4000` (compose), and `cloudflared`
runs on the same box. **Never** publish the database — it has no `ports:` entry in
`docker-compose.yml` and must keep none.

**When the tunnel exists, `CORS_ALLOWED_ORIGINS` must name the *web app's* origin,
not the API's.** CORS is about the browser's page, so the value is the Cloudflare
Worker/Pages origin from `operations.md` §7, e.g.
`CORS_ALLOWED_ORIGINS=https://seti-web.example.workers.dev`. A production boot
with it unset is refused on purpose.

## 6. The backend will refuse to boot on a bad config (that is the feature)

The backend parses its environment at module load and, with
`NODE_ENV=production`, **exits before binding a port** on an insecure or
incomplete configuration, naming the offending variable(s). There is no override
flag. The full list is in [`operations.md` §1](./operations.md#1-configuration-that-must-never-reach-production);
the ones a fresh deploy trips over are:

| Variable | Why it stops you |
| --- | --- |
| `CORS_ALLOWED_ORIGINS` | Empty means "deny every browser origin" — the API would boot and 403 the web app as an opaque CORS error. |
| `QUOTE_SIGNING_SECRET` | Unset or < 16 chars: each process would mint its own key, so a frozen quote dies on restart. Generate one (`openssl rand -base64 32`) and use the **same** value everywhere. |
| `JWT_SECRET` | Left at `change-me-in-production` — a public string, so not a secret. |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` | Missing: no token can be verified, so the API serves nobody. |
| `DEV_BYPASS_AUTH` | `true` serves the whole API to anyone as one shared dev user. |
| `TEMPO_CHAIN_ID` | Unset: the server cannot choose a network for you. |

If startup fails, this is what you will see (and the message tells you what to
fix — do not work around it, and do not add an override):

```
[INSECURE_PRODUCTION_CONFIG] Refusing to start: NODE_ENV=production with an
insecure configuration. Offending variable(s): CORS_ALLOWED_ORIGINS.
```

On the systemd path: `journalctl -u seti-api -n 50`. On compose:
`docker compose logs api`.

## 7. Migrations

Never `prisma migrate dev` against a deployed database — it is interactive and
will hang a non-interactive deploy. The release step is `migrate deploy`, which
applies only what is committed (`operations.md` §3).

- **Compose:** `docker compose run --rm migrate` (a one-shot service behind the
  `tools` profile; it never starts as part of `up`).
- **systemd:** `sudo -u seti npx prisma migrate deploy --schema backend/prisma/schema.prisma`
  before restarting `seti-api.service`.

Run it **before** the new revision starts serving, and keep migrations backward
compatible with the previous revision (expand → migrate → contract).

## 8. Nightly backups, off-provider

The database **is** the ledger, and the indexer cursor is a row inside it whose
loss is unrecoverable with `INDEXER_BOOTSTRAP_LOOKBACK=0`
([`operations.md` §4](./operations.md#4-the-indexer-cursor-is-data)). An
untested dump is a hope; §9 restores it for real.

**Why Cloudflare R2 and not Oracle Object Storage.** Oracle gives 20 GB free, but
it lives in the **same account** as the instance. An account takeover, a billing
suspension or a mis-click that deletes the tenancy takes the database *and* its
only backup. R2 is a different provider with its own free tier: 10 GB storage,
zero egress fees. The backup must go off-provider.

```bash
# 1. rclone — a single static binary, no application dependency.
curl -fsSL https://rclone.org/install.sh | sudo bash
rclone version

# 2. Cloudflare dashboard → R2 → create bucket `seti-backups`, then create an
#    API token with Object Read & Write. Put the remote in the service user's
#    config (see deploy/backup/rclone.conf.example for the fields):
sudo install -d -m 0700 -o seti -g seti /var/lib/seti/.config/rclone
sudo cp deploy/backup/rclone.conf.example /var/lib/seti/.config/rclone/rclone.conf
sudo chmod 600 /var/lib/seti/.config/rclone/rclone.conf
sudo -e /var/lib/seti/.config/rclone/rclone.conf       # fill in the R2 fields

# 3. Job configuration.
sudo cp deploy/backup/backup.env.example /etc/seti/backup.env
sudo chmod 640 /etc/seti/backup.env
sudo -e /etc/seti/backup.env                           # set MODE / R2_BUCKET / etc.

# 4. Install the script and the timer.
sudo install -m 0755 deploy/backup/pg-backup.sh /opt/seti/deploy/backup/pg-backup.sh
sudo cp deploy/backup/seti-backup.service deploy/backup/seti-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now seti-backup.timer
systemctl list-timers seti-backup.timer

# 5. Run it once, NOW, and read the output.
sudo systemctl start seti-backup.service
journalctl -u seti-backup.service -n 40
rclone ls r2:seti-backups/seti/postgres/
```

The script (`deploy/backup/pg-backup.sh`):

- dumps with `pg_dump --format=custom --compress=9` (already compressed),
- **refuses to upload an archive it cannot re-read** (`pg_restore --list`) and
  fails if the file is implausibly small,
- uploads to R2, then re-checks what landed (`rclone check --size-only`),
- deletes archives older than `RETENTION_DAYS` (default 30).

`MODE=docker` reaches a compose Postgres through `docker compose exec` precisely
because that database is **not** published to the host; `MODE=host` runs
`pg_dump` against `DATABASE_URL` on the box. Set the one that matches your install.

### 8.1 Pin the Postgres client to the database server's major version

Both mismatches are real and both were hit while writing this runbook. The
`postgres:16` in `docker-compose.yml` is the server major; the client must be the
**same** major — not older, not newer:

```bash
sudo apt-get -y install postgresql-client-16     # match the server
pg_dump --version && pg_restore --version        # both should print 16.x
```

- **Client older than the dump** — a dump written by a newer `pg_dump` cannot be
  read at all:
  ```
  pg_restore: error: unsupported version (1.16) in file header
  ```
  (pg_dump 18's archive version against a PG16 `pg_restore`.) The archive is
  written but un-restorable on that box.
- **Client newer than the server** — `pg_restore` sets parameters the older
  server does not know, and the restore exits non-zero even though most of it
  applied:
  ```
  pg_restore: error: could not execute query: ERROR:  unrecognized configuration parameter "transaction_timeout"
  Command was: SET transaction_timeout = 0;
  pg_restore: warning: errors ignored on restore: 1
  ```

`pg-backup.sh` prints `pg_dump`, `pg_restore` and the server major on every run,
**fails** when the dump is newer than the restore, and **warns** when the restore
does not match the server. If you see the warning, fix the client before you need
the restore. (On the compose path the dump is written by the container's own
`pg_dump` — correctly versioned — so `MODE=docker` avoids the first trap entirely.)

**Cron alternative** (if you would rather not use a timer):

```cron
# /etc/cron.d/seti-backup — nightly at 01:00, as the seti user, off-provider.
0 1 * * * seti . /etc/seti/backup.env && /opt/seti/deploy/backup/pg-backup.sh >> /var/log/seti-backup.log 2>&1
```

A systemd timer is preferred (`Persistent=true` replays a run missed while the box
was down; cron does not).

## 9. Restore — rehearse this once, before you need it

A backup whose restore has never been run is not a backup. Do this once against a
scratch database and confirm the cursor row and recent transactions come out.

**Fetch the archive off-provider:**

```bash
rclone copy r2:seti-backups/seti/postgres/seti-20261014T010000Z.dump /tmp/
pg_restore --list /tmp/seti-20261014T010000Z.dump | head   # sanity: it parses
```

**Restore into a SECOND database** (never over the live one until you have
decided to):

```bash
# 9a. Create a scratch target.
createdb seti_restore

# 9b. Restore. --clean --if-exists makes it re-runnable; --no-owner avoids
#     needing the original roles.
pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname postgresql://seti:REPLACE_ME@127.0.0.1:5432/seti_restore \
  /tmp/seti-20261014T010000Z.dump

# 9c. READ DATA OUT OF THE RESTORED COPY — this is the step that proves it.
psql postgresql://seti:REPLACE_ME@127.0.0.1:5432/seti_restore <<'SQL'
SELECT chain, "lastBlock", "updatedAt" FROM indexer_cursors ORDER BY chain;
SELECT count(*) AS transactions FROM transactions;
SELECT id, type, status, amount, "txHash" FROM transactions ORDER BY "createdAt" DESC LIMIT 5;
SQL
```

**Restore into the compose stack** (Postgres is not published, so pipe it in):

```bash
docker compose -f /opt/seti/docker-compose.yml exec -T postgres \
  createdb -U seti seti_restore
docker compose -f /opt/seti/docker-compose.yml exec -T postgres \
  pg_restore -U seti -d seti_restore --no-owner --no-privileges --clean --if-exists \
  < /tmp/seti-20261014T010000Z.dump
docker compose -f /opt/seti/docker-compose.yml exec -T postgres \
  psql -U seti -d seti_restore -c 'SELECT chain, "lastBlock" FROM indexer_cursors;'
```

**Promoting a restore to production** — only after the reads above succeeded:

1. Stop the writers: `docker compose stop api indexer` (or
   `systemctl stop seti-api seti-indexer`).
2. `pg_restore --clean --if-exists --dbname <the real DATABASE_URL> <archive>`.
3. Confirm the cursor row is present, then start the writers again.
4. The cursor is authoritative: do **not** seed or reset it, and never set
   `INDEXER_BOOTSTRAP_LOOKBACK > 0` on mainnet to "catch up".

## 10. Health check

The API already exposes `GET /health`, which returns
`{"status":"ok","service":"seti-api","version":"0.1.0","network":"mainnet","chainId":4217,"networkLabel":"Live"}`.
It is deliberately **cheap and touches nothing**: no database round-trip, so it
answers even when Postgres is down and an orchestrator will not restart a process
that is fine.

It also names the Tempo network this process serves, which is the cheapest way to
catch the one misconfiguration that otherwise fails silently: the Worker is built
with `NEXT_PUBLIC_TEMPO_CHAIN_ID` and the API reads `TEMPO_CHAIN_ID` from
`.env.production`, so a client signing on one chain against an API serving the
other fails every payment's verification. Compare `chainId` here against the
client's build value; they must be equal. See `docs/internal/ci.md` §2.

```bash
curl http://127.0.0.1:4000/health
# {"status":"ok","service":"seti-api","version":"0.1.0","network":"mainnet","chainId":4217,"networkLabel":"Live"}
curl https://api.seti.example/health
```

The payment-lifecycle probe is `GET /health/sweep`: it reads the database and
returns **503 when a payment is stuck or the sweep has stopped**, so point an
uptime monitor at it. That read is intentional — it is the alerting surface, not
a liveness probe. Wire the monitor to alert on 5xx; see `operations.md` §5 for why
"the logs are the pager" today.

## 11. The $1 budget alert

Always Free should cost nothing. The alert exists for the day it does not — a
paid shape left running, a stray block volume, an upgraded account.

1. Console → **Billing & Cost Management → Budgets → Create Budget**.
2. Budget amount: **$1**. (Small on purpose: any non-zero spend is a bug.)
3. Add an alert rule: **Actual spend > 1%** and **Forecasted spend > 100%**, both
   emailing you.
4. Note it only fires once there is a **billing** account — the free trial hides
   spend behind credits. On a pure Always Free account the correct steady state is
   **$0.00 every month**; a budget of $1 turns "should be free" into a check.

Also worth an email alert in the console: **Compute → Instances** capacity, and
**Idle reclamation** (below).

## 12. Idle reclamation — official policy, and it applies to you

Oracle may **reclaim** an Always Free instance that is idle: measured **over 7
days**, if the 95th-percentile **CPU < 20%**, **network < 20%**, and (for A1)
**memory < 20%**, the instance is eligible. A quietly-correct Seti API sits well
below those thresholds between payments, so this is a real risk for a low-traffic
practice deploy, not a theoretical one.

Mitigations, cheapest first:

- Accept it and rely on §9's restore path plus the nightly backup — the cursor
  comes back with the database.
- Keep something genuinely useful on the box (the indexer's 15s tick is steady
  but light; it does not by itself clear the threshold).
- If you need it to stay up, that is a decision to make deliberately rather than
  to discover from a reclaimed instance.

## 13. Costs, honestly

| Line | $0 path | Trigger for cost |
| --- | --- | --- |
| Compute (A1, 2 OCPU / 12 GB) | Always Free | Exceeding the allowance, or a non-A1 paid shape |
| Block storage (200 GB incl. boot) | Always Free | Extra volumes beyond 200 GB total |
| Outbound transfer (10 TB/mo) | Always Free | Code that fetches far more than it serves |
| Postgres | On the same box | Moving to a managed DB |
| Backups | R2 free tier (10 GB, 0 egress) | Archives beyond 10 GB (30 nightly dumps are ~MBs) |
| TLS / exposure | Cloudflare Tunnel, free | — |
| Web app | Cloudflare Workers/Pages free tier | `operations.md` §7 |

Total: **$0/month**, with the budget alert in §11 as the tripwire.

---

## AWS

The owner has AWS credits, so this is the likely second target. **Everything in
this document above the provider sections is unchanged here** — the same
`Dockerfile`, `docker-compose.yml`, `deploy/systemd/` units and `pg-backup.sh`
run on Lightsail, EC2, Oracle or a Hetzner box. Only the *host provisioning* and
the *firewall* differ.

### Lightsail — the recommendation on AWS

The 2 GB bundle is **~$12/month** and includes:

- **2 vCPU, 2 GB RAM, 60 GB SSD**
- a **STATIC IPv4** (included, not an add-on)
- **3 TB of transfer** per instance

That is cheaper than the nearest EC2 build — `t4g.small` $12.26 + 30 GB gp3
$2.40 + a public IPv4 $3.65 ≈ **$18/month** — and it doubles the memory of a 1 GB
EC2 micro. Creating the instance is **one screen**, and the firewall is a
**single networking page** rather than Oracle's two-firewall trap (§5). The
static IP is part of the bundle, so there is no separate elastic-IP line.

Deploy it exactly as §4 does: install Docker (or Node + Postgres for the systemd
path), bring up the compose stack, run `docker compose run --rm migrate`, then
`docker compose up -d`. The API is still published only on `127.0.0.1:4000`.
Then do §8 (off-provider backups) — **the same rule applies on AWS**: the backup
goes to Cloudflare R2, not to an S3 bucket in the same account as the instance.

### EC2, if he ever needs it

Credit-eligible instance types: **t3.micro, t3.small, t4g.micro, t4g.small,
c7i-flex.large, m7i-flex.large**.

- `t4g.micro` — 1 GB, **$6.13/month**
- `t4g.small` — 2 GB, **$12.26/month**
- add **gp3 at $0.08/GB-month** and **$3.65/month for a public IPv4**
- egress: **100 GB/month free account-wide**, then **$0.09/GB**

#### ⚠️ The one trap worth a warning box: never create a NAT Gateway

**A NAT Gateway is ~$32.85/month before it moves a single byte** — more than the
entire rest of this stack. Put the instance in a **public subnet with a security
group** instead. Nothing in Seti's single-box shape needs a NAT gateway; it
appears in tutorials for private-subnet topologies, which this is not.

#### Credits, the plan, and the cap

- **Promotional credits are only usable on the PAID account plan.** The **Free
  plan explicitly excludes other promotional credits**, so check which plan the
  account is on before assuming credits will cover the instance.
- After upgrading, set a **spend limit**: **AWS Settings → Billing → Create a
  spend limit**. It is the closest thing AWS has to a **hard cap**. Budget
  alerts, by contrast, only **email** and can **lag by a day** — they are not a
  substitute.
- The **Free plan ends after six months, or when the credits are spent,
  whichever comes first**, and then **closes the account** with data retained
  **90 days**. If this is a real practice deployment, the off-provider backup
  (§8) is what survives that, which is exactly why it is not optional.

### Cloudflare's role on AWS — stated correctly

On **Lightsail the 3 TB transfer allowance means Cloudflare is NOT needed for
the traffic bill.** Egress cost is the only reason a proxy is *load-bearing* on
EC2 (100 GB/month, then $0.09/GB). It still belongs **in front of the API**, but
for **exposure**: the proxy keeps the origin IP **out of DNS** and absorbs the
abuse a public box attracts. Do not describe it as an egress-cost measure on
Lightsail — that is not what it is doing there.

## Other hosts

The artefacts above are deliberately provider-agnostic: a `Dockerfile` and a
`docker-compose.yml` are the whole contract. Moving to a container platform
changes the *wiring*, not the application.

### Northflank (free Sandbox)

- **What changes:** you do not run Postgres on the box — Northflank gives you an
  **addon**. Provision a Postgres addon and set `DATABASE_URL` from it on both the
  API and indexer services. Do **not** put the bundled `postgres` service from
  `docker-compose.yml` on the platform.
- Build each service from `backend/Dockerfile`: two services, `api`
  (`node dist/index.js`, `INDEXER_ENABLED=false`) and `indexer`
  (`node dist/worker.js`), sharing the same image and env.
- Run `npx prisma migrate deploy` as a **pre-deploy/job step**, not a service.
- Map the API's public port to container port `4000`; the indexer exposes none.
- The Cloudflare Tunnel is unnecessary — Northflank provides the ingress and TLS.
  Set `CORS_ALLOWED_ORIGINS` to the web app's origin all the same.
- The Sandbox free tier sleeps idle services; the indexer is a long-running loop,
  so confirm the plan keeps it alive (a sleeping indexer is a stalled cursor).

### Railway (Hobby, ~$5/mo)

- **What changes:** Railway builds from the same `Dockerfile` and provides a
  managed Postgres you reference with `${{Postgres.DATABASE_URL}}`.
- Three services: `api`, `indexer`, and `postgres`. Set the `api` start command to
  `node dist/index.js` and the `indexer`'s to `node dist/worker.js`; give the
  indexer **no** public domain.
- Migrations: a one-off `railway run npx prisma migrate deploy`, or a release
  command on the API service.
- Not free — this is the $5 path. Everything else (env, boot guard, CORS,
  `INDEXER_ENABLED`) is identical to Oracle.

### What does NOT change on any host

- The production boot guard. A bad `CORS_ALLOWED_ORIGINS` or a missing
  `QUOTE_SIGNING_SECRET` fails the deploy loudly on every provider.
- The indexer cursor is data: whatever provides Postgres, that row is backed up
  with the database and must be, on every host.
- The backup must be **off-provider**: on Northflank or Railway the object store
  is a third account, but the rule is the same — a backup in the same tenancy as
  the database is not a backup.
