# `deploy/`

Host-side deploy artefacts. **None of this is a runtime dependency of the
application** — the backend's `dependencies` are unchanged. Docker, rclone and
systemd live outside the app; if any of them is missing, the app still runs, and
these files are inert.

The runbook that uses all of this is
[`docs/deploy-oracle.md`](../docs/deploy-oracle.md). Start there.

| Path | What it is |
| --- | --- |
| `systemd/seti-api.service` | API as a systemd unit (the no-Docker path) |
| `systemd/seti-indexer.service` | Indexer loop as its own unit |
| `systemd/api.env.example` | `EnvironmentFile` for the API → `/etc/seti/api.env` |
| `systemd/indexer.env.example` | `EnvironmentFile` for the indexer → `/etc/seti/indexer.env` |
| `backup/pg-backup.sh` | Nightly dump → verify → upload (rclone → Cloudflare R2) |
| `backup/seti-backup.service` / `.timer` | systemd timer that runs it at 01:00 |
| `backup/backup.env.example` | Job config → `/etc/seti/backup.env` |
| `backup/rclone.conf.example` | The `r2` rclone remote (S3-compatible) |

The Docker path lives at the repo root: `backend/Dockerfile`,
`.dockerignore`, and `docker-compose.yml`.

**One decision to make before enabling anything: Docker or systemd.** They are
two ways to run the same two processes, not two halves of one install. Pick one.
Running both means two indexers competing for the cursor lock (harmless, since
`indexer_cursors.lockedBy` is a single-writer lock, but wasteful and confusing).

Two things are easy to get wrong and are called out in the runbook:

- The **two firewalls** (§5): Oracle's VCN Security List *and* the instance's own
  iptables. Insert rules ABOVE the `REJECT` line, reading its number from
  `iptables -L INPUT -n --line-numbers`.
- The **indexer cursor is data** (§4 of `operations.md`): it is an ordinary row in
  `indexer_cursors`, so it rides along with the database backup — which is exactly
  why the backup must be real and its restore rehearsed.
