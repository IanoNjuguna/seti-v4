---
name: surface-parity
description: Use when shipping a change to a public surface. Keeps the MCP server and the docs in step with the code, in the same PR.
---

# Surface parity

A **public surface** is anything another person's code or browser depends on: an HTTP
route, its request and response shape, a refusal code, an env var, a config default, a
tool, or a sentence on a page that states a limit.

MCP tools and docs are part of the product. A route that exists without a tool is an
integration nobody can use; a doc that still describes a removed code is a lie with a
version number on it.

## The rule

Change the surface and its mirrors in the **same pull request**:

1. the code
2. `mcp-server/src/tools/*.ts`
3. `docs/*.md`, plus `docs-site/sidebars.ts` when a page is added or removed

If the three cannot fit in one PR, the PR body names which mirror is deferred and links
the issue that carries it. Silence is not deferral.

## What to touch, by kind of change

| Change | Code | MCP | Docs |
| --- | --- | --- | --- |
| New route or endpoint | `backend/src/routes/*.ts` | a tool, if an agent could use it | `docs/api-reference.md` |
| Field added or renamed in a response | route schema + service type | the tool's output type | the page and every curl example |
| New refusal code | `services/payment-refusal.ts`, `routes/refusal-response.ts` | surfaced as an error carrying the code, never as prose | the code table |
| Removed feature | delete the route | delete the tool | delete the page, fix the sidebar |
| Env var, or a changed default | `config/env.ts` | — | `docs/`, `backend/.env.example` |
| A copy claim about a fee, limit or audit | the component | — | `product-copy-integrity` skill |

## Verify, do not assume

- `npm run verify` from the root: typecheck, lint, backend check suites.
- `node mcp-server/scripts/smoke.mjs` against practice. A new tool must appear there and
  pass; a removed one must be gone, not failing.
- `npm run build` in `docs-site/` whenever a page or sidebar entry moved. A dangling
  sidebar entry is a warning nobody reads.
- Search the **old** name across `docs/`, `docs-site/`, `mcp-server/`, `web/`. Stale
  strings are the usual residue, and they survive typecheck because nothing compiles a
  markdown file.
- Read the tool's description the way a model reads it. That text is an instruction: if
  it describes the previous behaviour, the agent obeys the previous behaviour.

## Pitfalls

- **A tool that types its own view of the response.** It keeps compiling after the route
  changes shape, and fails only in a real call. Check the tool against a live response,
  not against its own interface.
- **Documenting a code the server no longer emits.** Delete the row. Do not mark it
  deprecated: nobody can receive it, so the row teaches a fiction.
- **Tense as a claim.** "The API will return the charge once..." is false the day it
  ships. Write what it does.
- **Drift between `docs/mcp.md` and the tool list.** The version and the inventory move
  together or not at all.
- **A tool that requires a credential the surface does not.** If the receive path takes a
  signature rather than a key, the tool must not demand a token, and its description must
  say so.

## Ownership

This skill owns "MCP and docs move with the code". It does not own the issue → branch →
PR workflow (`feature-process`), copy honesty (`product-copy-integrity`), or the shape of
new UI (`modular-ui-authoring`). Cross-reference, do not restate.
