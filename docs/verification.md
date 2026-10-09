# Verification record

This file records commands and browser verification performed against the bundled PatchLoop demo app.

## Commands

| Command | Result | Scope / limitation |
|---|---|---|
| `npm.cmd run check` | Passed | Syntax checks for server, engine, store, browser script, and demo server. |
| `npm.cmd test` | Passed (7 tests) | Objective/parser/redaction/store behavior, signed-session validation, and per-user run ownership. |
| Focused Playwright archive/restore check | Passed | Repaired app worktree with isolated task data; checked Active/Archived visibility and retained completion state. |
| `docker compose --profile test run --build --rm -e TEST_OUTPUT_DIR=/tmp/patchloop-results -e TEST_HTML_REPORT=/tmp/patchloop-report e2e` | Passed (6 tests; rerun on 2026-10-09) | Docker Playwright suite includes the bundled demo archive/restore workflow. Test containers had no Kane or Codex credentials. The runtime image installs locked production dependencies. |
| Kane verification | Passed on run `db0ac6a2-2929-442f-a383-8e20d153ee28` | Same acceptance objective and hash as run `87ec7a34-99f2-4625-b63f-621de1d078b3`; baseline commit `4d0adbffa80f63cb52f5b86ce4a6736837e610d0`; Kane CLI `0.8.21`; exit code `0`; result code `100` (`success.complete`); timeout `900` seconds. |

## Archive/restore evidence (2026-10-09)

The immutable acceptance objective hash was `fedc6133ab58b946870581fd309da2e07df369f99dcac9ab26abe1e57c734916` for all three runs below.

| Run ID | Result | Evidence |
|---|---|---|
| `87ec7a34-99f2-4625-b63f-621de1d078b3` | Failed; retained as `needs_review` | Kane selected the Completed tab after checking the task, so archive and restore were not attempted. |
| `704c51dc-3e5e-490a-a049-0b881ad4a1a2` | Timed out; retained as `inconclusive` | Kane archived the task and opened Archived, but the 435-second integration timeout expired before restore and final assertions. |
| `db0ac6a2-2929-442f-a383-8e20d153ee28` | Passed; `verified` | Final `run_end`: `passed`; result `100`; reason `success.complete`; task data records `completed: true`, `archived: false`. Kane confirmed it disappeared from Active while archived, appeared in Archived, and returned to Active with the completion checkmark. |

The repair is now part of `demo-template` and the committed private baseline used to create new worktrees. Run records and acceptance objectives were preserved; the passing result is a new run rather than an edited prior record.

## Evidence fields for a real loop

For each actual attempt, record UTC time, repository HEAD, Kane/Codex versions, exact objective hash, actual CLI exit codes, Kane `run_end` result code/reason, agent diff hash, and outcome. Do not copy signed dashboard URLs, auth identity, or credentials into this repository.
