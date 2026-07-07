---
name: cancel
description: Use when you want to cancel a running Antigravity task
---

# Cancel Antigravity Task

## Overview

Cancel an Antigravity task that is currently running. By default cancels the latest active job. Accepts job ID prefix.

## Workflow

1. Call `agy_cancel`:
   - No arguments → cancel the latest running/queued job
   - `job="<id>"` → cancel a specific job (accepts prefix, e.g. "agy-abc")

2. Confirm the cancellation to the user.

## Examples

- "Cancel the Antigravity task" → `agy_cancel` (latest active)
- "Cancel job agy-abc" → `agy_cancel` with `job="agy-abc"` (prefix matching)
