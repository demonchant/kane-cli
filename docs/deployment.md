# Run and deployment path

## Integrated local mode (recommended)

The app stays on loopback and invokes the native Kane/Codex installs and Chrome profiles of the signed-in local user.

```powershell
npm ci
npm start
```

Open `http://127.0.0.1:4173`. A successful start prints the local URL. The UI preflight checks the CLIs and prepares a private bundled target repository. Run `npm run check` and `npm test` before using a different target. The app uses `.patchloop/` for persistent state, demo target, worktrees, and per-attempt app data; that directory is ignored by Git.

Kane runs default to a 900-second timeout to allow multi-flow browser objectives to finish. Set `PATCHLOOP_KANE_TIMEOUT_SECONDS` from 60 to 1800 to change it; PatchLoop gives Kane an additional 15 seconds to emit its final event.

To use an existing local target, set `PATCHLOOP_TARGET_REPO` before startup. Its working tree should be clean and committed. The worktree target needs a root `server.mjs`, `/api/health`, and support for `PATCHLOOP_PORT` and `PATCHLOOP_DATA_DIR`. PatchLoop does not execute arbitrary shell text from the browser.

## Docker UI/API mode

```powershell
docker compose up --build -d patchloop
docker compose ps
docker compose logs --tail 80 patchloop
```

Docker publishes only `127.0.0.1:4173`. The image runs as a non-root user with a read-only root filesystem, dropped capabilities, and a persistent named volume. Use `docker compose down` to stop it. Use `docker compose down -v` only if you intend to remove the saved local records and worktrees.

The authenticated CLI profiles are intentionally not copied or mounted into Docker. Therefore the Compose app is a UI/API deployment; live agent/Kane execution uses the native local mode. The Compose browser test profile runs a disposable app container and a pinned Playwright container with no CLI credentials.

## External/public hosting

No public URL is deployed. Render can host a Node web service at a public `onrender.com` URL, but this app is not safe to expose in its current form. It has no user authentication or tenant boundary, and its API starts Kane/Codex child processes and creates Git worktrees. Same-origin checks and loopback defaults do not authenticate public users.

Render requires a public web service to listen on `0.0.0.0` and the port from `PORT`. PatchLoop currently defaults to `127.0.0.1:4173`; changing only those values would make the unauthenticated process API public and is not an acceptable deployment. Render filesystems are ephemeral by default; PatchLoop's run history and worktrees need a durable storage design, and Render persistent disks are available only on paid services.

### Safe path to a hosted user experience

The local GitHub version remains available and runnable with the setup above. A hosted product needs, at minimum:

1. Google login and authorization on every state-changing and run/evidence endpoint.
2. Per-user repositories, run records, worktrees, quotas, and cleanup, with isolation enforced server-side.
3. A worker boundary for untrusted repo code and browser sessions. The public web process must not execute arbitrary user repository code in its own shared instance.
4. An operator-funded Kane account and OpenAI Platform project, with server-side secrets, spend caps, quotas, and abuse limits. End users should not connect provider accounts.
5. Durable database/object storage, retention controls, audit events, and operational monitoring.
6. Security review and tests for cross-user access, prompt/repository attacks, resource exhaustion, and worker cleanup.

Until those items exist, keep the full process API on loopback. A Render link can be added after this boundary is implemented and verified; a static marketing page or read-only demo would not be the full PatchLoop workflow.

### Hosted link and authentication setup

This is the setup path for a **login-only hosted preview**. It creates a Render URL and private Google-owned run-history sessions. The current blueprint deliberately disables task creation, Kane, and Codex; it is not yet the requested full live service. Do not announce this preview as a live agent product.

#### 1. Publish the repository

Push the project to the GitHub repository, then sign into Render and create a new Blueprint deployment from `demonchant/kane-cli`, branch `main`, using the repository's `render.yaml`. The blueprint creates a paid web service and persistent disk. Keep the service private until the Google OAuth callback is configured.

#### 2. Create the Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com/):

1. Create or select a Google Cloud project and configure the OAuth consent screen / Google Auth Platform branding and audience. Choose External if people outside your Workspace need to sign in. While in testing mode, add each tester as a test user; public use requires completing Google's applicable publishing and verification steps.
2. Create an OAuth client with application type **Web application**.
3. After Render gives the service its URL, enter that origin under **Authorized JavaScript origins**, for example `https://patchloop-web.onrender.com`.
4. Add this exact **Authorized redirect URI**: `https://patchloop-web.onrender.com/auth/google/callback` (replace the hostname with the actual Render URL; preserve the path).
5. Copy the OAuth client ID and client secret. Do not commit them or paste them into source files.

The app requests only `openid`, `email`, and `profile`; Google is used for login and account identity. It does not authorize Kane or Codex.

#### 3. Set Render environment values and deploy

In Render service **Environment**, set:

| Variable | Value |
|---|---|
| `PATCHLOOP_AUTH_MODE` | `google` |
| `PATCHLOOP_EXECUTION_MODE` | `disabled` (required by this release) |
| `PATCHLOOP_PUBLIC_URL` | The exact HTTPS origin, e.g. `https://patchloop-web.onrender.com` |
| `GOOGLE_CLIENT_ID` | The Web application client ID from Google |
| `GOOGLE_CLIENT_SECRET` | The matching client secret; mark it secret |
| `PATCHLOOP_SESSION_SECRET` | Generate a random secret of at least 32 bytes; mark it secret |

The Blueprint sets the auth mode, execution mode, persistent data path, and generated session secret. Fill the `sync: false` values when prompted or in the service dashboard. Never add secrets to GitHub, `.env.example`, browser JavaScript, or a support message. Trigger a deploy after configuring the values.

Check `https://<your-service>.onrender.com/api/health`, open the site in a private browser, and complete Google sign-in. Sign in with two different Google accounts and check that each account sees an empty, separate history. Run creation remains disabled and returns HTTP 503 by design. Sign-out should clear that browser's session. If sign-in fails, check that `PATCHLOOP_PUBLIC_URL`, the Google origin, and callback URI match exactly and that the user is allowed by the consent-screen audience.

#### 4. Operator-owned provider accounts and live runs

The product requirement is: users sign in to PatchLoop with Google and then use it; PatchLoop owns the Kane and Codex provider accounts and pays for usage. Do not ask each user for provider credentials. The owner must provision and fund the service accounts once, outside this repository.

For Kane, the operator needs a TestMu AI account with an access key and usage capacity. Kane CLI supports headless account authentication with username and access key, including per-run flags. The app does not yet load these operator credentials or pass them to a hosted worker; do not place them in browser code, GitHub, or a general-purpose shared environment. See [TestMu's Kane CLI authentication guide](https://www.testmuai.com/docs/kane-cli-authentication).

For Codex, the operator needs an OpenAI Platform project with billing and a server-side API key for programmatic Codex CLI usage. Codex supports API-key authentication, which is billed at API rates; this is different from ChatGPT plan sign-in. **Do not add a "Sign in with ChatGPT" provider step for end users.** OpenAI's website SIWC flow is a limited trial for users connecting their own ChatGPT accounts/plans, which is the opposite account model. See [Codex authentication](https://developers.openai.com/codex/auth) and [Sign in with ChatGPT for websites](https://developers.openai.com/siwc/website).

Before live runs are enabled, implement and review:

1. **Trusted worker boundary:** a disposable, resource-limited environment per run. User repository code must never be able to inspect provider secrets. Keep the web app, untrusted target app, Codex process, and Kane process separated so credentials reach only trusted components that need them.
2. **Safe execution lifecycle:** enforce clean repository checkouts, timeouts, quotas, spending limits, concurrency limits, cancellation, and complete worker cleanup. Do not run untrusted repository commands on the shared public web service.
3. **Tenant isolation:** enforce Google user ownership for every record, worktree, artifact, and downloadable diff. Keep each user's state and artifacts separate.
4. **Production operations:** protect and rotate provider secrets, redact logs, add abuse monitoring, set retention/deletion, and recover durable state after restarts. Verify with multiple Google accounts and hostile repository tests.

Only after those features and checks are complete should the hosted service enable execution. The current server intentionally fails startup if Google hosted mode is configured with execution enabled; it has one shared engine and does not yet implement the operator-owned provider credentials or isolated workers. Keep that guard. A login-only Render preview can exercise Google auth, but it cannot run a task, and no mock verdict path is enabled.

## Required local prerequisites

- Node.js 20 or newer and Git.
- Kane CLI, a TestMu AI account signed into that CLI, remaining Kane credits, and Chrome.
- Codex CLI signed in through its native login flow.
- For a non-bundled target, a clean Git repository following the Node target contract above.

PatchLoop does not need or accept a cloud database, payment provider, domain, or public deployment credential.
