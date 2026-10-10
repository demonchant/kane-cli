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

For Docker UI/API and browser checks, follow the commands and limitations in [verification](verification.md) and [deployment](deployment.md). Docker Playwright checks do not authenticate or run Kane/Codex; use the native or hosted worker path for those real integrations.

## Competition submission checklist

The supplied October event materials call for a public/invited GitHub repository, a three-minute demo video, a short project paragraph, and a runnable or live app. Check the current organizer page and form for exact wording, visibility, deadline, eligibility, and submission steps. A GitHub push is not the event submission; save the actual form receipt separately.

This repository's history predates the event build window described in the supplied materials. Do not claim it was built during the event or that it meets that timing requirement. Ask the organizer whether this history is eligible before submitting. The private event pass, personal preparation packet, and personal build guides are intentionally not part of this repository.

## Three-minute demo script

Prepare the run before recording. Use the hosted flow only after a real task has completed through the paired worker and the hosted run page shows its actual result. A previous local Kane pass is useful local evidence but is not evidence of a hosted run. Do not show credentials, pairing codes, provider accounts, unrelated browser tabs, private paths, or raw CLI auth data. If a hosted run is not ready, record the local workflow and say clearly that the hosted path is deployed but its end-to-end run is still being verified.

| Time | What to show | Voiceover |
|---|---|---|
| 0:00–0:20 | Open PatchLoop and show task/workbench. State whether this recording uses hosted or local mode. | “Coding agents can make a change without proving that the browser flow works. PatchLoop ties a fixed acceptance objective to real Kane browser evidence and keeps any repair reviewable.” |
| 0:20–0:45 | Show the task request and acceptance objective before execution; point to its hash. | “The task describes the requested change. The acceptance objective describes what the user must be able to do. PatchLoop stores its hash so repair cannot quietly weaken the check.” |
| 0:45–1:10 | In hosted mode, show Google signed-in session and connected runner indicator, then switch to the already-running local worker terminal without exposing personal data. For local mode, show the workbench running at loopback. | “Google provides a private PatchLoop session. The paired worker runs Kane and Codex on the user's computer, where their CLI sign-ins and code stay.” |
| 1:10–1:50 | Show the real archive/restore journey: completed task in Active, archive, Archived list, restore, then Active with completed check still set. | “This task is complete. Archive hides it from Active and puts it in Archived. Restore returns it to Active and preserves the completed checkmark.” |
| 1:50–2:20 | Show the actual run record, run ID, objective hash, attempt timeline, final Kane result, and exit code. | “This is the recorded result from the real run. PatchLoop only reports verified when Kane's final event passes and the process exits successfully. Failed and timed-out attempts remain recorded with their actual states.” |
| 2:20–2:40 | Show evidence/test summary and the diff review view if a real repair is available. Do not imply that the archive pass itself required repair. | “Playwright also covers the archive and restore postcondition. When a repeatable browser failure needs code repair, Codex edits an isolated worktree; a person reviews the diff, then Kane reruns the same objective.” |
| 2:40–3:00 | Show the public repository README, deployment/operations guide, and verification record. | “The repository includes local setup, hosted runner setup, deployment details, and test evidence. The site is live at patchloop-web.onrender.com. Each runner user supplies their own Kane access and Codex sign-in; the project pays for hosting.” |

Before recording, replace the generic run reference on screen with the actual run ID and result from the session being demonstrated. Keep claims aligned with what that run proves. Add the finished video URL to the organizer's form only after the recording exists and is playable.

## Recorded verification evidence

The committed [verification record](verification.md) reports the following past results from the local bundled application; these are not hosted-worker results:

- `npm.cmd run check` passed.
- `npm.cmd test` passed (7 tests).
- Docker Playwright passed (8 tests) on October 9, 2026.
- Kane run `db0ac6a2-2929-442f-a383-8e20d153ee28` passed the archive/restore objective with result code `100` (`success.complete`) and process exit `0`.
- Earlier attempts `87ec7a34-99f2-4625-b63f-621de1d078b3` (failed) and `704c51dc-3e5e-490a-a049-0b881ad4a1a2` (timed out/inconclusive) remain distinct from that passing run.

These records show the app's local behavior and test coverage. They do not establish broad compatibility, a hosted end-to-end Kane/Codex run, or event eligibility.
