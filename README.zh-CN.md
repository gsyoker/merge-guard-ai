# Merge Guard AI

[English](./README.md)

Merge Guard AI 是一个本地优先的 AI Coding 合并安全层原型。

它不试图替代 Codex、Claude Code、Cursor 或其他 Coding Agent，而是为这些 Agent 提供一个结构化的合并分析工具：

- 检测 Git 冲突标记
- 抽取 `base`、`ours` 和 `theirs`
- 将冲突扩展到最近的函数、类、组件或方法上下文
- 收集 import、引用符号和基于路径的功能线索
- 输出给人看的报告，以及给 Agent 使用的 JSON

## 快速开始

```bash
npm install
npm run demo
```

当前原型没有运行时依赖。后续版本可以接入 Tree-sitter、TypeScript Compiler API、SCIP 或 CodeQL，用于更深层的语义索引。

分析当前仓库里未解决的合并冲突：

```bash
npm run analyze
```

分析指定文件：

```bash
node ./bin/merge-guard.mjs analyze --files src/pages/Login.tsx src/api/auth.ts
```

输出 JSON，交给其他 Agent 或 MCP wrapper 使用：

```bash
node ./bin/merge-guard.mjs analyze --json
```

预览冲突解决方案。默认只预览，不会修改文件：

```bash
node ./bin/merge-guard.mjs resolve --files src/pages/Login.tsx --strategy recommended
```

如果希望一步步选择，可以使用交互式模式：

```bash
node ./bin/merge-guard.mjs resolve --files src/pages/Login.tsx --interactive
```

它会先展示冲突影响、风险和可选方案，再让你选择合并策略，最后二次确认是否写入文件。

确认方案后再真正写入文件：

```bash
node ./bin/merge-guard.mjs resolve --files src/pages/Login.tsx --strategy recommended --apply
```

写入前会自动备份原文件。如果发现合并不对，可以恢复最近一次备份：

```bash
node ./bin/merge-guard.mjs rollback
```

可用的确定性策略：

- `recommended`：尽量保留双方功能意图
- `keep_ours`：保留当前分支
- `keep_theirs`：保留传入分支
- `agent`：不改文件，生成给当前 Coding Agent 使用的上下文提示

如果希望直接使用当前 Coding Agent 的模型，可以生成一份 Agent 交接提示：

```bash
node ./bin/merge-guard.mjs resolve --strategy agent
```

这种模式不会内置调用任何模型，而是把冲突上下文、功能影响、风险和双方代码整理好，交给用户当前正在使用的 Codex、Claude Code、Cursor 等 Agent 继续生成更智能的 patch。

安装本地 Git hooks：

```bash
node ./bin/merge-guard.mjs install-hooks
```

当前 hook 运行在 `pre-push` 阶段，只会阻断高风险的未解决冲突。

## 它解决什么问题

AI Coding 让写代码变快了，但也让很多用户更容易一路确认、提交和推送代码，却不清楚这次改动到底影响了哪些功能。

Merge Guard AI 关注的不是“代码写得好不好”，而是：

- 这次改动影响了哪些功能？
- 两边冲突的代码分别代表什么业务意图？
- 合并后是否会丢失登录、权限、订单、支付等关键逻辑？
- 是否应该自动合并、用户确认，还是交给人工处理？
- 能否把冲突信息整理成 Codex、Claude Code、Cursor 等 Agent 可以继续处理的结构化上下文？

## 示例输出

```text
Merge Guard AI Report

Repository: /path/to/repo
Conflicts: 1
Highest risk: high

1. examples/login-conflict.tsx:12-26
   Risk: high
   Feature: Login
   Symbol: function submitLogin
   Why: touches high-risk keyword "auth"; touches high-risk keyword "login"; touches high-risk keyword "password"

   Suggested user choices:
   - explain_only: Explain first, do not auto-merge (recommended)
   - recommended: Keep both functional intents (requires_user_confirmation)
   - keep_ours: Keep HEAD (manual_confirmation_required)
   - keep_theirs: Keep feature/password-lockout (manual_confirmation_required)
```

## 产品形态

这个原型是未来四类载体的核心引擎：

1. 本地 CLI 和 Git hooks
2. GitHub / GitLab / Gitea PR Bot
3. Web 功能合并工作台
4. 面向 Codex、Claude Code、Cursor 等 Coding Agent 的 MCP / Tool API

## 当前风险规则

高风险：

- auth、payment、order、permission、database、migration、security、token、password

中风险：

- API、route、form、state、validation、schema、type、config、feature flag

低风险：

- style、copy、layout、仅 import 冲突或孤立 UI 线索

这些规则目前是保守启发式判断。后续应该结合项目级功能地图、代码索引、测试覆盖和历史 PR 继续增强。

## 面向 Agent 的使用方式

Merge Guard AI 可以输出结构化 JSON：

```bash
node ./bin/merge-guard.mjs analyze --json
```

其他 Coding Agent 可以读取 `conflicts[].agentInput`，然后继续完成：

- 解释冲突
- 生成合并方案
- 生成 patch
- 应用用户选择的方案
- 运行测试和类型检查

## 开发方向

短期目标：

- 增强 `resolve` 的自动合并策略和交互式选择
- 增强 TypeScript / React / Vue 项目的上下文识别
- 增加 GitHub Action / PR comment 输出
- 提供 MCP tool API

中期目标：

- 接入项目功能地图
- 支持 API contract diff
- 支持测试建议和风险门禁
- 提供 Web 合并工作台
