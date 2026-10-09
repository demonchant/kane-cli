const list = document.querySelector('#task-list');
const message = document.querySelector('#message');
let tasks = [];
let view = 'active';
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `Request failed (${response.status})`);
  return value;
}
function render() {
  const activeCount = tasks.filter((task) => !task.archived).length;
  const archivedCount = tasks.filter((task) => task.archived).length;
  document.querySelector('#active-count').textContent = activeCount;
  document.querySelector('#archived-count').textContent = archivedCount;
  for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.view === view);
  const visible = tasks.filter((task) => view === 'archived' ? task.archived : !task.archived);
  list.innerHTML = visible.length ? visible.map((task) => `<li class="task ${task.completed ? 'is-complete' : ''}"><button class="complete" type="button" data-complete="${task.id}" aria-label="${task.completed ? 'Mark active' : 'Mark complete'}: ${escapeHtml(task.title)}" ${view === 'archived' ? 'disabled' : ''}>${task.completed ? '✓' : ''}</button><span class="title">${escapeHtml(task.title)}</span>${view === 'archived' ? `<button class="task-action" type="button" data-restore="${task.id}">Restore</button>` : task.completed ? `<button class="task-action" type="button" data-archive="${task.id}">Archive</button>` : ''}</li>`).join('') : `<li class="empty">${view === 'archived' ? 'Archived tasks will show here.' : 'Your active list is clear. Add a task to get started.'}</li>`;
}
async function refresh() {
  try { tasks = (await request('/api/tasks')).tasks; render(); }
  catch (error) { message.textContent = error.message; }
}
document.querySelector('#task-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.querySelector('#task-title');
  const title = input.value.trim();
  if (!title) return;
  try { await request('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) }); input.value = ''; message.textContent = 'Task saved.'; await refresh(); }
  catch (error) { message.textContent = error.message; }
});
document.querySelector('.task-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-view]');
  if (!tab) return;
  view = tab.dataset.view;
  render();
});
list.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-archive], [data-restore]');
  if (action) {
    const operation = action.dataset.archive ? 'archive' : 'restore';
    const id = action.dataset.archive || action.dataset.restore;
    try { await request(`/api/tasks/${id}/${operation}`, { method: 'POST' }); message.textContent = operation === 'archive' ? 'Task archived.' : 'Task restored.'; await refresh(); }
    catch (error) { message.textContent = error.message; }
    return;
  }
  const button = event.target.closest('[data-complete]');
  if (!button) return;
  try { await request(`/api/tasks/${button.dataset.complete}/complete`, { method: 'POST' }); message.textContent = 'Task updated.'; await refresh(); }
  catch (error) { message.textContent = error.message; }
});
void refresh();
