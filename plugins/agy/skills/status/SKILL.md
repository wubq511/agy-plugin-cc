---
name: status
description: Use when you want to check the status of an Antigravity task — see progress, phase, results, or list all jobs
---

# Check Task Status

## Overview

Check the status and results of Antigravity tasks. Shows phase tracking, recent log entries, and session info.

## Workflow

1. Call `agy_check` with appropriate parameters:
   - No arguments → latest job details (with phase and recent log)
   - `job="<id>"` → specific job details (accepts prefix matching, e.g. "agy-abc")
   - `all=true` → list all jobs in a summary table
   - `wait=true` → wait for a running job to complete (up to 4 minutes)
   - `session=true` → filter to current session's jobs only

2. Present the status information to the user, including:
   - Current phase and its description
   - Recent log entries showing progress
   - Session ID for the job

## Phase Tracking

Jobs progress through phases:
- `starting` → Preparing to execute task
- `executing` → Antigravity is working on the task
- `verifying` → Verifying the implementation
- `finalizing` → Finalizing changes
- `completed` → Task completed successfully
- `failed` → Task failed
- `cancelled` → Task cancelled by user

## Examples

- "Check Antigravity status" → `agy_check` (latest job)
- "Show all Antigravity jobs" → `agy_check` with `all=true`
- "Check job agy-abc" → `agy_check` with `job="agy-abc"` (prefix)
- "Wait for Antigravity to finish" → `agy_check` with `wait=true`
- "Show my session's jobs" → `agy_check` with `session=true`
