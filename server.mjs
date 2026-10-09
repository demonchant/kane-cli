import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './lib/store.mjs';
import { Engine } from './lib/engine.mjs';
import { hashText, redact } from './lib/process.mjs';
import { createGoogleAuth } from './lib/google-auth.mjs';
import { canReadRun as isOwnedRun } from './lib/authorization.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const STATE_DIR = path.resolve(process.env.PATCHLOOP_DATA_DIR ?? path.join(ROOT, '.patchloop'));
const AUTH_MODE = process.env.PATCHLOOP_AUTH_MODE ?? 'local';
if (!['local', 'google'].includes(AUTH_MODE)) throw new Error('PATCHLOOP_AUTH_MODE must be local or google.');
const HOSTED = AUTH_MODE === 'google';
const EXECUTION_ENABLED = !HOSTED && process.env.PATCHLOOP_EXECUTION_MODE !== 'disabled';
if (HOSTED && process.env.PATCHLOOP_EXECUTION_MODE !== 'disabled') throw new Error('Hosted task execution is disabled until an isolated worker is configured.');
const auth = HOSTED ? createGoogleAuth({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  publicUrl: process.env.PATCHLOOP_PUBLIC_URL,
  sessionSecret: process.env.PATCHLOOP_SESSION_SECRET,
}) : null;
const HOST = process.env.PATCHLOOP_HOST ?? (HOSTED ? '0.0.0.0' : '127.0.0.1');
const PORT = Number(process.env.PORT ?? process.env.PATCHLOOP_PORT ?? 4173);
const store = new Store(path.join(STATE_DIR, 'state.json'));
const engine = new Engine(store);

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

function send(res, status, value, type = 'application/json; charset=utf-8') {
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  res.writeHead(status, { 'content-type': type, 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" });
  res.end(body);
}

async function bodyJson(req, maxBytes = 16_000) {
  let input = '';
  for await (const chunk of req) {
    input += chunk;
    if (Buffer.byteLength(input) > maxBytes) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  try { return JSON.parse(input || '{}'); } catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function userFor(req) {
  return auth ? auth.readSession(req.headers.cookie) : { sub: 'local', email: '', name: 'Local user' };
}

function canReadRun(user, run) {
  return Boolean(run) && (!HOSTED || isOwnedRun(run, user?.sub));
}

function redirect(res, location) {
  res.writeHead(302, { location, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' });
  res.end();
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? '127.0.0.1'}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, name: 'PatchLoop', version: '1.0.0', mode: process.env.PATCHLOOP_TARGET_REPO ? 'configured' : 'bundled-demo' });
  if (req.method === 'GET' && url.pathname === '/api/session') {
    const user = userFor(req);
    return send(res, 200, { mode: AUTH_MODE, authenticated: Boolean(user), user: user ? { email: user.email, name: user.name } : null, executionEnabled: EXECUTION_ENABLED });
  }
  if (HOSTED && req.method === 'GET' && url.pathname === '/auth/google') return redirect(res, auth.start(res));
  if (HOSTED && req.method === 'GET' && url.pathname === '/auth/google/callback') {
    try {
      if (url.searchParams.has('error')) throw new Error('Google sign-in was cancelled.');
      await auth.complete(req, res, url);
      return redirect(res, '/');
    } catch (error) {
      return send(res, 401, { error: error.message });
    }
  }
  if (HOSTED && req.method === 'POST' && url.pathname === '/auth/logout') {
    const origin = req.headers.origin;
    if (!origin || !sameOrigin(req) || new URL(process.env.PATCHLOOP_PUBLIC_URL).origin !== new URL(origin).origin) return send(res, 403, { error: 'Cross-origin request rejected.' });
    auth.clear(res);
    return send(res, 200, { ok: true });
  }

  const user = userFor(req);
  if (HOSTED && url.pathname.startsWith('/api/') && !['/api/health', '/api/session'].includes(url.pathname) && !user) return send(res, 401, { error: 'Sign in with Google to access your private PatchLoop session.' });
  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    const originOk = sameOrigin(req) && (!HOSTED || (origin && new URL(process.env.PATCHLOOP_PUBLIC_URL).origin === new URL(origin).origin));
    if (!originOk) return send(res, 403, { error: 'Cross-origin request rejected.' });
  }

  if (req.method === 'GET' && url.pathname === '/api/preflight') {
    if (!EXECUTION_ENABLED) return send(res, 200, { hosted: true, executionEnabled: false, message: 'Hosted execution is unavailable until isolated per-user workers are configured.' });
    return send(res, 200, await engine.preflight());
  }
  if (req.method === 'GET' && url.pathname === '/api/runs') {
    const runs = await store.list();
    return send(res, 200, { runs: HOSTED ? runs.filter((run) => run.ownerId === user.sub) : runs });
  }

  if (req.method === 'POST' && url.pathname === '/api/runs') {
    if (!EXECUTION_ENABLED) return send(res, 503, { error: 'Hosted execution is paused until isolated per-user workers are available.' });
    const input = await bodyJson(req);
    const task = typeof input.task === 'string' ? input.task.trim() : '';
    const objective = typeof input.objective === 'string' ? input.objective.trim() : '';
    if (task.length < 12 || task.length > 1600) return send(res, 400, { error: 'Describe the change in 12–1600 characters.' });
    if (objective.length < 16 || objective.length > 1800) return send(res, 400, { error: 'Acceptance objective must be 16–1800 characters.' });
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(task + objective)) return send(res, 400, { error: 'Control characters are not allowed.' });
    if (engine.busy) return send(res, 409, { error: 'Another Kane or agent process is running.' });
    const run = await store.create({ task, objective, objectiveHash: hashText(objective), ownerId: HOSTED ? user.sub : null });
    void engine.startVerification(run.id).catch((error) => store.update(run.id, (item) => { item.state = 'setup_error'; item.events.push({ at: new Date().toISOString(), type: 'setup_error', message: redact(error.message) }); }));
    return send(res, 202, { run });
  }

  const match = url.pathname.match(/^\/api\/runs\/([0-9a-f-]{36})(?:\/(repair|verify|diff))?$/i);
  if (match) {
    const [, id, action] = match;
    if (req.method === 'GET' && !action) {
      const run = await store.get(id);
      return canReadRun(user, run) ? send(res, 200, { run }) : send(res, 404, { error: 'Run not found.' });
    }
    if (req.method === 'GET' && action === 'diff') {
      const run = await store.get(id);
      if (!canReadRun(user, run)) return send(res, 404, { error: 'Run not found.' });
      const diff = await engine.diff(id);
      return diff === null ? send(res, 404, { error: 'Run not found.' }) : send(res, 200, diff, 'text/x-diff; charset=utf-8');
    }
    if (req.method === 'POST' && action === 'verify') {
      if (!EXECUTION_ENABLED) return send(res, 503, { error: 'Hosted execution is paused until isolated per-user workers are available.' });
      if (engine.busy) return send(res, 409, { error: 'Another Kane or agent process is running.' });
      const run = await store.get(id);
      if (!canReadRun(user, run) || !['needs_review', 'unresolved', 'inconclusive', 'setup_error'].includes(run.state)) return send(res, 409, { error: 'This task cannot be re-verified yet.' });
      void engine.startVerification(id).catch((error) => store.update(id, (item) => { item.state = 'setup_error'; item.events.push({ at: new Date().toISOString(), type: 'setup_error', message: redact(error.message) }); }));
      return send(res, 202, { accepted: true });
    }
    if (req.method === 'POST' && action === 'repair') {
      if (!EXECUTION_ENABLED) return send(res, 503, { error: 'Hosted execution is paused until isolated per-user workers are available.' });
      if (engine.busy) return send(res, 409, { error: 'Another Kane or agent process is running.' });
      const run = await store.get(id);
      if (!canReadRun(user, run) || !['needs_review', 'agent_error'].includes(run.state)) return send(res, 409, { error: 'Only your recorded Kane failure or failed agent call can be retried.' });
      void engine.repair(id).catch((error) => store.update(id, (item) => { item.state = 'agent_error'; item.events.push({ at: new Date().toISOString(), type: 'agent_error', message: redact(error.message) }); }));
      return send(res, 202, { accepted: true });
    }
  }

  if (req.method === 'GET') {
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    if (relative.includes('..') || relative.includes('\\')) return send(res, 400, 'Invalid path', 'text/plain; charset=utf-8');
    const file = path.join(PUBLIC, relative);
    try {
      if (!(await stat(file)).isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      const content = await readFile(file);
      res.writeHead(200, { 'content-type': mimeTypes[path.extname(file)] ?? 'application/octet-stream', 'content-length': content.length, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" });
      return res.end(content);
    } catch { return send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
  }
  return send(res, 405, { error: 'Method not allowed.' });
}

const server = createServer((req, res) => {
  void route(req, res).catch((error) => {
    if (res.headersSent) return res.destroy();
    send(res, error.status ?? 500, { error: error.status ? error.message : 'PatchLoop could not complete that request.' });
    if (!error.status) process.stderr.write(`${redact(error.message)}\n`);
  });
});

server.listen(PORT, HOST, () => process.stdout.write(`PatchLoop listening at http://${HOST}:${PORT}\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
