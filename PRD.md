# PRD: Antigravity Companion — Claude Code Plugin

> 在 Claude Code 中分派编码任务给 Antigravity CLI，完成后自动返回让 Claude Code 审查。

## Problem Statement

开发者同时使用 Claude Code 和 Antigravity CLI（agy）两个 AI 编码工具，但目前无法在 Claude Code 中直接调用 Antigravity 的能力。当用户在 Claude Code 里构思方案后，需要手动切换到 agy 执行编码，再手动切回 Claude Code 审查结果——流程断裂，效率低。

## Solution

做一个 Claude Code 插件，在 Claude Code 里通过 MCP server 调用 `agy -p` 非交互模式分派编码任务，完成后自动返回结果触发 Claude Code 审查。功能、流程、架构与 `cc-plugin-codex`（Codex → Claude Code 方向）完全对称，只是方向反转为 Claude Code → Antigravity CLI。

## User Stories

### 核心流程

1. As a Claude Code user, I want to delegate a coding task to Antigravity CLI, so that I can use agy's capabilities without leaving Claude Code
2. As a Claude Code user, I want the delegated task to run in foreground and return results automatically, so that I can see the outcome immediately
3. As a Claude Code user, I want the delegated task to run in background and return a job ID, so that I can continue working in Claude Code while agy executes
4. As a Claude Code user, I want to review code changes made by Antigravity after a task completes, so that I can verify the quality of the output
5. As a Claude Code user, I want to run an adversarial review that challenges implementation choices, so that I can catch assumptions and failure modes before shipping

### 任务管理

6. As a Claude Code user, I want to check the status of a running Antigravity task, so that I know whether it's still executing or has completed
7. As a Claude Code user, I want to see phase tracking (starting → executing → verifying → finalizing → completed), so that I understand what stage the task is at
8. As a Claude Code user, I want to see recent log entries for a running task, so that I can monitor progress in real time
9. As a Claude Code user, I want to cancel a running Antigravity task, so that I can stop long-running or mistaken delegations
10. As a Claude Code user, I want to list all Antigravity jobs, so that I can see the history of delegated tasks
11. As a Claude Code user, I want to filter jobs by current session, so that I only see relevant tasks

### 模型与配置

12. As a Claude Code user, I want to list available Antigravity models dynamically, so that I can choose the right model for my task even as models change over time
13. As a Claude Code user, I want to select a specific Antigravity model when delegating a task, so that I can match model capability to task complexity
14. As a Claude Code user, I want to run Antigravity in read-only mode for analysis, so that I can safely explore without risking file changes (note: agy has no enforced read-only flag; uses prompt injection + permission prompts as fallback)
15. As a Claude Code user, I want to skip permission prompts when delegating to Antigravity, so that automated tasks can run without interruption
16. As a Claude Code user, I want the plugin to automatically pass the project directory to Antigravity, so that agy operates on the correct workspace without manual configuration
17. As a Claude Code user, I want to set a custom timeout for long-running Antigravity tasks, so that they don't get cut off prematurely

### Resume

18. As a Claude Code user, I want to continue the last Antigravity conversation, so that I can iterate on a previous task
19. As a Claude Code user, I want to resume a specific Antigravity conversation by ID, so that I can pick up exactly where I left off

### 环境

20. As a Claude Code user, I want to check if Antigravity CLI is installed and ready, so that I can troubleshoot setup issues before delegating tasks
21. As a Claude Code user, I want to see Antigravity version, Node.js availability, and git availability, so that I know what capabilities are available

### 审查

22. As a Claude Code user, I want standard code review with severity-ranked findings, so that I can quickly identify the most important issues
23. As a Claude Code user, I want adversarial review that examines assumptions, failure modes, alternatives, and boundary conditions, so that I can challenge the implementation before merging
24. As a Claude Code user, I want to focus review on a specific aspect (e.g., security, performance), so that I can get targeted feedback
25. As a Claude Code user, I want review to auto-detect scope (working-tree if dirty, branch if clean), so that I don't have to manually specify what to review
26. As a Claude Code user, I want review output in structured JSON with verdict/summary/findings/next_steps, so that I can programmatically act on the results

### 分发

27. As a plugin author, I want to distribute the plugin via a self-hosted GitHub marketplace, so that others can install it with `/plugin marketplace add` and `/plugin install`
28. As a plugin user, I want to install the plugin with a single command, so that I can start using it immediately

## Implementation Decisions

### 插件格式

- 采用 Claude Code 插件格式（`.claude-plugin/plugin.json`），而非 Codex 插件格式（`.codex-plugin/plugin.json`）
- `plugin.json` 中 `name` 设为 `agy`，决定 skill 命名空间为 `/agy:*`
- 不包含 Codex 专有的 `interface` 字段
- 添加 `displayName: "Antigravity"` 用于 UI 展示（需要 Claude Code v2.1.143+）

### 仓库结构（marketplace 包裹）

```
agy-plugin-cc/                    # GitHub 仓库根
├── .claude-plugin/
│   └── marketplace.json          # marketplace 清单
├── plugins/
│   └── agy/                      # 实际插件目录
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── .mcp.json
│       ├── scripts/
│       │   ├── agy-companion.mjs
│       │   └── lib/
│       │       ├── antigravity-runner.mjs
│       │       ├── state.mjs
│       │       ├── process.mjs
│       │       ├── workspace.mjs
│       │       ├── git.mjs
│       │       └── job-log.mjs
│       ├── skills/
│       │   ├── delegate/SKILL.md
│       │   ├── status/SKILL.md
│       │   ├── review/SKILL.md
│       │   ├── cancel/SKILL.md
│       │   └── setup/SKILL.md
│       ├── schemas/
│       │   └── review-output.schema.json
│       └── README.md
└── README.md
```

### MCP Server

- MCP server 主进程：`agy-companion.mjs`，实现 stdio JSON-RPC 协议（2025-03-26）
- MCP server 名称：`agy-companion`
- `.mcp.json` 使用 Claude Code 格式：无 `type` 字段（有 `command` 即隐含 stdio），路径变量用 `${CLAUDE_PLUGIN_ROOT}`（非 Codex 的 `${PLUGIN_DIR}`）
- `.mcp.json` 内容：
  ```json
  {
    "mcpServers": {
      "agy-companion": {
        "command": "node",
        "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs"]
      }
    }
  }
  ```
- 6 个 MCP 工具：`agy_delegate`, `agy_list_models`, `agy_check`, `agy_cancel`, `agy_review`, `agy_setup`

### Antigravity CLI 调用（antigravity-runner.mjs）

- 非交互模式：`agy -p "<task>" --output-format json`（⚠️ `--output-format` 是 agy 未公开 flag，`agy --help` 中未列出，实测可用但存在未来版本被移除或改名的风险）
- **工作目录（关键）**：agy 不尊重 `spawnSync` 的 `cwd`，默认操作 `~/.gemini/antigravity-cli/scratch`。**必须始终传 `--add-dir <workspaceRoot>`**，否则 agy 会在错误的目录下工作
- 跳过权限：`--dangerously-skip-permissions`
- 模型选择：`--model "<model string>"`（透传完整模型名，如 `"Gemini 3.5 Flash (Low)"`）
- 只读模式：agy 无等价于 Claude Code `--allowedTools` 的只读 flag。`--sandbox` 仅限制终端访问，**不阻止文件写入**。`write=false` 时的处理：① 在 task prompt 前注入 "Do NOT modify any files. This is a read-only analysis task."（软约束）② 不传 `--dangerously-skip-permissions`，让 agy 弹权限确认作为硬约束兜底
- Resume：`--continue`（等同 `--resume-last`）、`--conversation <id>`（等同 `--resume <id>`）
- 超时：`--print-timeout <duration>`（默认 5m0s），`agy_delegate` 暴露可选 `timeout` 参数映射到此 flag

### JSON 输出字段映射

agy 的 `--output-format json` 返回结构与 Claude Code 不同，需映射：

**成功时**（`status: "SUCCESS"`，exit code 0）：

| agy JSON 字段 | 映射到 job 字段 | 说明 |
|---|---|---|
| `response` | `result` | 任务输出文本 |
| `conversation_id` | `sessionId` | 会话标识 |
| `duration_seconds` | `duration` | 执行时长（秒） |
| `usage.total_tokens` | 仅记录 | token 用量，不映射到现有字段 |
| （无对应） | `cost` | 设为 `null`，agy 不返回费用信息 |

**失败时**（`status: "ERROR"`，exit code 1）：

| agy JSON 字段 | 映射到 job 字段 | 说明 |
|---|---|---|
| `status` | 判断依据 | `"ERROR"` → job 失败 |
| `error` | `errorMessage` | 错误描述（如 `"timeout waiting for response"`） |
| `conversation_id` | `sessionId` | 仍然可用 |

解析逻辑：先检查 exit code，若非 0 则解析 JSON 取 `error` 字段；若 exit code 0 则检查 `status` 字段是否为 `"SUCCESS"`，是则取 `response`，否则视为失败。

### MCP 工具 InputSchema

**`agy_delegate`**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `task` | string | ✅ | — | 要执行的任务描述 |
| `write` | boolean | ❌ | `true` | 是否允许写文件（无法强制执行，见只读模式说明） |
| `background` | boolean | ❌ | `false` | 是否后台执行（立即返回 job ID） |
| `model` | string | ❌ | — | agy 模型名（自由字符串，透传给 `--model`） |
| `dangerouslySkipPermissions` | boolean | ❌ | `false` | 跳过权限确认 |
| `resume` | boolean | ❌ | `false` | 继续上次会话（`--continue`） |
| `resumeSession` | string | ❌ | — | 恢复指定会话（`--conversation <id>`） |
| `timeout` | string | ❌ | `5m0s` | 超时时间（映射到 `--print-timeout`） |

**`agy_check`**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `job` | string | ❌ | 最新 job | Job ID 或前缀 |
| `all` | boolean | ❌ | `false` | 列出所有 job |
| `wait` | boolean | ❌ | `false` | 等待完成（超时 4 分钟） |
| `session` | boolean | ❌ | `false` | 按当前 session 过滤 |

**`agy_cancel`**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `job` | string | ❌ | 最新活跃 job | Job ID 或前缀 |

**`agy_review`**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `job` | string | ❌ | 最新已完成 job | Job ID 或前缀 |
| `adversarial` | boolean | ❌ | `false` | 对抗审查模式 |
| `focus` | string | ❌ | — | 审查关注点 |
| `base` | string | ❌ | 自动检测 | Git diff 基准 |
| `scope` | string | ❌ | `auto` | 审查范围：`auto`、`working-tree`、`branch` |

**`agy_list_models`** / **`agy_setup`**：无参数。

### 后台模式实现

`agy_delegate` 的 `background=true` 模式：
- 使用 `spawn`（非 `spawnSync`）启动 agy 进程，`detached: true`
- 将 stdout 写入 resultFile（`<jobs-dir>/<jobId>.result.json`）
- 立即返回 job ID
- 子进程 `exit` 事件中解析 resultFile，更新 job 状态
- 与 cc-plugin-codex 的后台模式实现完全一致

### 环境依赖说明

- **Node.js**：MCP server（`agy-companion.mjs`）是 Node.js 脚本，需要 Node.js 运行时。`agy_setup` 检测 Node.js 可用性
- **agy CLI**：Go 二进制文件，独立于 Node.js。安装方式为下载二进制 + `agy install`（配置 PATH）。`agy_setup` 检测 agy 可用性，若缺失建议访问 Antigravity 官方获取安装包
- **Git**：审查功能需要 git。`agy_setup` 检测 git 可用性

- `agy_list_models` 动态执行 `agy models` 获取实时模型列表，不硬编码
- `agy_delegate` 的 `model` 参数为自由字符串，不做枚举校验，直接透传给 `--model`
- 不设独立的 `effort` 参数（agy 的 effort 内嵌在模型名中，如 `"Gemini 3.5 Flash (Low)"`）
- Skill 中的选择指南给通用建议，不硬编码具体模型名

### Job 状态管理

- Job ID 前缀：`agy-`（如 `agy-m1abcde-f3g2h1`）
- 状态持久化路径：`${os.tmpdir()}/agy-companion/<workspace-slug-hash>/state.json`
- 最多保留 50 个 job 记录，超出自动清理最旧的
- Phase 状态机：`starting` → `executing` → `reviewing` → `editing` → `verifying` → `finalizing` → `completed` | `failed` | `cancelled`
- Per-job log 文件：`<jobs-dir>/<jobId>.log`，格式 `[timestamp] message`
- Session scoping：每个 MCP server 进程有独立 session ID，job 可按 session 过滤

### 审查功能

- `agy_review` 返回 diff + 审查 prompt，由 Claude Code 自身执行审查（Claude Code 是审查者）
- 标准审查：检查正确性、风格、bug、安全、性能、可维护性
- 对抗审查：使用结构化 XML 模板，质疑假设、失败模式、替代方案、技术债务、边界条件
- 审查输出 schema：`{ verdict, summary, findings[], next_steps[] }`，与 cc-plugin-codex 格式一致
- Git 集成：自动检测 review scope（working-tree / branch）、merge-base、diff 收集、untracked 文件内容

### Skills 定义

5 个 skill，与 cc-plugin-codex 的 skill 一一对应：

| Skill | 调用路径 | 描述 |
|-------|---------|------|
| delegate | `/agy:delegate` | 分派编码任务给 Antigravity |
| status | `/agy:status` | 查看任务执行状态 |
| review | `/agy:review` | 审查 Antigravity 产出 |
| cancel | `/agy:cancel` | 取消正在执行的任务 |
| setup | `/agy:setup` | 检测环境可用性 |

### marketplace.json

- 位置：仓库根目录的 `.claude-plugin/marketplace.json`（Claude Code 官方要求，非 Codex 的仓库根直接放）

```json
{
  "name": "agy-plugin-cc",
  "owner": { "name": "Robert Wu" },
  "plugins": [
    {
      "name": "agy",
      "source": "./plugins/agy",
      "description": "Delegate coding tasks to Antigravity CLI from Claude Code, then review the results."
    }
  ]
}
```

### plugin.json

```json
{
  "name": "agy",
  "displayName": "Antigravity",
  "version": "0.1.0",
  "description": "Delegate coding tasks to Antigravity CLI from Claude Code, then review the results.",
  "author": { "name": "Robert Wu" },
  "license": "MIT",
  "keywords": ["antigravity", "agy", "delegate", "review", "code-review"],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```

## Testing Decisions

### 测试接缝

最高接缝是 MCP server 的 stdio JSON-RPC 接口。测试方式：

1. **MCP 协议测试**：启动 `agy-companion.mjs` 子进程，通过 stdin 发送 JSON-RPC 消息，从 stdout 读取响应，验证协议合规性
2. **工具行为测试**：对每个 MCP 工具（`agy_delegate`, `agy_check` 等），发送 `tools/call` 请求，验证返回结构符合预期
3. **Lib 模块单元测试**：`antigravity-runner.mjs` 的 `buildAntigravityArgs`、`state.mjs` 的 job 管理、`job-log.mjs` 的 phase 状态机、`git.mjs` 的 review scope 解析

### 什么算好测试

- 只测外部行为（MCP 工具的输入输出），不测内部实现细节
- 不 mock `agy` CLI 本身——`agy_delegate` 的集成测试用真实的 `agy -p "echo test"` 验证端到端
- `agy_list_models` 的测试验证能解析 `agy models` 的输出格式
- Phase 状态机测试验证所有合法和非法转换
- Job prefix matching 测试验证唯一前缀匹配和歧义检测

### 优先级

1. `agy_setup` — 最简单，验证 MCP 通信跑通
2. `agy_delegate`（前台模式）— 核心功能
3. `agy_list_models` — 辅助工具
4. `agy_check` / `agy_cancel` — 状态管理
5. `agy_review` — 最复杂，最后验证

## Out of Scope

- 不实现 Antigravity → Claude Code 方向的集成（那是 cc-plugin-codex 的职责）
- 不实现 session transfer（Claude Code → Antigravity 的会话迁移）
- 不实现 stop-time review gate hook（Claude Code 插件的 hook 不用于此目的）
- 不实现 Antigravity 的 app-server 协议（Antigravity 没有这个）
- 不做 Claude Code 内置 review 的替代品（审查由 Claude Code 自身执行）
- 不估算 agy 的 cost（agy 不返回费用数据，不编造）
- 不硬编码模型列表（模型动态获取）

## Further Notes

### 与 cc-plugin-codex 的对称关系

| 维度 | cc-plugin-codex（原插件） | 本插件（对称） |
|------|--------------------------|----------------|
| 方向 | Codex → Claude Code | Claude Code → Antigravity CLI |
| 插件系统 | Codex 插件（`.codex-plugin/`） | Claude Code 插件（`.claude-plugin/`） |
| 通信协议 | `claude -p` CLI | `agy -p` CLI |
| 路径变量 | `${PLUGIN_DIR}` | `${CLAUDE_PLUGIN_ROOT}` |
| .mcp.json 格式 | 含 `type: "stdio"` | 无 `type` 字段（隐含 stdio） |
| marketplace.json 位置 | 仓库根目录 | `.claude-plugin/marketplace.json` |
| MCP 工具前缀 | `cc_` | `agy_` |
| Job ID 前缀 | `cc-` | `agy-` |
| 状态目录 | `cc-companion` | `agy-companion` |
| 模型选择 | 硬编码 4 个 Claude 模型 | 动态调 `agy models` |
| Effort 参数 | 独立 `--effort` | 内嵌在模型名中 |
| 只读模式 | `--allowedTools` 限制 | 无等价 flag（prompt 注入 + 不跳权限兜底） |
| 工作目录 | `spawnSync` 的 `cwd` 即可 | 必须传 `--add-dir`（agy 不尊重 cwd） |
| Resume | `--resume-last` / `--resume <id>` | `--continue` / `--conversation <id>` |
| 超时 | `spawnSync` 的 `timeout` 选项 | `--print-timeout` flag |
| JSON 成功判断 | exit code 0 | exit code 0 + `status === "SUCCESS"` |
| JSON 错误字段 | `stderr` | `error` 字段 |
| JSON cost | `total_cost_usd` | 无（设 null） |
| 审查执行者 | Codex | Claude Code |

### Antigravity CLI 关键信息

- 可执行文件：`agy`（Go 二进制，通常安装在 `~/.local/bin/agy`）
- 版本：1.0.16（当前）
- 安装方式：下载二进制 + `agy install`（配置 PATH 和 shell 集成）；更新：`agy update`
- 非交互模式：`agy -p "task"`
- JSON 输出：`--output-format json` → `{conversation_id, status, response, duration_seconds, num_turns, usage: {input_tokens, output_tokens, thinking_tokens, total_tokens}}`
- 错误输出：`status: "ERROR"` + `error` 字段 + exit code 1
- 工作目录：**agy 不尊重 cwd**，必须传 `--add-dir <path>` 指定工作目录
- 模型选择：`--model "Gemini 3.5 Flash (Low)"`（完整字符串）
- Resume：`--continue`、`--conversation <id>`
- 权限：`--dangerously-skip-permissions`（跳过权限确认）、`--sandbox`（⚠️ 仅限制终端，不阻止文件写入）
- 超时：`--print-timeout <duration>`（默认 5m0s）
- 模型列表：`agy models`（动态，会变化）
