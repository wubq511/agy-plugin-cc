# Antigravity Companion — Claude Code Plugin

> 在 Claude Code 中分派编码任务给 Antigravity CLI，完成后自动返回结果供 Claude Code 审查。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 这是什么

一个 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 插件，实现 **Claude Code → Antigravity CLI** 方向的集成。让你在 Claude Code 里把编码任务交给 Antigravity 执行，完成后自动返回结果，并可以对产出做标准审查或对抗审查。

与 `cc-plugin-codex`（Codex → Claude Code）方向对称，互为补充。

## 功能

- **分派任务** — 把编码任务交给 Antigravity，选择模型（动态获取）
- **前台/后台执行** — 前台模式等待完成立即返回，后台模式立即返回 job ID
- **状态追踪** — 实时查看任务进度、阶段、耗时
- **代码审查** — 标准审查（找 bug）或对抗审查（质疑实现选择、攻击面分析）
- **会话恢复** — 支持恢复上一次 Antigravity 会话继续工作
- **Job 管理** — 前缀匹配、会话过滤、取消运行中的任务

## 快速开始

### 前置条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 已安装
- [Antigravity CLI](https://github.com/nicepkg/antigravity-cli) 已安装：下载二进制 + `agy install`
- Node.js >= 18
- Git（审查功能需要）

### 安装

```bash
# 1. 添加本仓库作为 marketplace
claude plugin marketplace add <your-github-org>/agy-plugin-cc

# 2. 安装插件
claude plugin install agy@agy-plugin-cc
```

验证安装：

```
/agy:setup
```

## 使用

### 分派任务

```
/agy:delegate
```

Antigravity 的模型通过 `agy models` 动态获取，effort 内嵌在模型名中（如 `Gemini 3.5 Flash (Low)`）：

| 任务类型 | 推荐模型 effort |
|----------|----------------|
| 修 typo、简单 bug | Low |
| 功能实现 | Medium |
| 复杂重构 | High |

也可以手动指定模型名和超时时间。

### 查看状态

```
/agy:status        # 最新任务
/agy:status --all  # 所有任务
```

### 审查产出

```
/agy:review              # 标准审查
/agy:review --adversarial  # 对抗审查
```

**标准审查**：检查正确性、bug、安全、性能、可维护性。

**对抗审查**：质疑实现选择，分析攻击面（认证/数据丢失/竞态条件/可观测性缺口），要求每个发现都有具体代码位置和修复建议。

### 取消任务

```
/agy:cancel
```

### 环境检查

```
/agy:setup
```

## MCP 工具

插件通过 MCP server 暴露 6 个工具，供 Claude Code 直接调用：

| 工具 | 说明 |
|------|------|
| `agy_delegate` | 分派编码任务给 Antigravity |
| `agy_list_models` | 动态列出可用模型 |
| `agy_check` | 查看任务状态/结果 |
| `agy_cancel` | 取消运行中的任务 |
| `agy_review` | 审查代码变更 |
| `agy_setup` | 检查环境可用性 |

## 项目结构

```
├── .claude-plugin/
│   └── marketplace.json          # Marketplace 清单
└── plugins/agy/
    ├── .claude-plugin/plugin.json  # Claude Code 插件清单
    ├── .mcp.json                  # MCP server 声明（stdio）
    ├── scripts/
    │   ├── agy-companion.mjs      # MCP server 主进程
    │   └── lib/
    │       ├── antigravity-runner.mjs  # agy CLI 调用封装
    │       ├── git.mjs            # Git 集成（diff、review context）
    │       ├── job-log.mjs        # Job 日志和阶段追踪
    │       ├── process.mjs        # 进程管理
    │       ├── state.mjs          # Job 状态持久化
    │       └── workspace.mjs      # 工作区解析
    ├── skills/                    # Claude Code skill 定义
    │   ├── delegate/SKILL.md
    │   ├── status/SKILL.md
    │   ├── review/SKILL.md
    │   ├── cancel/SKILL.md
    │   └── setup/SKILL.md
    └── schemas/
        └── review-output.schema.json  # 审查输出 JSON Schema
```

## 审查输出格式

所有审查结果遵循 `schemas/review-output.schema.json`：

```json
{
  "verdict": "approve|needs-attention|request_changes|reject",
  "summary": "ship/no-ship 评估",
  "findings": [{
    "severity": "critical|high|medium|low",
    "title": "问题标题",
    "body": "详细描述",
    "file": "src/foo.ts",
    "line_start": 42,
    "line_end": 45,
    "confidence": 0.9,
    "recommendation": "具体修复建议"
  }],
  "next_steps": ["修复 X", "补充 Y 的测试"]
}
```

## 与 cc-plugin-codex 的对比

| 维度 | cc-plugin-codex | 本插件 |
|------|-----------------|--------|
| 方向 | Codex → Claude Code | Claude Code → Antigravity CLI |
| 插件系统 | Codex 插件（`.codex-plugin/`） | Claude Code 插件（`.claude-plugin/`） |
| 通信 | `claude -p` CLI | `agy -p` CLI |
| 路径变量 | `${PLUGIN_DIR}` | `${CLAUDE_PLUGIN_ROOT}` |
| 模型选择 | 硬编码 4 个 Claude 模型 | 动态调 `agy models` |
| Effort | 独立 `--effort` 参数 | 内嵌在模型名中 |
| 只读模式 | `--allowedTools` 限制 | prompt 注入 + 不跳权限兜底 |
| 工作目录 | `spawnSync` 的 `cwd` | 必须传 `--add-dir` |
| Resume | `--resume-last` / `--resume` | `--continue` / `--conversation` |
| 超时 | `spawnSync` timeout | `--print-timeout` |
| 审查执行者 | Codex | Claude Code |

## License

MIT
