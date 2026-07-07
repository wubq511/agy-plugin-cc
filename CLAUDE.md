# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code plugin that delegates coding tasks to Antigravity CLI (`agy`) and reviews the results. Direction: **Claude Code → Antigravity CLI**. Symmetric counterpart to `cc-plugin-codex` (Codex → Claude Code).

## Architecture

This is a **Claude Code plugin marketplace repo**. The repo root is the marketplace; the actual plugin lives in `plugins/agy/`.

```
agy-plugin-cc/                     # Marketplace repo root
├── .claude-plugin/
│   └── marketplace.json           # Marketplace catalog
├── plugins/agy/                   # The plugin
│   ├── .claude-plugin/plugin.json # Plugin manifest
│   ├── .mcp.json                  # MCP server declaration
│   ├── scripts/
│   │   ├── agy-companion.mjs      # MCP server (stdio JSON-RPC)
│   │   └── lib/                   # Shared modules
│   ├── skills/                    # 5 skills (delegate, status, review, cancel, setup)
│   └── schemas/                   # Review output JSON schema
└── PRD.md                         # Full product spec
```

### MCP Server → agy CLI Flow

```
Claude Code → MCP client → agy-companion.mjs (stdio JSON-RPC)
  → antigravity-runner.mjs → spawnSync("agy", ["-p", task, "--output-format", "json", "--add-dir", workspaceRoot, ...])
  → parse JSON response → return to Claude Code
```

### Key Design Constraints

- **agy does not respect `cwd`**: Must always pass `--add-dir <workspaceRoot>` or agy defaults to `~/.gemini/antigravity-cli/scratch`
- **`--output-format json` is undocumented** in `agy --help` but works; risk of future removal
- **agy has no read-only mode**: `--sandbox` only restricts terminal, not file writes. `write=false` uses prompt injection + omitting `--dangerously-skip-permissions` as fallback
- **agy models are dynamic**: `agy models` output changes over time; never hardcode model names
- **agy effort is embedded in model name**: e.g. `"Gemini 3.5 Flash (Low)"` — no separate `--effort` flag
- **agy JSON differs from Claude Code JSON**: `response` (not `result`), `conversation_id` (not `session_id`), `duration_seconds` (not `duration_ms`), no `cost` field, has `status` + `error` fields for error detection

### agy ↔ Claude Code Flag Mapping

| Purpose | Claude Code | agy |
|---------|-------------|-----|
| Non-interactive | `claude -p "task"` | `agy -p "task"` |
| JSON output | `--output-format json` | `--output-format json` |
| Resume last | `--resume-last` | `--continue` |
| Resume specific | `--resume <id>` | `--conversation <id>` |
| Skip permissions | `--dangerously-skip-permissions` | `--dangerously-skip-permissions` |
| Read-only | `--allowedTools Read,...` | No equivalent (prompt injection fallback) |
| Timeout | `spawnSync({ timeout })` | `--print-timeout <duration>` |
| Workspace | `cwd` in spawn | `--add-dir <path>` (required!) |

## Development

### Testing the plugin locally

```bash
claude --plugin-dir ./plugins/agy
```

Then in Claude Code session: `/agy:setup`, `/agy:delegate`, etc.

### Validating plugin structure

```bash
claude plugin validate ./plugins/agy
```

### Key files to modify

- `plugins/agy/scripts/agy-companion.mjs` — MCP server main (tool definitions + handlers + JSON-RPC protocol)
- `plugins/agy/scripts/lib/antigravity-runner.mjs` — agy CLI invocation (buildAntigravityArgs, runAntigravitySync, runAntigravityDetached)
- `plugins/agy/skills/*/SKILL.md` — Skill instructions for Claude Code
- `plugins/agy/.claude-plugin/plugin.json` — Plugin manifest
- `plugins/agy/.mcp.json` — MCP server config

### Lib modules (shared with cc-plugin-codex pattern)

- `state.mjs` — Job state persistence (JSON file in tmpdir), upsert/list/prune
- `process.mjs` — Binary availability check, process tree termination
- `workspace.mjs` — Git root detection (walk up from cwd)
- `git.mjs` — Review scope resolution, diff collection, branch detection
- `job-log.mjs` — Per-job log files, phase tracking state machine, phase inference

## Plugin Distribution

Self-hosted GitHub marketplace. Users install via:

```bash
/plugin marketplace add <github-org>/agy-plugin-cc
/plugin install agy@agy-plugin-cc
```
