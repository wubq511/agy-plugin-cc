---
name: delegate
description: Use when you want to delegate a coding task to Antigravity CLI — it executes the task and returns results for review
---

# Delegate to Antigravity

## Overview

Send a coding task to Antigravity CLI for execution. Antigravity runs in a separate process, completes the task, and returns results automatically. After completion, you should review the changes.

## Workflow

1. **Assess task complexity** to pick model:
   - Call `agy_list_models` to see available options (models are dynamic and change over time)
   - Effort is embedded in the model name (e.g., "Gemini 3.5 Flash (Low)")
   - Simple tasks → model with (Low) effort
   - Medium tasks → model with (Medium) effort
   - Complex tasks → model with (High) effort

2. **Delegate the task** by calling `agy_delegate`:
   - `task` (required): the coding task description
   - `model`: full Antigravity model name string (e.g., "Gemini 3.5 Flash (Low)")
   - `write`: set to `true` (default) to allow file writes, `false` for read-only analysis (uses prompt injection + permission prompts as fallback since agy has no enforced read-only mode)
   - `background`: set to `true` to run in background and return immediately
   - `dangerouslySkipPermissions`: set to `true` to let Antigravity write without confirmation (default: false)
   - `resume`: set to `true` to continue the last Antigravity session (adds `--continue`)
   - `resumeSession`: pass a conversation ID to resume a specific Antigravity session (adds `--conversation <id>`)
   - `timeout`: set a custom timeout duration (e.g., "10m0s"), mapped to `--print-timeout`

3. **Present results** to the user when the task completes.

4. **Suggest review**: After a completed task, tell the user:
   > "Task completed. Run `/agy:review` to review the changes, or `/agy:review --adversarial` for a deeper review."

## Resume

When the user wants to continue a previous Antigravity session:
- "keep going", "resume", "continue" → `agy_delegate` with `resume=true`
- "resume session abc123" → `agy_delegate` with `resumeSession="abc123"`
- "fresh start" → `agy_delegate` without resume flags (new session)

## Model Selection Guide

| Task Type | Effort Level | Example Model Pattern |
|-----------|-------------|----------------------|
| Typo fix, simple bug | Low | *(Low) suffix |
| Feature implementation | Medium | *(Medium) suffix |
| Complex refactor | High | *(High) suffix |

Use `agy_list_models` to see the actual available models — they change over time.

## Examples

- "Have Antigravity implement the auth middleware"
- "Delegate the CSS fix to Antigravity"
- "Ask Antigravity to refactor the database layer"
- "Resume the last Antigravity session and keep going" → `resume=true`
- "Continue Antigravity session agy-abc123" → `resumeSession="..."`

## Notes

- `agy_delegate` defaults to foreground mode — it waits for Antigravity to finish and returns results immediately.
- For long-running tasks, use `background=true` and check progress with `/agy:status`.
- The task prompt is passed directly to `agy -p`. Be specific about what you want done.
- Job ID supports prefix matching: "agy-abc" matches "agy-abc123def".
- Antigravity always operates on the project workspace (plugin passes `--add-dir` automatically).
