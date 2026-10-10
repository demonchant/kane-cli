# Submission draft and recording notes

**Status:** draft. This is submission copy and notes for the edited screen recording; it is not a submitted entry. Confirm the current event rules, eligibility, repo timing, and form with the organizer before using it. The app predates the event build window described in the supplied materials, so do not claim it was built during the event or eligible without organizer confirmation.

## One-paragraph submission copy

PatchLoop is a local workbench for developers using coding agents who want browser evidence before accepting a change. It records a fixed natural-language acceptance objective, lets the user choose a bundled or locally configured repository, runs Kane against an isolated Git worktree, and keeps failures, setup errors, and inconclusive results distinct. After a repeatable failure, a developer can ask Codex to repair that worktree, review the diff, and rerun the unchanged objective. PatchLoop marks a task verified only from Kane's passing final event and successful process exit. The edited recording shows the target selection, Kane's status changing from Running to Verified, the passing run details, and the signed-out screen. Its run record has no code diff, so it does not demonstrate a Codex repair of the seeded restore defect. PatchLoop does not auto-merge or deploy changes.

## Voiceover script

PatchLoop checks a coding task against a fixed browser objective. This showcase objective tests a subtle restore bug: a completed task should keep its title and checked state after it is archived and restored.

Here, I select PatchLoop Full Showcase as the target application. The runner and target are separate local repositories. To follow along, clone both repositories. Set PATCHLOOP_TARGET_REPO to the showcase checkout in the same terminal before starting the paired local worker. Sign in to Kane and Codex on that computer, pair the worker with PatchLoop, and leave it running.

Kane runs the saved browser objective. It creates the task, marks it complete, archives it, checks that it is in Archived, restores it, and checks that it returns to Active with the completed state intact. Watch the run move from Kane Running to Verified.

The run details show Kane passed with result code 100, success.complete, and process exit zero. The step log records the browser actions. The same record says no worktree diff was recorded, so this footage proves the Kane verification result; it does not show Codex repairing the app. A repair demo needs an actual reviewed code diff and a passing rerun of this same objective.

I finish by signing out of the PatchLoop session.

### What appears in the edited recording

| Time | Screen action | Narration focus |
|---|---|---|
| 0:00-0:24 | Select PatchLoop Full Showcase and show the restore objective. | Introduce the bug and the fixed browser acceptance test. |
| 0:24-0:59 | Show the Kane run move from Running to Verified. | Explain the run steps and call out the actual Verified transition. |
| 0:59-1:11 | Show the passed Kane record and browser step log. | State result code 100, `success.complete`, exit 0, and no worktree diff. |
| 1:11-1:25 | Show the signed-out PatchLoop screen. | Close by signing out. |

This is a local QA recording. It demonstrates a passed Kane verification and sign-out; it does not show Codex repairing the app because the run record has no worktree diff.

## Recording checklist

- Use a fresh, clean browser window and show no unrelated tabs, account identity, credentials, or private local paths.
- Do not expose CLI profiles, `.patchloop/` state files, personal preparation documents, or private run output beyond the stated evidence.
- Keep earlier failed and timed-out attempts as recorded. Do not replace them with fixtures or relabel their outcomes.
- Verify the exported video is under three minutes, audio is clear, captions match the actions, and an unlisted link opens in a signed-out/incognito browser.
- Add the actual video URL and public app URL only after they exist and have been checked. Submit through the official form only after confirming event rules and eligibility.

For the target contract, hosted pairing steps, live-run caveat, and local setup, see [target repositories](target-repositories.md) and [demo and operations](demo-and-operations.md). The maintainer reports that Google sign-in works, but hosted end-to-end verification requires an actual hosted worker run and record.
