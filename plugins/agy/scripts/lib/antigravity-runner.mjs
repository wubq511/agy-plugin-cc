import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";

import { binaryAvailable } from "./process.mjs";

const READ_ONLY_PREFIX = "Do NOT modify any files. This is a read-only analysis task. ";

/**
 * Build the agy CLI command args for a given task and options.
 *
 * Key differences from claude-runner.mjs:
 * - Always passes --add-dir (agy doesn't respect cwd)
 * - Uses --continue/--conversation for resume (not --resume-last/--resume)
 * - Uses --print-timeout for timeout (not spawnSync timeout)
 * - No --effort flag (effort is embedded in model name)
 * - No --allowedTools (write=false uses prompt injection + omit --dangerously-skip-permissions)
 * - Model is a free string (no enum validation)
 */
export function buildAntigravityArgs(task, options = {}) {
  // agy doesn't respect cwd — must always pass --add-dir
  const workspaceRoot = options.cwd || process.cwd();
  const write = options.write !== false;

  // For read-only mode, prepend instruction to task
  let effectiveTask = task;
  if (!write) {
    effectiveTask = READ_ONLY_PREFIX + task;
  }

  const args = ["-p", effectiveTask, "--output-format", "json", "--add-dir", workspaceRoot];

  // Only skip permissions when explicitly requested AND write is allowed
  // When write=false, don't skip permissions (let agy prompt as hard constraint fallback)
  if (write && options.dangerouslySkipPermissions === true) {
    args.push("--dangerously-skip-permissions");
  }

  // Model: free string, pass through directly
  if (options.model) {
    args.push("--model", options.model);
  }

  // Resume support: agy uses --continue and --conversation
  if (options.resumeSession) {
    args.push("--conversation", options.resumeSession);
  } else if (options.resume) {
    args.push("--continue");
  }

  // Timeout: agy uses --print-timeout
  if (options.timeout) {
    args.push("--print-timeout", options.timeout);
  }

  return args;
}

/**
 * Run agy -p synchronously and return parsed JSON output.
 *
 * agy JSON mapping:
 * - response → result
 * - conversation_id → sessionId
 * - duration_seconds → duration (already in seconds)
 * - No cost field → null
 * - Error: status === "ERROR" + error field
 */
export function runAntigravitySync(task, options = {}) {
  const args = buildAntigravityArgs(task, options);
  const cwd = options.cwd || process.cwd();

  const result = spawnSync("agy", args, {
    cwd, // agy ignores this, but set it anyway for consistency
    env: process.env,
    encoding: "utf8",
    timeout: options.timeoutMs || 15 * 60 * 1000,
    stdio: "pipe",
    maxBuffer: 50 * 1024 * 1024
  });

  if (result.error) {
    return {
      ok: false,
      error: result.error.message || String(result.error),
      exitCode: result.status ?? -1
    };
  }

  if (result.status !== 0) {
    // Try to parse error from JSON output
    let errorMessage = `agy exited with code ${result.status}`;
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed.error) {
        errorMessage = parsed.error;
      }
    } catch { /* ignore parse error, use default message */ }
    return {
      ok: false,
      error: (result.stderr || "").trim() || errorMessage,
      exitCode: result.status
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);

    // Check for error status in successful exit
    if (parsed.status === "ERROR") {
      return {
        ok: false,
        error: parsed.error || "agy returned ERROR status",
        exitCode: 0
      };
    }

    return {
      ok: true,
      result: parsed.response || "",
      sessionId: parsed.conversation_id || null,
      cost: null, // agy doesn't return cost info
      duration: parsed.duration_seconds || null,
      model: null, // agy doesn't return model info in JSON output
      exitCode: 0
    };
  } catch (parseError) {
    // JSON parse failed — treat as error, not silent success
    return {
      ok: false,
      error: `agy output was not valid JSON: ${parseError.message}`,
      rawOutput: result.stdout,
      exitCode: 0
    };
  }
}

/**
 * Spawn agy -p as a detached background process.
 * Returns the child process. The caller should listen for 'exit' to update job state.
 *
 * Captures stdout to a result file so we can read it on completion.
 */
export function runAntigravityDetached(task, options = {}) {
  const args = buildAntigravityArgs(task, options);
  const cwd = options.cwd || process.cwd();

  // Write stdout to a result file so we can read it on completion
  const resultFile = options.resultFile || null;
  const outFd = resultFile
    ? fs.openSync(resultFile, "w")
    : null;

  const stdioConfig = resultFile
    ? ["ignore", outFd, "ignore"]
    : ["ignore", "ignore", "ignore"];

  const child = spawn("agy", args, {
    cwd,
    env: process.env,
    detached: true,
    stdio: stdioConfig,
    windowsHide: true
  });
  child.unref();

  // Close the fd in the parent so it doesn't leak
  if (outFd !== null) {
    try { fs.closeSync(outFd); } catch { /* ignore */ }
  }

  return child;
}

/**
 * Check if agy CLI is available.
 */
export function getAntigravityAvailability(cwd) {
  return binaryAvailable("agy", ["--version"], { cwd });
}

/**
 * Get the list of available agy models dynamically.
 * Runs `agy models` and parses the output.
 *
 * agy models are dynamic and change over time — never hardcode.
 * Effort is embedded in model names (e.g., "Gemini 3.5 Flash (Low)").
 */
export function getAvailableModels(cwd) {
  try {
    const result = spawnSync("agy", ["models"], {
      cwd: cwd || process.cwd(),
      env: process.env,
      encoding: "utf8",
      timeout: 10000,
      stdio: "pipe"
    });

    if (result.status !== 0 || !result.stdout) {
      return { ok: false, models: [], error: "Failed to run `agy models`" };
    }

    // Parse model list — each line is a model name
    const models = result.stdout.trim().split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    return { ok: true, models, error: null };
  } catch (err) {
    return { ok: false, models: [], error: err.message };
  }
}
