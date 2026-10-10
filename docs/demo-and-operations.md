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

There are **two separate repositories** to clone on the local runner computer. PatchLoop's repository contains the app and worker. The target repository is the application you want PatchLoop to test or repair. For the showcase, clone the public showcase repository as a separate folder:

```powershell
cd $HOME
git clone https://github.com/demonchant/kane-cli.git
git clone https://github.com/demonchant/patchloop-full-showcase.git
cd $HOME\kane-cli
npm ci
npm install -g @testmuai/kane-cli @openai/codex
kane-cli login --oauth
codex login
codex login status
```

For your own project, clone its GitHub repository to this computer too, then use that local checkout as the target. Review its code and `patchloop.target.json` first: PatchLoop runs its target manifest commands locally. The target must have a committed Git baseline. Commit or stash work you want included; PatchLoop creates an isolated worktree from the committed `HEAD`, not from uncommitted files. These CLI logins happen locally. Do not paste provider passwords, tokens, pairing codes, or auth files into the website, repository, video, or Render settings.

### Pair the local runner and register the target

1. Open [https://patchloop-web.onrender.com](https://patchloop-web.onrender.com) and sign in with Google.
2. Choose **Connect local runner**. Keep the one-time command displayed by the site private; it expires after ten minutes and works once.
3. In PowerShell, set the target path and check it **before starting the worker**. Keep the target path and runner checkout separate:

   ```powershell
   cd $HOME\kane-cli
   $target = Join-Path $HOME 'patchloop-full-showcase'
   Test-Path (Join-Path $target 'patchloop.target.json')
   $env:PATCHLOOP_TARGET_REPO = (Resolve-Path $target).Path
   ```

   `Test-Path` should return `True`. For a different app, replace the showcase folder with that app's local checkout path.

4. Run the first-time pairing command copied from PatchLoop, in this same terminal:

   ```powershell
   npm run worker -- --url https://patchloop-web.onrender.com --pair-code <ONE_TIME_CODE_FROM_PATCHLOOP>
   ```

   The worker saves a revocable local token under the ignored `.patchloop/remote-worker/` folder. It should print the number of ready repository targets; with the bundled target and showcase configured, expect **2 repository targets**. If the count is 1, stop and check the target path and manifest before creating a task.

5. Leave the worker terminal open. Confirm the website says the runner is connected, refresh the page, and choose **PatchLoop Full Showcase** in **Target repository**. Pairing and target registration are separate: a connected runner does not mean the showcase path was registered.
6. Create the requested code change and browser objective. The task describes what the agent should change. The acceptance objective must state the observable browser behavior Kane will check. For the showcase, copy the task and fixed objective from its README.
7. Submit the task, monitor the timeline, then open **Details** to inspect the fixed objective hash, Kane evidence, final event, exit code, and diff. A setup error means the runner or target configuration needs attention; it is not a Kane failure and should not be sent to Codex.
8. After two consecutive failures of the same objective, inspect the evidence and explicitly request a Codex repair if appropriate. Review the actual worktree diff, then run the unchanged objective with Kane again. Claim a successful repair only when a real diff exists and the final same-objective Kane run passes with a successful process exit.

For future worker starts, set `PATCHLOOP_TARGET_REPO` again in each new terminal, then omit the already-used pairing code:

```powershell
cd $HOME\kane-cli
$target = Join-Path $HOME 'patchloop-full-showcase'
$env:PATCHLOOP_TARGET_REPO = (Resolve-Path $target).Path
npm run worker -- --url https://patchloop-web.onrender.com
```

To disconnect and revoke this worker pairing, run `npm run worker -- --url https://patchloop-web.onrender.com --disconnect` from the PatchLoop checkout. If a target is absent, restart the worker after correcting the path or manifest. Existing run records keep their original target and objective; replay only after the worker reports the intended target.

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

## Screen recording and narration

The supplied recording shows target selection, two setup failures caused by a missing target path, a later Kane run that passed, and no worktree diff. It documents configuration recovery and the observed Kane pass; it does not document a Codex repair of the seeded showcase defect. The narration must not describe this as a completed code repair.

| Time | What to show | Voiceover |
|---|---|---|
| 0:00-0:25 | Workbench and showcase restore requirement. | Explain that an archived completed task should restore with its title and checked state, and why a diff alone is not browser proof. |
| 0:25-0:50 | Select the showcase target and show the fixed objective. | Explain the two local clones: PatchLoop's runner and the separate app repository being tested. |
| 0:50-1:12 | Show the actual missing-target setup error. | Explain that the worker could not find the target because `PATCHLOOP_TARGET_REPO` was missing. |
| 1:12-1:30 | Show the target configuration steps. | Explain setting the variable in the worker terminal, restarting it, and confirming both repositories are registered. |
| 1:30-1:50 | Show Kane starting the browser run. | Explain that PatchLoop hashes and preserves the same acceptance objective. |
| 1:50-2:20 | Show Kane's passing final event and the no-diff field. | State the observed result code and exit status; make clear that no Codex diff is shown. |
| 2:20-2:23 | Show the setup guide. | Point viewers to the public source and target repositories and complete setup instructions. |

Do not show credentials, pairing codes, account details, unrelated browser tabs, or raw CLI auth data. Add the video URL to the organizer's form only after the recording exists, plays correctly, and its claims match the run record.

## Recorded verification evidence

The committed [verification record](verification.md) reports the automated and earlier local results below. The screen recording separately shows one hosted worker run and its limitations:

- `npm.cmd run check` passed.
- `npm.cmd test` passed (11 tests) on October 10, 2026, including a showcase manifest launch/health test with a local test CLI stub (not Kane evidence).
- Docker Playwright passed (11 tests) on October 10, 2026, including picker selection and stale-target rejection.
- The showcase HTTP smoke check reproduced the intentional `completed: false` restore regression; it did not run Kane or Codex.
- The supplied hosted recording shows two target setup failures followed by Kane's passing result (code `100`, `success.complete`, exit `0`). Its run details show no code diff, so it does not demonstrate a Codex repair.
- Kane run `db0ac6a2-2929-442f-a383-8e20d153ee28` passed the archive/restore objective with result code `100` (`success.complete`) and process exit `0`.
- Earlier attempts `87ec7a34-99f2-4625-b63f-621de1d078b3` (failed) and `704c51dc-3e5e-490a-a049-0b881ad4a1a2` (timed out/inconclusive) remain distinct from that passing run.

These records show the app's local behavior and test coverage. They do not establish broad compatibility, a hosted end-to-end Kane/Codex run, or event eligibility.
