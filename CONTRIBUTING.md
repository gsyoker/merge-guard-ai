# Contributing

Thanks for helping improve Merge Guard AI.

## Local Development

```bash
npm install
npm run demo
```

Run the analyzer against explicit files:

```bash
node ./bin/merge-guard.mjs analyze --files examples/login-conflict.tsx
```

Emit JSON for agent integrations:

```bash
node ./bin/merge-guard.mjs analyze --files examples/login-conflict.tsx --json
```

## Project Direction

The project is building toward four integration surfaces:

- local CLI and Git hooks
- PR/MR bot for GitHub, GitLab, and Gitea
- web merge workbench
- MCP/tool API for coding agents

Please keep contributions focused on merge safety, feature-impact analysis, conflict explanation, and safe patch generation.
