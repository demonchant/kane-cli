# PatchLoop

**A local workbench for turning a real browser failure into a reviewed agent repair and a same-objective Kane rerun.** PatchLoop keeps the acceptance objective fixed, runs changes in a separate Git worktree, and lets the actual Kane CLI result control the verification state.

> **Provenance:** This implementation was started before the hackathon build window. It is not represented as an event-built submission. The rules supplied for the event say the app and Kane integration must be built during the event; using this pre-event history may affect eligibility.

## How the loop works

1. Describe the requested change and a browser acceptance objective.
2. PatchLoop hashes the objective, creates an isolated worktree, and starts a fresh copy of the selected target app.
3. Kane CLI runs the objective in a real browser. PatchLoop records the final NDJSON event, process exit code, objective hash, and run output.
4. A first failure must be replayed. If the same objective fails in two consecutive Kane runs, review the evidence and choose **Send repeated failure to Codex**. Codex receives the original request and failure output in the worktree; it cannot change the saved objective through PatchLoop.
5. Review the worktree diff and rerun the same objective with Kane. PatchLoop reports `verified` only when it observes a passing final Kane event and zero exit status.

An inconclusive run, missing tool, timeout, or launch error never becomes a pass. Repairs require a human click and are limited to two attempts per task. Changes remain isolated; download the diff to review or apply it yourself.

## Run locally

Requirements: Node.js 20+, Git, Chrome, `@testmuai/kane-cli`, and Codex CLI. Both command line tools must be installed and authenticated through their own login flows.

From a fresh checkout on Windows PowerShell:

```powershell
git clone https://github.com/demonchant/kane-cli.git
cd kane-cli
npm ci
npm run check
npm test
npm start
```

For an existing checkout, start at `npm ci`; do not delete `.patchloop/` if you need to keep its local run history and worktrees.

```powershell
npm start
```

Then open `http://127.0.0.1:4173` in your browser.

The first preflight creates a private copy of the bundled demo task app and initializes it as a local Git repository. The demo starts empty; it is a real small app with a JSON-backed task list, not a fabricated run or result.

```powershell
npm run test:e2e
```

The optional Playwright command requires the configured browser binaries. The Docker instructions below run the browser suite in its pinned container.

### Kane and Codex setup

```powershell
npm install -g @testmuai/kane-cli
kane-cli login --oauth
npm install -g @openai/codex
codex login
```

These logins are local to the computer running PatchLoop. For hosted access, use the local runner flow below. It does not require hosted ChatGPT OAuth approval.

### Use the hosted link with your local accounts

The hosted site is [patchloop-web.onrender.com](https://patchloop-web.onrender.com). Provider credentials stay on the user's computer; local CLI authentication stores are not uploaded. Sign into the website with Google, install this repository and the Kane/Codex CLIs locally, then use **Connect local runner** to pair that computer with a one-time code. Start the helper with the pairing command once; later, start it with `npm run worker -- --url https://patchloop-web.onrender.com`. Keep the terminal open while tasks are running. The runner sends task details, progress, pattern-redacted CLI evidence, and the reviewable diff to that Google account's private session. Avoid putting secrets in task text or code changes. See [operations and demo runbook](docs/demo-and-operations.md) for first-time setup, normal use, troubleshooting, and the recording script.

The project operator pays for Render hosting and storage. Each user uses their own Kane credits and Codex/ChatGPT account. No OpenAI API key or hosted ChatGPT sign-in is required. See the [hosted deployment steps](docs/deployment.md#hosted-link-with-a-local-runner) for the Render URL and Google OAuth configuration.

PatchLoop launches the installed CLIs from the local machine. It does not accept API keys in the browser or `.env`, and it never returns account identity to the UI. If the installed package entry point cannot be found, set the corresponding local environment variable:

```text
PATCHLOOP_KANE_ENTRY=<absolute path to kane-cli.cjs>
PATCHLOOP_CODEX_ENTRY=<absolute path to codex.js>
```

The agent command runs with Codex's workspace-write sandbox and automatic approval review in the PatchLoop worktree. It receives a prompt built from the requested change, the fixed objective hash, and the actual recorded Kane failure. PatchLoop does not auto-merge, commit, push, deploy, or submit changes.

### Docker

Docker provides a reproducible local UI/API runtime and the isolated Playwright browser test image. The authenticated Kane and Codex CLIs remain on the host; Docker does not receive their profiles or credentials. Use the native `npm start` path for an integrated agent/Kane run.

```powershell
docker compose up --build -d patchloop
```

Then open `http://127.0.0.1:4173`. To stop it, run `docker compose down`. State is stored in the local Docker volume `patchloop-state`.

The Docker browser checks use a clean, separate app container and retain the actual report under the ignored `artifacts/playwright/` directory:

```powershell
docker compose --profile test build patchloop-test e2e
docker compose --profile test up --build --abort-on-container-exit --exit-code-from e2e e2e
docker compose --profile test down
```

The Docker UI checks exercise the real PatchLoop app and API. They do not invoke Kane or Codex; those live integrations are exercised by the native app path and must be reported separately.

## Use a different target repo

The default is the bundled demo. To use another local Git repository, start PatchLoop with `PATCHLOOP_TARGET_REPO` pointing to its repository root. It must have a commit, a Node `server.mjs` entry point, and `/api/health`; PatchLoop starts that file in the worktree on a fresh port. The app must honor `PATCHLOOP_PORT` and `PATCHLOOP_DATA_DIR` for each isolated run. Uncommitted files are not copied into the worktree: commit or stash the intended baseline first.

```powershell
$env:PATCHLOOP_TARGET_REPO = 'C:\path\to\your\app'
npm start
```

PatchLoop binds to loopback by default. Do not expose the agent-execution endpoint to a public network. Run history, local worktrees, and demo data live under `.patchloop/` and are excluded from Git.

## Demo preset

**Requested change:** add archive and restore actions for completed tasks. Archived tasks disappear from Active and appear in Archived. Restoring preserves the title and completed status.

**Acceptance objective:** create “Pay electricity bill”, complete it, archive it, verify it is absent from Active and present in Archived, restore it, then verify it returns to Active as completed.

The preset only fills the two input fields. It creates no run or seeded app data. A demo is complete only after the actual Kane, Codex, and same-objective rerun have been observed on this machine.

## Evidence and current limits

- The hosted site is deployed at [patchloop-web.onrender.com](https://patchloop-web.onrender.com). The maintainer reports that Google sign-in works; a complete hosted runner Kane/Codex task has not been independently verified in this checkout.
- Provider CLIs and their authentication stores remain on each user's computer. Local Codex repair has produced a real worktree diff; do not present that local evidence as a hosted repair.
- `npm test` covers objective hashing, final-event parsing, secret redaction, and state persistence.
- The Playwright suite checks the UI and real local API without fabricating responses. It does not claim the Kane workflow ran.
- Kane output parsing requires a final `run_end` event and zero process exit plus an observed successful result code/status. Unknown event formats fail closed.
- Current worktree repair support is scoped to a Node target whose server honors the documented PatchLoop environment variables. A generic arbitrary-command adapter is not implemented.
- An uncommitted target baseline is not copied; the selected repo must have a clean, committed state before verification.
- Kane is a paid/credited third-party service. A live verification needs a signed-in TestMu AI account, available credits, network access, and a working Chrome installation.
- Codex needs its own valid local sign-in. A hosted repair has not been independently observed from this checkout.

## Architecture

```text
Browser UI (loopback)
  → Node API + local JSON history
  → Git worktree from configured repo HEAD
  → target Node app on a fresh local port
  → real `kane-cli run --agent --headless`
  → reviewable failure record + fixed objective hash
  → human authorizes Codex repair in that worktree
  → same objective hash, fresh app data, real Kane rerun
  → observed verdict + downloadable diff
```

More detail: [Architecture and threat boundaries](docs/architecture.md), [claim-to-proof ledger](docs/claim-ledger.md), and [verification record](docs/verification.md).

## Reviewer fast path

1. Follow [local setup](#run-locally) and run `npm run check` and `npm test`.
2. Run the Docker browser suite with the commands in [verification](docs/verification.md). It exercises the real bundled app/API, including archive and restore.
3. Read the [operations/demo guide](docs/demo-and-operations.md) and [submission/video draft](docs/submission.md). The Kane run ID, objective hash, result, and limits are recorded in the verification record.

**Current release state:** the maintainer reports the public Render site and Google sign-in are working at https://patchloop-web.onrender.com. The public repository includes the hosted queue and paired local runner. Local operation and hosted pairing are separate paths; the hosted runner must stay online to process jobs. Render hosting incurs project-owner compute/storage costs, while each user supplies their own Kane credits and Codex/ChatGPT sign-in. The supplied competition brief required project creation during the event window; this repository predates that window, so eligibility must be confirmed with the organizer and is not claimed here.
