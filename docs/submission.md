# Submission draft and recording notes

**Status:** draft. This is copy and a recording plan, not a submitted entry or a recorded video. Confirm the current event rules, eligibility, repo timing, and form with the organizer before using it. The app predates the event build window described in the supplied materials, so do not claim it was built during the event or eligible without organizer confirmation.

## One-paragraph submission copy

PatchLoop is a local workbench for developers using coding agents who want browser evidence before accepting a change. It records a fixed natural-language acceptance objective, lets the user choose a bundled or locally configured repository, runs Kane against an isolated Git worktree, and keeps failures, setup errors, and inconclusive results distinct. After a repeatable failure, a developer can ask Codex to repair that worktree, review the diff, and rerun the unchanged objective. PatchLoop marks a task verified only from Kane's passing final event and successful process exit. The screen recording captures a missing target configuration, its correction, and a later Kane pass on the showcase objective. Its run record has no code diff, so it does not demonstrate a Codex repair of the seeded restore defect. PatchLoop does not auto-merge or deploy changes.

## Voiceover script

Every coding agent can produce a convincing change. But a plausible diff does not prove that the browser flow works. PatchLoop keeps the acceptance objective fixed, records what Kane sees in a real browser, and makes any repair reviewable.

The showcase problem is simple to describe and easy to miss: after a completed task is archived and restored, its title and completed checkbox should both stay unchanged.

To use PatchLoop, clone two repositories onto the computer that will run the task. The `kane-cli` repository is PatchLoop's local runner. The second checkout must be the app you intend to test or repair. Here, that is the separate PatchLoop Full Showcase repository. Review its source and manifest, and commit the starting state. PatchLoop creates a disposable Git worktree from that commit, leaving your selected checkout as the baseline.

Install Node, Git, Chrome, Kane CLI, and Codex. Sign into Kane and Codex locally, then sign into the hosted PatchLoop page and pair the worker. Before starting the worker, set `PATCHLOOP_TARGET_REPO` to the target app's local path. Our first attempts stopped at setup because the worker had no target path. We corrected the configuration by pointing the worker to the showcase checkout and restarting it. After it reported both available repositories, the showcase appeared in the picker. We also fixed the picker refresh so status polling no longer interrupts repository selection.

Next, select the target and submit the change request with its fixed browser objective. PatchLoop hashes the objective before Kane runs. In this recording, the run details show Kane's passing final result, result code 100, and process exit zero. They also show no code diff. This video documents the setup recovery and a Kane pass; it does not show Codex repairing the seeded bug. A repair claim needs repeated Kane failures, explicit Codex approval, a real diff, and a passing rerun of the same objective.

The PatchLoop source and showcase target are published separately. The README and target guide explain cloning both repositories, local setup, pairing, target selection, and recovery from setup errors.

### What appears in the edited recording

| Time | Screen action | Narration focus |
|---|---|---|
| 0:00-0:24 | PatchLoop workbench and restore requirement. | Explain the completed-task restore bug and why browser evidence matters. |
| 0:24-0:48 | Showcase target selection, request, and fixed objective. | Explain that the runner and target app are separate local clones. |
| 0:48-1:10 | Recorded missing-target setup error with the setup correction overlay. | Explain setting `PATCHLOOP_TARGET_REPO` in the worker terminal and restarting the worker. |
| 1:10-1:31 | Task queued and Kane browser run starts. | Explain objective locking and what the browser run checks. |
| 1:31-2:08 | Kane run details and recorded outcome. | State the pass (result code 100, exit 0) and that no code diff was recorded. |
| 2:08-2:23 | Custom end card with source repo, showcase repo, and setup guide. | Point viewers to both repositories and the complete target setup instructions. |

The recording documents configuration recovery and a Kane pass. It does not document Codex repairing the showcase defect; do not narrate it as a completed code repair.

## Recording checklist

- Use a fresh, clean browser window and show no unrelated tabs, account identity, credentials, or private local paths.
- Do not expose CLI profiles, `.patchloop/` state files, personal preparation documents, or private run output beyond the stated evidence.
- Keep earlier failed and timed-out attempts as recorded. Do not replace them with fixtures or relabel their outcomes.
- Verify the exported video is under three minutes, audio is clear, captions match the actions, and an unlisted link opens in a signed-out/incognito browser.
- Add the actual video URL and public app URL only after they exist and have been checked. Submit through the official form only after confirming event rules and eligibility.

For the target contract, hosted pairing steps, live-run caveat, and local setup, see [target repositories](target-repositories.md) and [demo and operations](demo-and-operations.md). The maintainer reports that Google sign-in works, but hosted end-to-end verification requires an actual hosted worker run and record.
