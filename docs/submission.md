# Submission draft and three-minute video script

**Status:** draft. This is copy and a recording plan, not a submitted entry or a recorded video. Confirm the current event rules, eligibility, repo timing, and form with the organizer before using it. The app predates the event build window described in the supplied materials, so do not claim it was built during the event or eligible without organizer confirmation.

## One-paragraph submission copy

PatchLoop is a local workbench for developers using coding agents who want browser evidence before accepting a change. It records a fixed natural-language acceptance objective, lets the user choose a bundled or locally configured repository, runs Kane against an isolated Git worktree, and keeps failures, setup errors, and inconclusive results distinct. After a repeatable failure, a developer can ask Codex to repair that worktree, review the diff, and rerun the unchanged objective. PatchLoop marks a task verified only from Kane's passing final event and successful process exit. A historic Kane run against the bundled app confirmed archive and restore behavior; that record does not demonstrate the separate seeded showcase repair. The showcase target and its intentional restore defect are provided for a live run, but no Kane/Codex repair run has been recorded for it yet. PatchLoop does not auto-merge or deploy changes.

## Three-minute screen recording script

Record the real local app and actual run records. The historic bundled-demo run `db0ac6a2-2929-442f-a383-8e20d153ee28` is evidence for that bundled objective only. Record the showcase sequence only after running it, and show the IDs and objective hash from that session. Never replace a Kane result with a fixture or imply an old failed attempt passed.

| Time | Screen action | Voiceover |
|---|---|---|
| 0:00–0:15 | Open PatchLoop and show the repository picker. Select PatchLoop Full Showcase. | “PatchLoop lets me choose the local app that will be tested. The paired runner reports available repositories without sending their local paths to the site.” |
| 0:15–0:35 | Load the showcase repair request and fixed objective. Show its hash. | “This sample app contains an intentional restore regression. The acceptance objective is saved before verification, and the same objective will be used after the repair.” |
| 0:35–1:00 | Show the first actual Kane failure after restore, then replay the unchanged objective. | “Kane found that the task returned to Active without its completed state. I replayed the same objective, and PatchLoop records both attempts against the same target and objective hash.” |
| 1:00–1:35 | Review the repeated failure evidence and click the human approval control for Codex. | “After inspecting the repeated failure, I explicitly ask Codex to repair it in the isolated worktree. The existing checkout remains the committed baseline.” |
| 1:35–2:00 | Inspect the actual Codex diff and rerun the same Kane objective. | “I review the code diff, then rerun the saved objective. PatchLoop can verify only from Kane's real passing final event and a successful process exit. Here are the run ID, objective hash, exit code, and final result.” |
| 2:00–2:25 | Show the picker/API tests and current test report. | “The repository picker and target validation have UI and API coverage. These automated checks do not invoke Kane or Codex; the live records on screen are separate evidence.” |
| 2:25–3:00 | Show the target contract, hosted runner setup, and verification record. | “The target contract documents the app requirements and manifest. The hosted site queues work while the paired worker uses the user's local Kane and Codex sign-ins. The repository records the scope of automated and live verification.” |

**Recording gate:** this script describes the intended showcase demonstration, not completed evidence. If the real Kane failure, Codex diff, and same-objective Kane pass are unavailable, label the recording as setup and expected workflow. Do not narrate the repair as completed.

## Recording checklist

- Use a fresh, clean browser window and show no unrelated tabs, account identity, credentials, or private local paths.
- Do not expose CLI profiles, `.patchloop/` state files, personal preparation documents, or private run output beyond the stated evidence.
- Keep earlier failed and timed-out attempts as recorded. Do not replace them with fixtures or relabel their outcomes.
- Verify the exported video is under three minutes, audio is clear, captions match the actions, and an unlisted link opens in a signed-out/incognito browser.
- Add the actual video URL and public app URL only after they exist and have been checked. Submit through the official form only after confirming event rules and eligibility.

For the target contract, hosted pairing steps, live-run caveat, and local setup, see [target repositories](target-repositories.md) and [demo and operations](demo-and-operations.md). The maintainer reports that Google sign-in works, but hosted end-to-end verification requires an actual hosted worker run and record.
