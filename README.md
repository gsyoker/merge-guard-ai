# Merge Guard AI

[中文文档](./README.zh-CN.md)

Merge Guard AI is a local-first prototype for an AI Coding merge safety layer.

It does not try to replace Codex, Claude Code, Cursor, or other coding agents. Instead, it gives those agents a structured merge analysis tool:

- detect Git conflict markers
- extract `base`, `ours`, and `theirs`
- expand the conflict to the nearest function, class, component, or method
- collect imports, referenced symbols, and path-based feature hints
- produce a human report and agent-ready JSON

## Quick Start

```bash
npm install
npm run demo
```

The current prototype has no runtime dependencies. Later versions can plug in Tree-sitter, TypeScript Compiler API, SCIP, or CodeQL for deeper semantic indexing.

Analyze a repo with unresolved merge conflicts:

```bash
npm run analyze
```

Analyze specific files:

```bash
node ./bin/merge-guard.mjs analyze --files src/pages/Login.tsx src/api/auth.ts
```

Emit JSON for another agent or MCP wrapper:

```bash
node ./bin/merge-guard.mjs analyze --json
```

Preview a deterministic resolution. By default this only prints a patch preview and does not modify files:

```bash
node ./bin/merge-guard.mjs resolve --files src/pages/Login.tsx --strategy recommended
```

Use the guided interactive flow:

```bash
node ./bin/merge-guard.mjs resolve --files src/pages/Login.tsx --interactive
```

It explains the impact and risk, asks the user to choose a strategy, previews the patch, and asks again before writing files.

Apply the previewed resolution:

```bash
node ./bin/merge-guard.mjs resolve --files src/pages/Login.tsx --strategy recommended --apply
```

Merge Guard creates a backup before writing files. Roll back the latest applied resolution:

```bash
node ./bin/merge-guard.mjs rollback
```

Available strategies:

- `recommended`: keep both functional intents when the heuristic can do so
- `keep_ours`: keep the current branch side
- `keep_theirs`: keep the incoming branch side
- `agent`: generate a prompt for the user's current coding agent and change no files

Use the current coding agent's model by generating an agent handoff prompt:

```bash
node ./bin/merge-guard.mjs resolve --strategy agent
```

Install local Git hooks:

```bash
node ./bin/merge-guard.mjs install-hooks
```

The hook currently runs on `pre-push` and blocks only high-risk unresolved conflicts.

## Product Shape

This prototype is the core engine for four future surfaces:

1. local CLI and Git hooks
2. GitHub / GitLab / Gitea PR bot
3. web merge workbench
4. MCP / tool API for Codex, Claude Code, Cursor, and similar agents

## Current Risk Heuristics

High risk:

- auth, payment, order, permission, database, migration, security, token, password

Medium risk:

- API, route, form, state, validation, schema, type, config, feature flag

Low risk:

- style, copy, layout, import-only or isolated UI hints

These are intentionally conservative and should later be replaced or enriched by project-specific feature maps.
