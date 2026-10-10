# PatchLoop: problem, workflow, and demo

## The problem PatchLoop solves

Coding agents can produce code changes faster than a person can check every browser flow. A successful-looking code diff does not prove the requested behavior works, and a failed browser run can be lost or rewritten while someone tries to repair it. PatchLoop keeps the requested browser outcome fixed, records what Kane actually observed, and gives a human a reviewable repair path.

PatchLoop is the evidence and orchestration layer around two user-owned command line tools:

- **Kane CLI** opens a real browser and checks the acceptance objective.
- **Codex CLI** can propose a code repair after a repeatable Kane failure.
- **PatchLoop** records the task, fixed objective hash, attempts, outcomes, and diff; it decides verification from Kane's actual final result and exit status.

PatchLoop does not claim a pass from an agent's explanation, an incomplete run, a timeout, or a launch error. A repair needs a human action, stays in an isolated Git worktree, and must pass the same saved objective on a fresh run. PatchLoop does not merge, commit, deploy, or submit the repair.

## How the service works

There are two ways to use PatchLoop:

1. **Hosted site with a local runner.** The website at [patchloop-web.onrender.com](https://patchloop-web.onrender.com) provides Google sign-in, a private account session, and a queue. A small worker on the user's computer polls that queue and runs Kane/Codex locally. Provider CLI credentials, target repository, and worktrees stay on that computer. Task text, progress, redacted evidence, and the reviewable diff are sent to the user's hosted session.
2. **Integrated local workbench.** The user runs the web app on loopback and it invokes the locally installed CLIs directly. Run history and worktrees remain under the ignored `.patchloop/` directory on that computer.

The hosted service does not provide Kane credits or Codex access. Every worker user must have working local Kane CLI access/credits and Codex CLI signed into their own ChatGPT account. The project owner pays Render hosting and storage. The runner must remain online while a task is being processed.

## Hosted user workflow

### One-time setup on the computer that will run tasks

Requirements: Windows, macOS, or Linux with Node.js 20+, Git, Chrome, a network connection, a signed-in Google account, Kane CLI access/credits, and Codex CLI access through ChatGPT sign-in.

In a terminal:

```powershell
git clone https://github.com/demonchant/kane-cli.git
cd kane-cli
npm ci
npm install -g @testmuai/kane-cli @openai/codex
kane-cli login --oauth
codex login
codex login status
```

These CLI logins happen locally. Do not paste provider passwords, tokens, or auth files into the website, repository, or Render settings.

### Pair the local runner to a Google account

1. Open [https://patchloop-web.onrender.com](https://patchloop-web.onrender.com) and sign in with Google.
2. Choose **Connect local runner** and copy the one-time command displayed by the site.
3. In the local `kane-cli` checkout, run that command. It has this form; use a fresh pairing code copied from your signed-in page:

   ```powershell
   npm run worker -- --url https://patchloop-web.onrender.com --pair-code <FRESH_ONE_TIME_CODE>
   ```

4. Leave that terminal open. Confirm the site reports the runner connected.
5. Create a task and an acceptance objective in the site. The task says what code behavior to change; the objective states the browser-visible outcome that will decide pass or fail.
   To use the showcase target, clone `https://github.com/demonchant/patchloop-full-showcase.git`, review its source and `patchloop.target.json`, then set `$env:PATCHLOOP_TARGET_REPO = 'C:\path\to\patchloop-full-showcase'` in the worker terminal before starting it. Select **PatchLoop Full Showcase** in the picker. It intentionally contains a restore regression; register only repositories you trust because their manifest commands run locally.
6. Watch the task move from queued to running and inspect its attempt timeline, evidence, and final state. A Kane failure remains a failure/review state; a timeout or launch problem is inconclusive/setup error, never a pass.
7. After two consecutive failures of the same objective, inspect the recorded evidence and explicitly request a Codex repair if appropriate. Review the resulting diff. Start a fresh Kane verification of the unchanged objective before calling it verified.

Pairing codes expire after 10 minutes and can be used once. Never publish a code in a README, screenshot, issue, or commit. The worker saves a revocable local token under `.patchloop/remote-worker/`, which is ignored by Git. After first pairing, restart it with:

```powershell
npm run worker -- --url https://patchloop-web.onrender.com
```

To stop and revoke the local worker pairing:

```powershell
npm run worker -- --url https://patchloop-web.onrender.com --disconnect
```

If the worker terminal closes, the computer sleeps, or the network drops, queued work waits until the worker reconnects. A user's history and runner are scoped to their Google account; do not assume hosted multi-account isolation is independently proven until the documented live account-separation check has been recorded.

### Starting the local workbench instead

For a local-only session, in the repository root run:

```powershell
npm ci
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The bundled task app is prepared under `.patchloop/` on first use. Install and authenticate Kane/Codex using the setup above if you want real verification and repair. To preserve local run history and worktrees, do not delete `.patchloop/`.

To use the showcase app locally, set `PATCHLOOP_TARGET_REPO` to its committed checkout before `npm start`, then choose it from the same picker.

For Docker UI/API and browser checks, follow the commands and limitations in [verification](verification.md) and [deployment](deployment.md). Docker Playwright checks do not authenticate or run Kane/Codex; use the native or hosted worker path for those real integrations.

## Competition submission checklist

The supplied October event materials call for a public/invited GitHub repository, a three-minute demo video, a short project paragraph, and a runnable or live app. Check the current organizer page and form for exact wording, visibility, deadline, eligibility, and submission steps. A GitHub push is not the event submission; save the actual form receipt separately.

This repository's history predates the event build window described in the supplied materials. Do not claim it was built during the event or that it meets that timing requirement. Ask the organizer whether this history is eligible before submitting. The private event pass, personal preparation packet, and personal build guides are intentionally not part of this repository.

## Three-minute demo script

Prepare the showcase run before recording. The showcase's first Kane result should fail on the restored completion state; replay the unchanged objective, inspect the repeated failure, approve a Codex repair, review the real diff, and rerun that same objective. Show only result IDs and values from that actual session. The current smoke check confirms the seeded defect but is not a Kane result or a repair. Do not show credentials, pairing codes, provider accounts, unrelated browser tabs, private paths, or raw CLI auth data. If the live loop is not ready, record setup and label the repair as the expected workflow.

| Time | What to show | Voiceover |
|---|---|---|
| 0:00–0:20 | Open the picker and select PatchLoop Full Showcase. State whether the run is local or hosted. | “PatchLoop lets me choose the local app to verify. The paired runner reports repository names and requirements while keeping its filesystem paths local.” |
| 0:20–0:45 | Show the repair request, fixed objective, and objective hash before execution. | “This sample app has an intentional restore regression. The objective checks that the task returns to Active with its title and completed state preserved.” |
| 0:45–1:10 | Show the first actual Kane failure and replay the exact objective. | “Kane found that restore cleared completion. I replayed the same objective, and the saved hash confirms that the acceptance check did not change.” |
| 1:10–1:40 | Show repeated failure evidence and human approval to send it to Codex. | “After reviewing the repeated failure, I explicitly ask Codex to repair the isolated worktree. The selected checkout remains the committed baseline.” |
| 1:40–2:10 | Review the actual diff and rerun the saved Kane objective. | “I review Codex's diff, then run the original objective again. PatchLoop verifies only from Kane's passing final event and successful process exit. These IDs and results are from this session.” |
| 2:10–2:35 | Show the picker and API tests, then the verification record. | “The automated suite covers repository selection and target validation. It does not claim to run Kane or Codex; these live run records are separate evidence.” |
| 2:35–3:00 | Show the public source repo, separate showcase repo, and target setup guide. | “The source and sample target are published separately. The target contract explains setup, and the paired worker uses the user's local Kane and Codex sign-ins.” |

This is a narration plan, not evidence that the showcase loop already passed. If a real Codex diff and same-objective Kane pass do not exist, replace the repair narration with a clear statement that the video shows setup and the intended workflow.

Before recording, replace the generic run reference on screen with the actual run ID and result from the session being demonstrated. Keep claims aligned with what that run proves. Add the finished video URL to the organizer's form only after the recording exists and is playable.

## Recorded verification evidence

The committed [verification record](verification.md) reports the following past results from the local bundled application; these are not hosted-worker results:

- `npm.cmd run check` passed.
- `npm.cmd test` passed (11 tests) on October 10, 2026, including a showcase manifest launch/health test with a local test CLI stub (not Kane evidence).
- Docker Playwright passed (11 tests) on October 10, 2026, including picker selection and stale-target rejection.
- The showcase HTTP smoke check reproduced the intentional `completed: false` restore regression; it did not run Kane or Codex.
- Kane run `db0ac6a2-2929-442f-a383-8e20d153ee28` passed the archive/restore objective with result code `100` (`success.complete`) and process exit `0`.
- Earlier attempts `87ec7a34-99f2-4625-b63f-621de1d078b3` (failed) and `704c51dc-3e5e-490a-a049-0b881ad4a1a2` (timed out/inconclusive) remain distinct from that passing run.

These records show the app's local behavior and test coverage. They do not establish broad compatibility, a hosted end-to-end Kane/Codex run, or event eligibility.
