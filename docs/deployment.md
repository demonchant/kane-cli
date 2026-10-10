# Run and deployment path

## Integrated local workbench

The local app invokes the Kane and Codex CLIs installed for the signed-in desktop user. It binds to loopback by default.

```powershell
npm ci
npm start
```

Open `http://127.0.0.1:4173`. The first preflight prepares a private bundled target repository under `.patchloop/`. Run history, worktrees, and demo data stay there and are excluded from Git. Keep this directory if you need those local records.

To use another local target, set `PATCHLOOP_TARGET_REPO` to a clean, committed Git repository root before `npm start`. The target must have a `server.mjs`, `/api/health`, and honor `PATCHLOOP_PORT` and `PATCHLOOP_DATA_DIR`. PatchLoop does not execute arbitrary shell text from the browser.

## Hosted link with a local runner

**Live service:** [https://patchloop-web.onrender.com](https://patchloop-web.onrender.com). The maintainer reports Google sign-in is now working. This checkout could not reach Render during this documentation update, so this is not an independent uptime or hosted end-to-end verification result.

The hosted service provides Google sign-in, private run history, and a task queue. A paired local runner performs the real Kane and Codex work on the user's computer. Google credentials stay in the web session; Kane/Codex login profiles, target code, and worktrees stay on that computer and the CLI authentication stores are not uploaded. The hosted service receives task details, progress, pattern-redacted CLI evidence, and the reviewable diff so it can show run status and evidence. Avoid putting secrets in task text or code changes.

Each user needs Node.js 20+, Git, Chrome, Kane CLI access and credits, and Codex CLI signed into their own ChatGPT account. No OpenAI API key or hosted ChatGPT sign-in is needed. The runner must remain open to pick up tasks. The project owner pays the Render hosting bill; each user consumes their own provider account allowance.

### 1. Push the repository and create a Render Blueprint

Push the code to `https://github.com/demonchant/kane-cli` on `main`. In Render, choose **New → Blueprint**, connect that GitHub repository and branch, and review `render.yaml`. The blueprint defines the Node web service, health check, persistent data disk, Google login, and worker-queue mode. Create the service when ready. Google login is deliberately left pending until you add your OAuth client after Render assigns the public URL. The current Blueprint selects a paid Starter instance and a 1 GB persistent disk; review the current amount in the Render dashboard before confirming.

Render web services receive a public `onrender.com` subdomain and must listen on `0.0.0.0` and the assigned `PORT`; this project already does both in hosted mode. PatchLoop reads Render's `RENDER_EXTERNAL_URL` automatically, so you do not need to guess or paste the site URL into an environment variable. See [Render web services](https://render.com/docs/web-services) and [Render's first deploy guide](https://render.com/docs/your-first-deploy).

### 2. Configure Google OAuth

In [Google Cloud Console](https://console.cloud.google.com/), create or select a project, configure Google Auth Platform branding and audience, and create an OAuth client with application type **Web application**. For public users outside your Workspace, set the audience to External and complete Google's required publishing/verification. In testing mode, add each tester as a test user.

After Render shows the URL, use that exact origin in both places below (replace the sample hostname):

- Authorized JavaScript origin: `https://patchloop-web.onrender.com`
- Authorized redirect URI: `https://patchloop-web.onrender.com/auth/google/callback`

The OAuth app only requests `openid`, `email`, and `profile`. It uses Google to identify and scope a PatchLoop session; it does not authorize Kane or Codex.

### 3. Set Render environment values and deploy

In the Render service's **Environment** page, add the two Google values below. `render.yaml` already sets `PATCHLOOP_AUTH_MODE=google`, `PATCHLOOP_EXECUTION_MODE=worker`, `PATCHLOOP_DATA_DIR=/var/data/.patchloop`, and generates `PATCHLOOP_SESSION_SECRET`. If OAuth values are missing, the app stays in setup-pending mode: health checks work, but sign-in and user APIs remain unavailable.

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Web application client ID from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Matching client secret; keep it marked secret |
| `PATCHLOOP_SESSION_SECRET` | Keep the generated secret; it must be at least 32 bytes |

Save the environment and deploy/redeploy. Check `https://YOUR-SERVICE.onrender.com/api/health`, then open the site and sign into Google. If sign-in fails, check the origin, redirect URI, client ID, secret, and OAuth audience/test-user settings. `PATCHLOOP_PUBLIC_URL` is an optional override; Render deployments should use `RENDER_EXTERNAL_URL` automatically.

### 4. Pair each user's local runner

Each user performs these steps on the computer where Kane and Codex should run. Do not put CLI auth files or credentials in the repository or Render environment.

```powershell
git clone https://github.com/demonchant/kane-cli.git
cd kane-cli
npm ci
npm install -g @testmuai/kane-cli @openai/codex
kane-cli login --oauth
codex login
codex login status
```

Then open the Render site, sign into Google, and select **Connect local runner**. Run the one-time pairing command shown by the page in the checkout terminal. That code expires after 10 minutes and can be used once. The command saves a revocable runner token under the ignored `.patchloop/remote-worker/` directory. Keep the process running. On later starts, use:

```powershell
npm run worker -- --url https://YOUR-SERVICE.onrender.com
```

The first pairing command includes `--pair-code CODE`. Do not share it. To disconnect and revoke the saved runner token:

```powershell
npm run worker -- --url https://YOUR-SERVICE.onrender.com --disconnect
```

The helper checks that Kane is authenticated and Codex CLI has a non-API-key login, then runs the same local Engine used by the integrated workbench. It persists the local target, worktrees, and provider CLI profiles on that computer. The Render side stores only a hash of the runner token. Re-pairing replaces that user's prior token. If the runner is offline, new jobs stay queued.

### 5. Verify and operate the service

With the runner connected, create one low-risk task and check that it progresses from **Queued** to a Kane result. Review the event log, actual Kane result, fixed objective hash, and diff. A Kane failure is not a pass; repairs remain human-triggered and require two matching failed Kane attempts when no repair has yet occurred. Verify Google accounts separately to confirm each account only sees its own history and runner status.

The app uses a persistent Render disk with one service instance and a JSON state file. Do not scale this Blueprint horizontally: runner queues and JSON writes are designed for the single service instance. Back up the Render disk before any migration or manual state-file maintenance. Treat tasks, evidence, and diffs synced to the service as private application data.

## Docker UI/API mode

```powershell
docker compose up --build -d patchloop
docker compose ps
docker compose logs --tail 80 patchloop
```

Docker publishes only `127.0.0.1:4173`. The image runs as a non-root user with a read-only root filesystem, dropped capabilities, and a persistent named volume. Use `docker compose down` to stop it. Use `docker compose down -v` only if you intend to remove saved records and worktrees. The integrated local workbench is the path that has native access to the CLI profiles.

## Required local prerequisites

- Node.js 20 or newer, Git, and Chrome.
- Kane CLI, a signed-in TestMu AI account, and available Kane credits.
- Codex CLI signed in with `codex login` using the user's ChatGPT account.
- For a non-bundled target, a clean, committed Git repository following the Node target contract above.

The PatchLoop hosted code does not ask users for provider credentials or an OpenAI API key. Render hosting and storage still have a project-owner cost; check the current service plan in Render before deployment.
