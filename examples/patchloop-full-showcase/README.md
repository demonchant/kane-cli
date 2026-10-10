# PatchLoop Full Showcase target

This is a small, real Node.js task application intended to be selected from PatchLoop's repository picker. It has an Active list, completion checkboxes, an Archived list, and archive/restore actions backed by a JSON data file.

## Purpose

The initial commit deliberately contains one documented repair challenge: restoring an archived completed task clears its completed state. The bundled Kane objective catches that defect. A successful demonstration records two failures of the same fixed objective, a human-approved Codex repair in a disposable worktree, a reviewable diff, and a Kane rerun of the unchanged objective.

The challenge bug is intentional and isolated to this showcase repository. Do not copy it into a production application.

## Point PatchLoop at this repository

Clone this repository on the computer running the paired local worker. Then start the worker from the PatchLoop checkout with the repository path set:

### Windows PowerShell

```powershell
$env:PATCHLOOP_TARGET_REPO = 'C:\path\to\patchloop-full-showcase'
npm run worker -- --url https://patchloop-web.onrender.com
```

### macOS / Linux

```sh
export PATCHLOOP_TARGET_REPO="$HOME/src/patchloop-full-showcase"
npm run worker -- --url https://patchloop-web.onrender.com
```

The site will list **PatchLoop Full Showcase** in the target repository picker. Select it before submitting the task. The worker uses this committed baseline to create an isolated Git worktree. It never edits the checkout you selected.

For first pairing, use the one-time command copied from your signed-in PatchLoop page; later starts omit `--pair-code`. See the PatchLoop repository's local runner guide for setup and authentication.

## Repair challenge

**Coding task**

> Fix task restoration so restoring an archived completed task preserves its completed checkbox and title.

**Fixed Kane acceptance objective**

> On the Tasks page, create a task named “PatchLoop repair proof,” mark it complete, archive it, verify it is absent from Active and present in Archived, restore it, then verify it appears in Active with its completed checkbox still checked and its title unchanged.

Kane should first expose the defect after restoration. Replay the same objective once. After the repeated failure, inspect the recorded evidence and explicitly request Codex. Review its diff and run the unchanged objective again. A repair is verified only if Kane returns a passing final event and exits successfully.

## Runtime contract

`patchloop.target.json` supplies the start command and readiness URL. PatchLoop also sets `PORT`, `PATCHLOOP_PORT`, `PATCHLOOP_HOST`, and a fresh `PATCHLOOP_DATA_DIR` for each run. The app binds to loopback and stores each run's task data in that isolated directory.
