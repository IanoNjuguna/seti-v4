#!/usr/bin/env bash
# The chain-coherence gate for a deploy: the API on the box must serve the chain
# the client for this commit was built for.
#
# WHY THIS EXISTS
#
# The Worker is built with `NEXT_PUBLIC_TEMPO_CHAIN_ID`, a repository variable, and
# the API reads `TEMPO_CHAIN_ID` from the box's `/home/ubuntu/seti/.env.production`.
# Two settings, two places, deployed by two jobs from one commit, and nothing
# compared them (#201). A Worker signing on one chain in front of an API serving the
# other fails the verification of EVERY payment, while both deploys report success
# and both health probes answer `ok`.
#
# It reads the value from the RUNNING container's `/health` and not from a file on
# the runner, so it reports what is actually serving rather than what somebody
# intended to configure. `/health` carries it since #200.
#
# HOW IT RUNS
#
#   * concatenated onto the remote deploy script by `.github/workflows/deploy.yml`,
#     so the box gets one file and this logic has exactly one copy; or
#   * executed directly as a CLI, which is what `scripts/check-deploy-chain.mjs`
#     does to prove every branch of it without a box.
#
# Every failure is a ::error:: line naming what is wrong and what to change: this
# runs at the end of a deploy, and the person reading it has already shipped.

# assert_chain_coherence <health-url> <expected-chain-id>
assert_chain_coherence() {
  local health_url="${1:?assert_chain_coherence needs a health URL}"
  local expected="${2:-}"
  local body served

  # Fail closed on an empty expectation: this job cannot invent the client's chain,
  # and a check that skips when its input is missing is the check that never runs.
  if [ -z "$expected" ]; then
    echo "::error::NEXT_PUBLIC_TEMPO_CHAIN_ID is empty in this workflow's view, so there is no chain to compare the API against. The Worker cannot be built without it either (web/scripts/guard-production-env.mjs refuses), which means this commit cannot have been deployed coherently. Refusing to report a coherent deployment."
    return 1
  fi

  if ! body="$(curl -fsS --max-time 5 "$health_url" 2>/dev/null)"; then
    echo "::error::$health_url did not answer while reading the served chain. The container passed liveness and then stopped reporting, so the chain it serves is unknown."
    return 1
  fi

  # The only `chainId` in the body, as a JSON number. A build from before #200
  # answers without one, and that is a failure rather than a silent pass: an
  # unreadable chain cannot be asserted equal to anything.
  served="$(printf '%s' "$body" | sed -n 's/.*"chainId":\([0-9][0-9]*\).*/\1/p')"
  if [ -z "$served" ]; then
    echo "::error::$health_url answered without a chainId, so the deployed API does not report which chain it serves: $body"
    return 1
  fi

  if [ "$served" != "$expected" ]; then
    echo "::error::Chain mismatch: the API on this box serves $served, and the client for this commit was built for $expected. Every payment would be signed on one chain and reconciled against another, so all of them would fail verification while both deploys reported success. Fix one of the two and deploy again: TEMPO_CHAIN_ID=$expected in /home/ubuntu/seti/.env.production, or gh variable set NEXT_PUBLIC_TEMPO_CHAIN_ID --body \"$served\". See docs/internal/ci.md section 2."
    return 1
  fi

  echo "==> chain coherence: the API serves $served, and the client for this commit was built for $expected"
  return 0
}

# Executed directly (`bash scripts/deploy-chain-gate.sh <url> <chain>`): behave as a
# CLI. Under the deploy's `bash -s` this file is the head of a concatenated script,
# so BASH_SOURCE is empty and this must not fire there.
if [ "${BASH_SOURCE[0]:-}" = "$0" ]; then
  assert_chain_coherence "$@"
fi
