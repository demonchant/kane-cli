# Target repositories

PatchLoop's repository picker lists the bundled Goodwork demo and any configured repository reported by the local Engine or paired worker. A selected target ID is saved with each run. Hosted pages receive target IDs, display names, readiness, and setup notes; local filesystem paths stay on the worker.

## Requirements

- The repository root has a committed Git `HEAD`. PatchLoop creates a detached worktree from that commit; uncommitted files in the selected checkout are not copied.
- The app starts on `PATCHLOOP_PORT` (also provided as `PORT`) and binds to `PATCHLOOP_HOST` (`127.0.0.1`).
- Each run uses a fresh `PATCHLOOP_DATA_DIR` so task data does not leak between verification attempts.
- The app exposes a successful readiness endpoint. The default is `/api/health`.
- Register only repositories whose install and start code you trust. PatchLoop executes those commands locally inside its disposable worktree.

Without a manifest, PatchLoop supports a Node application with a root `server.mjs`; it starts it with the current Node executable and checks `/api/health`.

## Optional manifest

Put `patchloop.target.json` at the repository root and commit it:

```json
{
  "name": "My app",
  "requirements": "Node.js 20+; dependencies installed by npm ci.",
  "readyPath": "/api/health",
  "install": {
    "command": "npm",
    "args": ["ci"]
  },
  "start": {
    "command": "node",
    "args": ["server.mjs"]
  }
}
```

Supported fields:

- `name` and `requirements`: picker label and setup notes.
- `install.command`, `install.args`, and optional `install.shell`: dependency setup run from the isolated worktree before each app start.
- `start.command`, `start.args`, and optional `start.shell`: app launch command. The literal `{{port}}` is replaced with the allocated port in command and argument strings.
- `readyPath`: local URL path checked for a successful response; defaults to `/api/health`.
- `env`: additional string environment values. PatchLoop sets its run-specific host, port, and data directory after these values.

Commands are started directly by default. Set `shell: true` only when the target needs shell syntax. The worker executes manifest commands with the user's operating-system permissions. Review the manifest and source before registering a repository.

## Configure and choose a repository

For the integrated local app:

```powershell
$env:PATCHLOOP_TARGET_REPO = 'C:\path\to\your\app'
npm start
```

For the hosted site, set the same variable in the terminal that starts the paired worker:

```powershell
$env:PATCHLOOP_TARGET_REPO = 'C:\path\to\your\app'
npm run worker -- --url https://patchloop-web.onrender.com
```

The worker reports a sanitized catalog when it starts. Keep it running, refresh or wait for the picker, then choose the repository before submitting the task. Restart the worker after changing `PATCHLOOP_TARGET_REPO` or its manifest. Unavailable targets cannot be selected, and existing records retain their saved target.

## Showcase target

[`examples/patchloop-full-showcase`](../examples/patchloop-full-showcase) is the standalone sample target published at `demonchant/patchloop-full-showcase`. Clone it to the worker computer, set `PATCHLOOP_TARGET_REPO` to that checkout, and select **PatchLoop Full Showcase**. Its initial commit intentionally clears completion when a task is restored. The expected live demonstration is two failures of the fixed Kane objective, a human-approved Codex repair, diff review, and a pass of the unchanged objective.

The showcase sequence has not been run as part of this change. Do not describe a Kane/Codex repair as passed until a real run record contains initial failure evidence and a successful same-objective Kane final event after the repair.
