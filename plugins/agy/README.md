# Antigravity Companion — Claude Code Plugin

Delegate coding tasks to Antigravity CLI (`agy`) from Claude Code, then review the results.

## Prerequisites

- **Node.js** — Required for the MCP server
- **Antigravity CLI** — Go binary, install via download + `agy install`
- **Git** — Required for review features

## Installation

```bash
# Add the marketplace
/plugin marketplace add <github-org>/agy-plugin-cc

# Install the plugin
/plugin install agy@agy-plugin-cc
```

## Usage

### Setup
```
/agy:setup
```
Check that Antigravity CLI is installed and ready.

### Delegate a Task
```
/agy:delegate
```
Send a coding task to Antigravity. It executes in a separate process and returns results.

### Check Status
```
/agy:status
```
View task progress, phase tracking, and results.

### Review Changes
```
/agy:review
```
Review code changes made by Antigravity. Supports standard and adversarial review modes.

### Cancel a Task
```
/agy:cancel
```
Cancel a running Antigravity task.

## MCP Tools

| Tool | Description |
|------|-------------|
| `agy_delegate` | Delegate a coding task to Antigravity |
| `agy_list_models` | List available Antigravity models (dynamic) |
| `agy_check` | Check job status/results |
| `agy_cancel` | Cancel a running job |
| `agy_review` | Review Antigravity output |
| `agy_setup` | Check environment readiness |

## Key Design Notes

- **Workspace**: Antigravity doesn't respect `cwd` — the plugin always passes `--add-dir <workspaceRoot>` automatically
- **Read-only mode**: Antigravity has no enforced read-only flag. `write=false` uses prompt injection + permission prompts as fallback
- **Models**: Dynamic via `agy models` — never hardcoded. Effort is embedded in model names
- **Cost**: Antigravity doesn't return cost data — displayed as `—`
- **Resume**: Uses `--continue` and `--conversation <id>` (not `--resume-last`/`--resume`)

## Architecture

```
Claude Code → MCP client → agy-companion.mjs (stdio JSON-RPC)
  → antigravity-runner.mjs → spawnSync("agy", ["-p", task, ...])
  → parse JSON response → return to Claude Code
```

## License

MIT
