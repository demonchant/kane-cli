# Showcase cases

| Case | Expected PatchLoop record | How to demonstrate |
|---|---|---|
| Valid browser flow | Kane passes, process exit 0, state `verified` | Use the bundled Goodwork demo or the showcase after the repair is committed to its baseline. |
| Known restore defect | Kane fails; state `needs_review` | Select PatchLoop Full Showcase and run the repair challenge objective. |
| Repeatable failure | Same objective hash fails twice | Replay the unchanged Kane objective and inspect both attempt records. |
| Approved agent repair | Codex attempt plus isolated worktree diff | Click Send repeated failure to Codex after the repeated failure is available. |
| Post-repair verification | Same objective hash passes on repaired worktree | Rerun Kane and inspect its final event, result code, and exit code. |
| Setup / launch error | `setup_error`, never a pass | Stop the worker, use an invalid target path in a disposable test config, or make the target start command invalid; restore the valid config before the demo. |
| Inconclusive timeout | `inconclusive`, never a pass | Only demonstrate with an intentionally short test timeout in a separate local config; do not use this as a successful verification. |
| Agent failure | `agent_error` with no inferred success | Use only if Codex genuinely errors; inspect the recorded attempt and report it honestly. |

The known defect is deliberate. Other failure states should be shown from actual run records, never synthesized or relabeled.
