# Rubric and proof map

This is a working map for the supplied Kane CLI hackathon brief. The October event's current official rules and form were not independently retrievable during this pass, so confirm the exact labels, deadline, repository timing, and eligibility with the organizer before submitting. No score or eligibility is claimed here.

| Criterion | What a reviewer can verify | Implementation and evidence | Demo beat | Status / limit |
|---|---|---|---|---|
| Ships | Open the live service or start the real local workbench; inspect task execution and results. | [Live URL](https://patchloop-web.onrender.com); `README.md`; `docs/deployment.md`; `server.mjs`; `worker.mjs`; `demo-template/`; Docker Compose configuration. | Sign in, connect a local runner, submit a real task; alternatively follow local setup. | Hosted service and worker code are present. Maintainer reports sign-in works; end-to-end hosted runner execution still needs a recorded result. |
| Verified | Kane actually exercised the bundled app and returned a passing final event. | `docs/verification.md`; run `db0ac6a2-2929-442f-a383-8e20d153ee28`; `lib/engine.mjs`. | Show the fixed objective/hash and actual Kane result. | Verified on the bundled archive/restore task; run history stays local. |
| Closed loop | A recorded Kane failure was passed to Codex in an isolated worktree; a diff was produced; Kane later verified the repaired baseline using the same objective. | `lib/engine.mjs`; repair and pass details in `docs/verification.md`; `docs/claim-ledger.md`. | Show the failure, same objective hash, isolated diff, and later real Kane pass as separate recorded evidence. | Observed across preserved runs; the earlier Kane run records are not included in this public repository. |
| Craft | The workbench shows objective identity, attempt status, diff, and failure/setup distinctions; automated browser checks cover the critical task flow. | `public/`; `e2e/workbench.spec.mjs`; eight-test Docker Playwright run summarized in `docs/verification.md`. | Show failure-safe state and archive/restore postcondition; explain the local trust boundary. | Core flow is tested locally. Hosted multi-user isolation is implemented but needs a live account-to-account verification record. |

## Claim-to-proof path

| Claim | Proof path | Limit |
|---|---|---|
| A completion mark survives archive and restore. | Kane run `db0ac6a2-2929-442f-a383-8e20d153ee28`; Playwright case `archives a completed task and restores it to Active with its checkmark`. | One bundled demo task and one real Kane run; not broad app compatibility evidence. |
| PatchLoop does not mark an unknown Kane result as success. | `lib/process.mjs` parser checks; `lib/engine.mjs` state transitions; `lib/process.test.mjs`; incomplete/failed browser cases in `e2e/workbench.spec.mjs`. | Deterministic local test coverage, not a formal security audit. |
| Repairs are isolated and require a human-triggered action. | `lib/engine.mjs` worktree/repair paths; preserved repair diff evidence summarized in `docs/verification.md`. | Local repair execution is observed; hosted runner repair remains unverified. Repo execution trusts the selected repository. |
