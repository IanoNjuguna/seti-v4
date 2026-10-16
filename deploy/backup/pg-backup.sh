#!/usr/bin/env bash
#
# Seti nightly database backup — dump, verify, upload OFF-provider.
#
# Why off-provider: Oracle Cloud Always Free gives 20 GB of Object Storage, but a
# backup that lives on the same account as the instance dies with the account.
# This script pushes to Cloudflare R2 (via rclone's S3-compatible remote), a
# different provider with its own free tier. That is the whole point — a copy on
# the box you are backing up is not a backup.
#
# What it protects: the entire ledger — `transactions`, the wallet registry,
# merchant claims and handles, `audit_logs`, and the indexer cursor. The cursor
# is an ordinary table row, so it rides along; losing it with
# INDEXER_BOOTSTRAP_LOOKBACK=0 leaves a permanent hole in Activity that no
# migration can reconstruct (docs/operations.md §4).
#
# A backup you have never restored is a hope, not a backup. This script refuses
# to upload an archive it cannot re-read (`pg_restore --list`) and re-checks the
# size of what landed on the remote. The restore procedure is in
# docs/deploy-oracle.md and MUST be rehearsed once.
#
# Configuration comes from the environment (systemd EnvironmentFile:
# /etc/seti/backup.env — see backup.env.example). Nothing secret is in this file.
#
# Usage:
#   ./pg-backup.sh                 # normal nightly run
#   MODE=docker ./pg-backup.sh     # dump from the compose Postgres container
#   DRY_RUN=1 ./pg-backup.sh       # dump + verify, but do not upload

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
# MODE=host   : run pg_dump on this machine against $DATABASE_URL.
# MODE=docker : Postgres runs in the compose stack and is NOT published, so reach
#               it through `docker compose exec` instead of a host port. This is
#               the correct mode for the docker-compose deployment.
MODE="${MODE:-host}"

R2_REMOTE="${R2_REMOTE:?R2_REMOTE must be set, e.g. r2 (the rclone remote name)}"
R2_BUCKET="${R2_BUCKET:?R2_BUCKET must be set, e.g. seti-backups}"
R2_PATH="${R2_PATH:-seti/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPRESS_LEVEL="${COMPRESS_LEVEL:-9}"
DRY_RUN="${DRY_RUN:-0}"

PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"

# ---------------------------------------------------------------------------
# Client-version guard.
#
# A pg_dump NEWER than the pg_restore that has to read the archive writes a
# format the older restore refuses outright:
#   pg_restore: error: unsupported version (1.16) in file header
# (that is pg_dump 18's archive version against a PostgreSQL 16 client). An
# archive the same box cannot read is not a backup, so this fails HERE rather
# than on the night it is needed. The fix is to pin the client to the database
# server's major version — `apt-get install postgresql-client-16` to match the
# `postgres:16` in docker-compose.yml — or to restore with a matching/newer
# pg_restore.
#
# The comparison is against whichever pg_dump actually WRITES the archive: in
# host mode the local one, in docker mode the one inside the postgres container.
# ---------------------------------------------------------------------------
client_major() { "$1" --version 2>/dev/null | grep -oE '[0-9]+' | head -1; }

if [ "$MODE" = "host" ]; then
  : "${DATABASE_URL:?DATABASE_URL must be set when MODE=host}"
  DUMP_MAJOR="$(client_major "$PG_DUMP_BIN")"
  # Prisma appends `?schema=public` to DATABASE_URL, and that parameter is
  # Prisma-only: libpq (pg_dump) rejects it with
  #   pg_dump: error: invalid URI query parameter: "schema"
  # Strip ONLY `schema`; keep `sslmode` and any other libpq option intact.
  DUMP_URL="$(printf '%s' "$DATABASE_URL" \
    | sed -E 's/([?&])schema=[^&]*&?/\1/g; s/[?&]$//')"
else
  COMPOSE_FILE="${COMPOSE_FILE:-/opt/seti/docker-compose.yml}"
  POSTGRES_USER="${POSTGRES_USER:-seti}"
  POSTGRES_DB="${POSTGRES_DB:-seti}"
  command -v docker >/dev/null || { echo "[backup] FATAL: docker not found" >&2; exit 1; }
  DUMP_MAJOR="$(docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump --version \
    2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
  SERVER_MAJOR="$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SHOW server_version' \
    2>/dev/null | grep -oE '^[0-9]+' | head -1 || true)"
fi

RESTORE_MAJOR="$(client_major "$PG_RESTORE_BIN")"
echo "[backup] clients: pg_dump ${DUMP_MAJOR:-?}, pg_restore ${RESTORE_MAJOR:-?}" \
     "${SERVER_MAJOR:+server ${SERVER_MAJOR}}"
if [ -n "$DUMP_MAJOR" ] && [ -n "$RESTORE_MAJOR" ] && [ "$DUMP_MAJOR" -gt "$RESTORE_MAJOR" ]; then
  echo "[backup] FATAL: pg_dump $DUMP_MAJOR produces an archive pg_restore $RESTORE_MAJOR" >&2
  echo "[backup]        cannot read (unsupported version in file header). Pin the client" >&2
  echo "[backup]        to the server's major, e.g. apt-get install postgresql-client-16." >&2
  exit 1
fi
# A restore client NEWER than the server also breaks — pg_restore 18's
# `SET transaction_timeout = 0` is an unknown parameter on a 16 server, and the
# restore exits non-zero. The dump is still fine; the tooling is not. Pin the
# client to the server's major.
if [ -n "${SERVER_MAJOR:-}" ] && [ -n "$RESTORE_MAJOR" ] \
   && [ "$RESTORE_MAJOR" -ne "$SERVER_MAJOR" ]; then
  echo "[backup] WARNING: pg_restore $RESTORE_MAJOR does not match server $SERVER_MAJOR." >&2
  echo "[backup]          Restores may fail (e.g. SET transaction_timeout). Install" >&2
  echo "[backup]          postgresql-client-$SERVER_MAJOR to match the database." >&2
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_NAME="seti-${STAMP}.dump"
REMOTE_DIR="${R2_REMOTE}:${R2_BUCKET}/${R2_PATH}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
ARCHIVE="$WORK/$ARCHIVE_NAME"

echo "[backup] seti pg_dump $(date -u +%FT%TZ) mode=$MODE remote=$REMOTE_DIR"

# ---------------------------------------------------------------------------
# 1. Dump. Custom format (-Fc) with built-in zlib compression (-Z), so the file
#    is already compressed on the wire and pg_restore can read it directly.
#    --no-owner/--no-privileges keep the archive portable: the restore does not
#    need the same roles to exist.
# ---------------------------------------------------------------------------
if [ "$MODE" = "docker" ]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --format=custom --compress="$COMPRESS_LEVEL" --no-owner --no-privileges \
    > "$ARCHIVE"
else
  "$PG_DUMP_BIN" --format=custom --compress="$COMPRESS_LEVEL" \
    --no-owner --no-privileges --dbname "$DUMP_URL" > "$ARCHIVE"
fi

BYTES="$(wc -c < "$ARCHIVE" | tr -d ' ')"
if [ "$BYTES" -lt 1024 ]; then
  echo "[backup] FATAL: archive is only ${BYTES} bytes — dump almost certainly failed" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Verify the archive is READABLE before it is trusted. `pg_restore --list`
#    parses the table of contents; a truncated or corrupt dump fails here rather
#    than on the day it is needed.
# ---------------------------------------------------------------------------
"$PG_RESTORE_BIN" --list "$ARCHIVE" > /dev/null
ENTRIES="$("$PG_RESTORE_BIN" --list "$ARCHIVE" | grep -c 'TABLE DATA' || true)"
echo "[backup] dump ok: ${ARCHIVE_NAME} (${BYTES} bytes, ${ENTRIES} table-data entries)"

if [ "$DRY_RUN" = "1" ]; then
  echo "[backup] DRY_RUN=1 — skipping upload"
  exit 0
fi

command -v "$RCLONE_BIN" >/dev/null || {
  echo "[backup] FATAL: rclone not found; see docs/deploy-oracle.md §6 for installing it" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# 3. Upload OFF-provider.
# ---------------------------------------------------------------------------
"$RCLONE_BIN" copy --no-traverse "$ARCHIVE" "$REMOTE_DIR/"

# ---------------------------------------------------------------------------
# 4. Prove the object landed and matches what we sent. A failed upload that
#    exits 0 because the remote silently dropped the object is the classic quiet
#    backup failure; `check --size-only` fails the run instead.
# ---------------------------------------------------------------------------
"$RCLONE_BIN" check --size-only "$WORK" "$REMOTE_DIR" --include "$ARCHIVE_NAME"

# ---------------------------------------------------------------------------
# 5. Retention. Delete remote archives older than RETENTION_DAYS.
# ---------------------------------------------------------------------------
"$RCLONE_BIN" delete --min-age "${RETENTION_DAYS}d" "$REMOTE_DIR/"

echo "[backup] done: $REMOTE_DIR/$ARCHIVE_NAME ($(date -u +%FT%TZ))"
