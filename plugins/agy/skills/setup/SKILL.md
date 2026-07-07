---
name: setup
description: Use when you want to check if Antigravity CLI is installed and ready, or when troubleshooting the plugin
---

# Setup & Environment Check

## Overview

Verify that Antigravity CLI is installed and the plugin is ready to use. Reports workspace info, default branch, and session ID.

## Workflow

1. Call `agy_setup` (no parameters needed).

2. If everything is ready, inform the user they can start delegating tasks.

3. If issues are found:
   - **Antigravity CLI not installed**: Suggest downloading the binary and running `agy install`
   - **Node.js not available**: Suggest installing from https://nodejs.org/
   - **Git not found**: Review features need git — suggest installing git

## What It Checks

- Antigravity CLI availability and version
- Node.js availability and version
- Git availability and version
- Workspace root detection
- Default branch detection (main/master)
- Current session ID

## Examples

- "Check Antigravity setup" → `agy_setup`
- "Is Antigravity ready?" → `agy_setup`
