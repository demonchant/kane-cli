import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(process.env.PATCHLOOP_DATA_DIR ?? path.join(ROOT, '.data'));
const FILE = path.join(DATA, 'tasks.json');
const HOST = process.env.PATCHLOOP_HOST ?? '127.0.0.1';
const PORT = Number(process.env.PATCHLOOP_PORT ?? 4180);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

async function readTasks() {
  try { const data = JSON.parse(await readFile(FILE, 'utf8')); return Array.isArray(data) ? data : []; }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function saveTasks(tasks) {
  await mkdir(DATA, { recursive: true });
  await writeFile(FILE, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
}
function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  res.end(body);
}
async function jsonBody(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 5000) throw new Error('Request too large'); }
  try { return JSON.parse(text || '{}'); } catch { throw new Error('Invalid JSON'); }
}
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true });
  if (req.method === 'GET' && url.pathname === '/api/tasks') return send(res, 200, { tasks: await readTasks() });
  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    const { title } = await jsonBody(req);
    const clean = typeof title === 'string' ? title.trim() : '';
    if (!clean || clean.length > 180) return send(res, 400, { error: 'Enter a title up to 180 characters.' });
    const tasks = await readTasks();
    const task = { id: randomUUID(), title: clean, completed: false, archived: false, createdAt: new Date().toISOString() };
    tasks.unshift(task);
    await saveTasks(tasks);
    return send(res, 201, { task });
  }
  const match = url.pathname.match(/^\/api\/tasks\/([0-9a-f-]{36})\/complete$/i);
  if (req.method === 'POST' && match) {
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === match[1]);
    if (!task) return send(res, 404, { error: 'Task not found.' });
    task.completed = !task.completed;
    await saveTasks(tasks);
    return send(res, 200, { task });
  }
  const archiveMatch = url.pathname.match(/^\/api\/tasks\/([0-9a-f-]{36})\/(archive|restore)$/i);
  if (req.method === 'POST' && archiveMatch) {
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === archiveMatch[1]);
    if (!task) return send(res, 404, { error: 'Task not found.' });
    const action = archiveMatch[2].toLowerCase();
    if (action === 'archive' && !task.completed) return send(res, 400, { error: 'Only completed tasks can be archived.' });
    task.archived = action === 'archive';
    if (action === 'restore') task.completed = false; // Deliberate demo defect: Kane should catch this and Codex should repair it.
    await saveTasks(tasks);
    return send(res, 200, { task });
  }
  if (req.method === 'GET') {
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    if (relative.includes('..') || relative.includes('\\')) return send(res, 400, { error: 'Invalid path' });
    try {
      const data = await readFile(path.join(ROOT, relative));
      res.writeHead(200, { 'content-type': MIME[path.extname(relative)] ?? 'application/octet-stream', 'content-length': data.length, 'cache-control': 'no-store' });
      return res.end(data);
    } catch { res.writeHead(404); return res.end('Not found'); }
  }
  return send(res, 404, { error: 'Not found' });
}
createServer((req, res) => void route(req, res).catch(() => { if (!res.headersSent) send(res, 500, { error: 'Request failed.' }); })).listen(PORT, HOST, () => process.stdout.write(`Demo target at http://${HOST}:${PORT}\n`));
