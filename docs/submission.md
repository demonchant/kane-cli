# Submission draft and three-minute video script

**Status:** draft. This is copy and a recording plan, not a submitted entry or a recorded video. Confirm the current event rules, eligibility, repo timing, and form with the organizer before using it. The app predates the event build window described in the supplied materials, so do not claim it was built during the event or eligible without organizer confirmation.

## One-paragraph submission copy

PatchLoop is a local workbench for developers using coding agents who want browser evidence before accepting a change. It records a fixed natural-language acceptance objective, runs Kane against an isolated copy of a real app, and keeps failures, setup errors, and inconclusive results distinct. After a repeatable failure, a developer can ask Codex to repair the isolated worktree, review the diff, and rerun the unchanged objective. PatchLoop marks a task verified only from Kane's passing final event and successful process exit. In the bundled app, a real Kane run confirmed that a completed task disappears from Active when archived, appears in Archived, and returns to Active with its checkmark after restore. The local Docker Playwright suite also passed all six browser tests. PatchLoop does not auto-merge or deploy changes.

## Three-minute screen recording script

Record the real local app and actual existing run records. Do not replace the recorded Kane result with a fixture or imply that an old failed attempt passed. Keep run IDs and objective hashes visible long enough to read. The latest known real passing evidence is run `db0ac6a2-2929-442f-a383-8e20d153ee28`; the full local run record remains on the developer machine.

| Time | Screen action | Voiceover |
|---|---|---|
| 0:00–0:15 | Open PatchLoop and show the task/run workbench. | “Coding agents can change an app quickly, but a completion message does not show whether the user flow works. PatchLoop keeps the browser result and the code change in one reviewable local workflow.” |
| 0:15–0:35 | Show the bundled task and its fixed acceptance objective. Point out its objective hash. | “The objective is saved before verification. PatchLoop records its hash so a later repair cannot quietly weaken the acceptance check.” |
| 0:35–1:00 | Open the passing Kane run record. Show the actual final result, exit code, run ID, and verification timeline. | “Kane ran in a real browser against the bundled app. This recorded run passed with Kane’s final success result and a zero process exit. Earlier failed and timed-out runs remain failed and inconclusive in the local history.” |
| 1:00–1:35 | In the bundled task app, show the completed task in Active. Archive it, open Archived, then restore it and return to Active. | “Here the task is completed. Archiving removes it from Active and puts it in Archived. Restoring brings it back to Active without clearing the completed checkmark.” |
| 1:35–2:00 | Show the Playwright test definition for the same journey, then the verification record with the Docker suite result. | “The same postcondition is covered by a Docker Playwright test against the real app and API. All six browser tests passed in the recorded run; the browser suite does not pretend to run Kane or Codex.” |
| 2:00–2:30 | Show the repair attempt/diff summary and same objective hash in the verification notes. | “When Kane reports a repeatable failure, a human can send the recorded evidence to Codex in an isolated Git worktree. PatchLoop shows the diff and requires another Kane run; Codex’s summary cannot mark a task verified.” |
| 2:30–3:00 | Show README local setup and the hosted runner pairing instructions. End on repo and evidence docs. | “The local workbench uses each developer’s signed-in Kane and Codex tools. For a hosted link, Google keeps each PatchLoop history private while a paired local runner executes provider tools on that user’s computer. The repository includes the setup and worker code. Render and Google OAuth still need to be configured; no public URL is claimed until that deployment is live.” |

## Recording checklist

- Use a fresh, clean browser window and show no unrelated tabs, account identity, credentials, or private local paths.
- Do not expose CLI profiles, `.patchloop/` state files, personal preparation documents, or private run output beyond the stated evidence.
- If the old run records are not safe to show on screen, record only the sanitized run ID/result in the verification document and show the runnable browser regression instead.
- Verify the exported video is under three minutes, audio is clear, captions match the actions, and an unlisted link opens in a signed-out/incognito browser.
- Add the actual video URL and public app URL only after they exist and have been checked. Submit through the official form only after confirming event rules and eligibility.
