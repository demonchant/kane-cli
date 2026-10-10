# Rubric and proof map

This map reflects the organizer brief supplied for the October Kane CLI hackathon. The current official event page and submission form were not independently retrievable during this pass, so confirm exact labels, deadlines, repository timing, and eligibility with the organizer before submitting. The four judging dimensions were described as equally weighted, with **Verified** and then **Closed loop** as tie-breakers. No score or eligibility is claimed here.

| Criterion | What a reviewer can verify | Implementation and evidence | Demo beat | Status / limit |
|---|---|---|---|---|
| Ships | Open the live service or start the real local workbench; inspect task execution and results. | [Live URL](https://patchloop-web.onrender.com); `README.md`; `docs/deployment.md`; `server.mjs`; `worker.mjs`; `demo-template/`; Docker Compose configuration. | Sign in, connect a local runner, submit a real task; alternatively follow local setup. | Hosted service and worker code are present. Maintainer reports sign-in works; end-to-end hosted runner execution still needs a recorded result. |
| Verified | Kane actually exercised the bundled app and returned a passing final event. | `docs/verification.md`; run `db0ac6a2-2929-442f-a383-8e20d153ee28`; `lib/engine.mjs`. | Show the fixed objective/hash and actual Kane result. | Verified on the bundled archive/restore task; run history stays local. |
| Closed loop | A recorded Kane failure was passed to Codex in an isolated worktree; a diff was produced; Kane later verified the repaired baseline using the same objective. | `lib/engine.mjs`; repair and pass details in `docs/verification.md`; `docs/claim-ledger.md`. | Show the failure, same objective hash, isolated diff, and later real Kane pass as separate recorded evidence. | Observed across preserved runs; the earlier Kane run records are not included in this public repository. |
| Craft | The workbench shows objective identity, attempt status, diff, and failure/setup distinctions; automated browser checks cover the critical task flow. | `public/`; `e2e/workbench.spec.mjs`; eight-test Docker Playwright run summarized in `docs/verification.md`. | Show failure-safe state and archive/restore postcondition; explain the local trust boundary. | Core flow is tested locally. Hosted multi-user isolation is implemented but needs a live account-to-account verification record. |

## Submission requirements and eligibility

| Requirement in supplied brief | What is ready | Evidence / reviewer path | Status or remaining action |
|---|---|---|---|
| Public or invited GitHub repository | Public project repository on `main`. | [GitHub repository](https://github.com/demonchant/kane-cli); start at `README.md`. | Published. Private build guides, event pass, personal prep, local secrets, and run data are excluded. |
| README and runnable app | Local setup, hosted runner setup, Docker instructions, prerequisites, and service URL are documented. | [README](../README.md); [deployment](deployment.md); [operations guide](demo-and-operations.md). | Local run command is `npm start`; hosted service is [patchloop-web.onrender.com](https://patchloop-web.onrender.com). Maintainer reports Google sign-in works. Hosted end-to-end runner execution is not yet independently evidenced here. |
| Short project paragraph | Draft is written and describes the product and its actual behavior. | [Submission draft](submission.md#one-paragraph-submission-copy). | Ready for organizer form review; confirm the form's length/format requirement. |
| Three-minute demo video | A timed recording script and safe recording checklist are provided. | [Demo script](demo-and-operations.md#three-minute-demo-script); [submission draft](submission.md). | Not recorded yet. Record a real run, keep it under three minutes, upload it, and test the link. |
| TestMu account and at least one real Kane run | A real Kane archive/restore pass is documented with its result and exit code. | [Verification record](verification.md), run `db0ac6a2-2929-442f-a383-8e20d153ee28`. | Evidence is from the local bundled app, not the hosted worker. Account credentials stay private. |
| Kane integration and coding-agent closed loop | Kane drives browser verification; Codex produced a real isolated worktree diff, followed by a same-objective passing Kane run in the preserved local evidence. | [Verification record](verification.md); implementation in `lib/engine.mjs`. | Local loop evidence is documented. It is not evidence that a hosted worker completed a repair. |
| App, Kane integration, and repository initialized during event window | Repository and app history are preserved as they are. | GitHub commit history. | **Potential eligibility blocker:** this repository predates the October 26–November 2 event window in the supplied brief. Do not claim event-window creation or rewrite history; ask the organizer whether this entry is eligible. |
| Submit through official form | Submission copy and proof map are available to use. | Organizer's current form and rules. | Not submitted; confirm current form, deadline/timezone, eligibility, and save the submission receipt. A GitHub push is not a form submission. |

## Claim-to-proof path

| Claim | Proof path | Limit |
|---|---|---|
| A completion mark survives archive and restore. | Kane run `db0ac6a2-2929-442f-a383-8e20d153ee28`; Playwright case `archives a completed task and restores it to Active with its checkmark`. | One bundled demo task and one real Kane run; not broad app compatibility evidence. |
| PatchLoop does not mark an unknown Kane result as success. | `lib/process.mjs` parser checks; `lib/engine.mjs` state transitions; `lib/process.test.mjs`; incomplete/failed browser cases in `e2e/workbench.spec.mjs`. | Deterministic local test coverage, not a formal security audit. |
| Repairs are isolated and require a human-triggered action. | `lib/engine.mjs` worktree/repair paths; preserved repair diff evidence summarized in `docs/verification.md`. | Local repair execution is observed; hosted runner repair remains unverified. Repo execution trusts the selected repository. |
