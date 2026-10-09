# Architecture and trust boundaries

## Request path

The browser posts a change request and acceptance objective to the loopback Node server. The server validates length and control characters, hashes the exact objective, and writes a local record. It does not accept a target URL, shell command, CLI flags, output path, or environment overrides from the browser.

The engine resolves a target repository from server environment. Its baseline `HEAD` is materialized as a Git worktree beneath `.patchloop/worktrees/<run-id>`. The selected Node entry point runs from that worktree with a fresh data directory and ephemeral port. The engine waits for the target's `/api/health`, then invokes the installed Kane CLI with the fixed objective and local URL.

Only a final Kane `run_end` event, a successful verdict, and exit code zero set the task to `verified`. A failed final result moves to `needs_review`; malformed output, missing `run_end`, a spawn error, or timeout cannot be green. The user explicitly authorizes a Codex call. Codex receives the task, original objective/hash, and redacted Kane output. It has workspace-write permissions in the isolated worktree. A separate Kane run is required after repair.

## State

`Store` persists JSON at `.patchloop/state.json` by temp-file write and rename. Run events are appended and attempts are recorded separately. This is local persistence, not cryptographic tamper evidence; a local user with filesystem access can alter the file. Each attempt records objective hash, process exit, timestamps, bounded output, and the parsed final event. Tokens and signed URLs are redacted before persistence.

Worktrees are retained for review. PatchLoop does not merge or commit agent changes. Use the downloaded diff for human review and manual application.

## Boundaries and limits

- Default bind: `127.0.0.1`. Docker binds its published port to host loopback.
- Browser writes are same-origin checked; API bodies are size-limited.
- CLI entry points are resolved from known global package locations or explicit local environment overrides. No shell interpolation is used for Codex or Kane.
- Codex may execute code in its sandboxed worktree. Treat a target repository and its scripts as code you trust.
- The Node target contract is `server.mjs`, `/api/health`, `PATCHLOOP_PORT`, and `PATCHLOOP_DATA_DIR`. Other app shapes need an adapter before they are supported.
- The first demo baseline uses a local synthetic git author identity (`local@patchloop.invalid`); this is only metadata for its isolated bundled target, not a person or event commit.
- Docker does not mount host CLI profiles. A full live repair loop runs natively with host-installed tools.
