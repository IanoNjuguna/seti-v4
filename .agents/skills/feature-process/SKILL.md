---
name: feature-process
description: Use when starting ANY change to this repo — new feature, fix, refactor, dependency bump or docs update — and when shipping one. Every change goes issue first, then a branch named for it, then a pull request that carries the tradeoffs.
type: prompt
whenToUse: Before writing the first line of code for any change, before creating a branch, before committing, before opening or merging a pull request, or when asked to ship/finish work in this repository.
---

# Feature process

Every change to this repository follows one path. There is one exception, and it
is production being down.

    issue  →  branch  →  work  →  npm run verify  →  pull request  →  merge

`main` is production: pushing to it deploys. So "before prod" means "before the
merge", and nothing reaches `main` except through a pull request.

## 1. The issue comes first

Write it before any code, with `gh issue create`. If you cannot fill in these
five fields, the work is not understood yet, and that is the point of the step:

- **Problem.** What is wrong or missing today, for whom.
- **Scope and non-goals.** What this change touches, and what it deliberately
  does not. Non-goals are what stop the work growing a second head.
- **Acceptance criteria.** Testable statements, not adjectives. "Receipt shows
  the fee in KES to two decimals" is a criterion; "receipts look better" is not.
- **Risk and rollback.** What breaks if this is wrong, and how it is undone.
  Name anything on-chain, anything touching money, and anything that migrates
  data.
- **Evidence of the gate.** For a non-trivial change: which `check:*` suite
  covers it, or which one gets written.

Then note the number, because the branch name and the PR both carry it.

## 2. Branch from current main, named for the issue

```bash
git switch main && git pull
git switch -c feat/142-fee-line-on-receipt
```

The number after the slash is the issue number. The prefix is the kind of
change: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `skill`. Never work
on `main`, and never commit to it.

The branch has to exist BEFORE the first commit of the work. `gh pr merge
--delete-branch` deletes the head branch and leaves the working tree on `main`, so
a commit made straight after a merge lands on `main` — the one branch this repo
never commits to, and whose push is refused, which is how you find out. Check
`git branch --show-current` after any merge. Recover with `git branch <name> &&
git switch <name> && git branch -f main origin/main`; never `git reset --hard`,
which discards whatever another session has uncommitted in the same tree.

## 3. Work in small commits that stand alone

`commit` skill for message format. Reference the issue in the body:

```
feat: carry the fee through to the receipt card

The receipt summed principal and fee into one figure, so a customer could not
see what the 2% cost them (#142).
```

If the shape of the work changes while you are in it, change the issue in the
same session. An issue that describes something other than the branch is worse
than no issue.

## 4. The gate, before the PR exists

```bash
npm run verify
```

Green, or the PR is not opened. Do not open a PR "to see if CI passes"; run it
locally first. If a suite fails because the database is down, start it (`docker
start seti-postgres`), do not report the gate as failing.

If the change touches a public surface — a route, a response shape, a refusal code, an
env default — `verify` is not the whole gate: the MCP tools and the docs move in the
same PR. See the `surface-parity` skill for what to touch and how to prove it.

## 5. The pull request carries the reasoning

`gh pr create` with `.github/pull_request_template.md` as the shape. What
matters, and what the template asks for:

- `Closes #142` — a real number. CI rejects a PR without one.
- **What changed**, in the customer's terms, not file by file.
- **How it was verified** — the actual command and the actual result.
- **Decisions and tradeoffs** — what else was possible, why it was rejected,
  what this costs. A tradeoff left out of the PR is a decision nobody reviewed.
- **Risk and rollback**, copied from the issue and updated if it moved.
- Screenshots for anything visual. A UI claim without a picture is unverified.

Request review from `@IanoNjuguna`; `CODEOWNERS` already assigns it.

## 6. Merge is deploy

Squash or merge per the PR, then confirm the deploy workflow went green. If it
did not, that is now a P0 and the exception below applies.

## The one exception

Production being broken outranks this process. For that:

1. Label the PR `p0-hotfix`. The `pr-guard` check passes with that label and
   fails without it.
2. Say in the PR what is broken and what the fix does.
3. File the issue within 24 hours and link it retroactively.

Anything else is not a P0. "It is small" is not an exception, and "I will write
the issue after" is the failure mode this rule exists to prevent.

## What CI enforces, and what it cannot

`pr-guard` fails a pull request when:

- the body has no `Closes #<number>` / `Fixes #<number>` / `Refs #<number>`
- the branch name carries no issue number and the PR is not `p0-hotfix`

It does **not** check that the tradeoffs section is good, because a regex that
can be satisfied by a heading teaches everyone to satisfy the heading. That part
is review, and it is why the section exists.

Branch protection requires the `verify` check on `main`. Your own PRs cannot be
approved by you, so review is not enforced mechanically; reading your own diff
before merging is.

## Starting from an existing pile of work

If you find uncommitted work with no issue, do not invent a PR over it and do
not normalise it into main. Ask the owner whether it is grandfathered or gets an
issue, and record the answer here.
