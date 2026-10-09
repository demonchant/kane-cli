const $ = (selector) => document.querySelector(selector);
const form = $('#run-form');
const taskInput = $('#task');
const objectiveInput = $('#objective');
const runsElement = $('#runs');
const notice = $('#notice');
const detailDialog = $('#detail-dialog');
let lastRuns = [];
let activeSession = null;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const humanState = (state) => ({ needs_review: 'Review failure', setup_error: 'Setup error', agent_error: 'Agent error', inconclusive: 'Inconclusive', unresolved: 'Still failing', verifying: 'Kane running', repairing: 'Agent working', queued: 'Queued', verified: 'Verified' })[state] ?? state;
const stamp = (value) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const shortHash = (value = '') => value ? value.slice(0, 12) : 'not recorded';

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
  const text = await response.text();
  let value;
  try { value = text ? JSON.parse(text) : {}; } catch { value = text; }
  if (!response.ok) throw new Error(value?.error ?? `Request failed (${response.status})`);
  return value;
}

function showNotice(message, error = false) {
  notice.hidden = false;
  notice.classList.toggle('error', error);
  notice.textContent = message;
}

function renderPreflight(result) {
  const rows = [
    ['Kane CLI', result.kane.installed ? result.kane.version : 'Not found'],
    ['Kane sign-in', result.kane.authenticated ? 'Authenticated' : 'Sign-in needed'],
    ['Coding agent', result.agent.installed ? result.agent.version : 'Not found'],
    ['Target repo', result.target.ok ? result.target.mode : 'Not ready'],
  ];
  $('#preflight').innerHTML = rows.map(([label, value], index) => {
    const good = index === 0 ? result.kane.installed : index === 1 ? result.kane.authenticated : index === 2 ? result.agent.installed : result.target.ok;
    return `<div class="preflight-row"><span class="preflight-name">${escapeHtml(label)}</span><span class="preflight-value ${good ? 'ok' : 'bad'}">${escapeHtml(value)}</span></div>`;
  }).join('');
}

async function loadPreflight() {
  if (activeSession?.mode === 'google' && !activeSession.executionEnabled) {
    $('#preflight').innerHTML = '<div class="preflight-row"><span class="preflight-name">Hosted runner</span><span class="preflight-value bad">Not configured</span></div>';
    return;
  }
  $('#preflight').innerHTML = '<div class="preflight-loading"><span class="spinner"></span> Checking local tools…</div>';
  try { renderPreflight(await api('/api/preflight')); }
  catch { $('#preflight').innerHTML = '<div class="preflight-row"><span class="preflight-name">Local checks</span><span class="preflight-value bad">Unavailable</span></div>'; }
}

function eventLabel(event) {
  return ({ created: 'Task submitted', verification_started: 'Kane browser run started', kane_flow_prepared: 'Kane prepared the flow', kane_action_started: 'Kane action started', verification_finished: 'Kane browser run completed', repair_started: 'Codex repair started', repair_finished: 'Codex repair completed', setup_error: 'Setup failed', agent_error: 'Agent stopped' })[event.type] ?? event.type;
}

function renderRun(run) {
  const latest = [...run.attempts].reverse().find((attempt) => attempt.kind === 'kane');
  const attempts = run.attempts.filter((attempt) => attempt.kind === 'kane');
  const lastTwo = attempts.slice(-2);
  const repeatedFailure = lastTwo.length === 2 && lastTwo.every((attempt) => attempt.verdict === 'failed' && attempt.objectiveHash === run.objectiveHash);
  const canRepair = ['needs_review', 'agent_error'].includes(run.state) && run.repairCount < 2 && (run.repairCount > 0 || repeatedFailure);
  const canReplay = ['needs_review', 'unresolved', 'inconclusive', 'setup_error'].includes(run.state);
  const action = `${canReplay ? `<button class="small-button" data-action="verify" data-id="${run.id}">${run.repairCount ? 'Run same Kane check ↻' : (repeatedFailure ? 'Replay again ↻' : 'Replay before repair ↻')}</button>` : ''}${canRepair ? `<button class="small-button danger" data-action="repair" data-id="${run.id}">Send repeated failure to Codex ↗</button>` : ''}`;
  const runDetails = `${run.attempts.length} recorded step${run.attempts.length === 1 ? '' : 's'}`;
  const latestText = latest ? `${latest.verdict}${latest.resultCode !== null ? ` · code ${latest.resultCode}` : ''}` : 'Waiting for Kane';
  return `<article class="run-card" data-run-card="${run.id}">
    <div class="run-main"><div class="run-status status-${escapeHtml(run.state)}"><i class="status-dot"></i>${escapeHtml(humanState(run.state))}</div>
      <div class="run-copy"><div class="run-task">${escapeHtml(run.task)}</div><div class="run-meta"><span>${escapeHtml(stamp(run.createdAt))}</span><span>${escapeHtml(runDetails)}</span><span>${escapeHtml(latestText)}</span><span>objective ${escapeHtml(shortHash(run.objectiveHash))}</span></div></div>
      <div class="run-actions">${action}<button class="small-button" data-action="details" data-id="${run.id}">Details</button></div></div>
    <button class="run-expand" type="button" data-action="details" data-id="${run.id}">Open immutable objective and evidence ↓</button>
  </article>`;
}

async function loadRuns() {
  try {
    const { runs } = await api('/api/runs');
    lastRuns = runs;
    $('#run-count').textContent = String(runs.length);
    runsElement.innerHTML = runs.length ? runs.map(renderRun).join('') : '<div class="empty-state"><div class="empty-mark">↻</div><strong>No runs yet</strong><p>Your first real Kane verification will appear here.</p></div>';
  } catch (error) { showNotice(error.message, true); }
}

function counts() {
  $('#task-count').textContent = `${taskInput.value.length} / 1600`;
  $('#objective-count').textContent = `${objectiveInput.value.length} / 1800`;
}

const demoTask = 'Add archive and restore actions for completed tasks. Archived tasks must disappear from Active and appear in Archived. Restoring a task must preserve its title and completed status.';
const demoObjective = "On the Tasks page, add a task named 'Pay electricity bill', mark it completed, archive it, verify it is absent from Active and present in Archived, restore it, and verify it returns to Active with Completed status.";

$('#load-example').addEventListener('click', () => {
  taskInput.value = demoTask;
  objectiveInput.value = demoObjective;
  counts();
  taskInput.focus();
});
taskInput.addEventListener('input', counts);
objectiveInput.addEventListener('input', counts);
$('#refresh').addEventListener('click', () => { void loadRuns(); void loadPreflight(); });
$('#check-setup').addEventListener('click', () => void loadPreflight());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = $('#submit-run');
  button.disabled = true;
  notice.hidden = true;
  try {
    const { run } = await api('/api/runs', { method: 'POST', body: JSON.stringify({ task: taskInput.value, objective: objectiveInput.value }) });
    showNotice(`Task ${run.id.slice(0, 8)} created. Kane is starting a real browser run.`);
    taskInput.value = '';
    objectiveInput.value = '';
    counts();
    await loadRuns();
  } catch (error) { showNotice(error.message, true); }
  finally { button.disabled = false; }
});

async function showDetails(id) {
  const { run } = await api(`/api/runs/${id}`);
  const attempts = run.attempts.map((attempt) => `<section class="dialog-section"><div class="detail-label">${escapeHtml(attempt.kind.toUpperCase())} · ${escapeHtml(attempt.id)} · ${escapeHtml(attempt.verdict ?? (attempt.changed ? 'CHANGED FILES' : 'COMPLETE'))}</div><p>${escapeHtml(`Started ${stamp(attempt.startedAt)} · exit ${attempt.exitCode ?? 'unknown'}${attempt.resultCode !== undefined && attempt.resultCode !== null ? ` · result code ${attempt.resultCode}` : ''}${attempt.reasonCode ? ` · ${attempt.reasonCode}` : ''}${attempt.timedOut ? ' · timed out' : ''}`)}</p><pre>${escapeHtml(attempt.outputTail ?? attempt.finalEvent ?? 'No CLI output recorded.')}</pre></section>`).join('');
  const events = run.events.map((item) => `<p><span class="detail-label">${escapeHtml(stamp(item.at))} · ${escapeHtml(eventLabel(item))}</span><br>${escapeHtml(item.message)}</p>`).join('');
  const diff = run.lastDiff ? `<div class="detail-actions"><a class="small-button" href="/api/runs/${id}/diff" download="patchloop-${id}.patch">Download worktree diff</a></div>` : '<p>No code diff recorded.</p>';
  $('#detail-body').innerHTML = `<section class="dialog-section"><div class="detail-label">REQUESTED CHANGE</div><p>${escapeHtml(run.task)}</p></section><section class="dialog-section"><div class="detail-label">FIXED OBJECTIVE · SHA-256 ${escapeHtml(run.objectiveHash)}</div><p class="objective-lock">⌑ ${escapeHtml(run.objective)}</p></section><section class="dialog-section"><div class="detail-label">WORKTREE DIFF · ${escapeHtml(run.diffStat || 'No changes')}</div>${diff}</section>${attempts}<section class="dialog-section"><div class="detail-label">TIMELINE</div>${events}</section>`;
  detailDialog.showModal();
}

runsElement.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === 'details') await showDetails(id);
    if (action === 'repair') {
      if (!confirm('Send this recorded Kane failure and the original task to Codex in an isolated worktree?')) return;
      await api(`/api/runs/${id}/repair`, { method: 'POST' });
      showNotice('Repair started. Codex received the recorded Kane failure; the objective remains unchanged.');
      await loadRuns();
    }
    if (action === 'verify') {
      await api(`/api/runs/${id}/verify`, { method: 'POST' });
      showNotice('Kane is rerunning the original objective against the repaired worktree.');
      await loadRuns();
    }
  } catch (error) { showNotice(error.message, true); }
});

$('#close-dialog').addEventListener('click', () => detailDialog.close());
detailDialog.addEventListener('click', (event) => { if (event.target === detailDialog) detailDialog.close(); });
$('#sign-out').addEventListener('click', async () => {
  try {
    await api('/auth/logout', { method: 'POST' });
    location.reload();
  } catch (error) { showNotice(error.message, true); }
});

async function initialize() {
  try {
    activeSession = await api('/api/session');
    if (activeSession.mode === 'google' && !activeSession.authenticated) {
      $('#sign-in-screen').hidden = false;
      $('#app-main').hidden = true;
      $('.privacy').innerHTML = '<i></i> Sign in required';
      return;
    }
    $('#sign-in-screen').hidden = true;
    $('#app-main').hidden = false;
    if (activeSession.mode === 'google') {
      const identity = activeSession.user?.name || activeSession.user?.email || 'Google account';
      $('#session-bar').hidden = false;
      $('#signed-in-user').textContent = `Private session · ${identity}`;
      $('.privacy').innerHTML = '<i></i> Private session';
      if (!activeSession.executionEnabled) {
        $('#hosted-notice').hidden = false;
        $('#submit-run').disabled = true;
        $('.form-hint').textContent = 'Live Kane/Codex runs are waiting for the isolated hosted worker.';
        $('#setup-title').textContent = 'Hosted runner';
        $('.privacy-note span:last-child').textContent = 'Your run records are scoped to your Google account. Hosted execution remains disabled until isolated workers are configured.';
      }
    }
    await Promise.all([loadPreflight(), loadRuns()]);
    if (activeSession.mode === 'google' && !activeSession.executionEnabled) setInterval(() => { void loadRuns(); }, 1800);
    if (activeSession.mode === 'local') setInterval(() => { void loadRuns(); }, 1800);
  } catch (error) {
    $('#sign-in-screen').hidden = false;
    $('#app-main').hidden = true;
    $('#sign-in-error').hidden = false;
    $('#sign-in-error').textContent = `PatchLoop could not load your session: ${error.message}`;
  }
}

counts();
void initialize();
