import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
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
const PUBLIC_URL = process.env.PATCHLOOP_PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL;
const EXECUTION_MODE = process.env.PATCHLOOP_EXECUTION_MODE ?? (HOSTED ? 'disabled' : 'local');
if (!['disabled', 'local', 'worker'].includes(EXECUTION_MODE)) throw new Error('PATCHLOOP_EXECUTION_MODE must be disabled, local, or worker.');
if (HOSTED && EXECUTION_MODE === 'local') throw new Error('Google hosted mode cannot run local task execution on the web service.');
if (!HOSTED && EXECUTION_MODE === 'worker') throw new Error('Worker queue mode requires Google hosted authentication.');
const EXECUTION_ENABLED = EXECUTION_MODE !== 'disabled';
const auth = HOSTED && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && PUBLIC_URL && process.env.PATCHLOOP_SESSION_SECRET ? createGoogleAuth({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  publicUrl: PUBLIC_URL,
  sessionSecret: process.env.PATCHLOOP_SESSION_SECRET,
}) : null;
const HOST = process.env.PATCHLOOP_HOST ?? (HOSTED ? '0.0.0.0' : '127.0.0.1');
const PORT = Number(process.env.PORT ?? process.env.PATCHLOOP_PORT ?? 4173);
const store = new Store(path.join(STATE_DIR, 'state.json'));
const engine = new Engine(store);
const pairingCodes = new Map();
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const redactDiff = (value) => String(value)
  .replace(/(?:sk|pk|ghp|gho|github_pat|testmu)[-_][A-Za-z0-9_-]{12,}/gi, '[REDACTED]')
  .replace(/(access[-_ ]?key\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
  .replace(/https?:\/\/test-manager\.lambdatest\.com\/[^\s"'<>]+/gi, '[REDACTED_URL]')
  .replace(/https?:\/\/[^\s"'<>]*\/(?:share|shared|evidence)\/[A-Za-z0-9_-]{24,}[^\s"'<>]*/gi, '[REDACTED_URL]')
  .replace(/https?:\/\/[^\s"']*(?:token|signature|secret)=[^\s"']*/gi, '[REDACTED_URL]');

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
  if (HOSTED) return auth?.readSession(req.headers.cookie) ?? null;
  return { sub: 'local', email: '', name: 'Local user' };
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
    return send(res, 200, { mode: AUTH_MODE, authenticated: Boolean(user), authReady: !HOSTED || Boolean(auth), user: user ? { email: user.email, name: user.name } : null, executionEnabled: EXECUTION_ENABLED });
  }
  if (HOSTED && req.method === 'GET' && url.pathname === '/auth/google') {
    if (!auth) return send(res, 503, { error: 'Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render, then redeploy.' });
    return redirect(res, auth.start(res));
  }
  if (HOSTED && req.method === 'GET' && url.pathname === '/auth/google/callback') {
    try {
      if (!auth) return send(res, 503, { error: 'Google sign-in is not configured yet.' });
      if (url.searchParams.has('error')) throw new Error('Google sign-in was cancelled.');
      await auth.complete(req, res, url);
      return redirect(res, '/');
    } catch (error) {
      return send(res, 401, { error: error.message });
    }
  }
  if (HOSTED && req.method === 'POST' && url.pathname === '/auth/logout') {
    if (!auth) return send(res, 503, { error: 'Google sign-in is not configured yet.' });
    const origin = req.headers.origin;
    if (!origin || !sameOrigin(req) || new URL(PUBLIC_URL).origin !== new URL(origin).origin) return send(res, 403, { error: 'Cross-origin request rejected.' });
    auth.clear(res);
    return send(res, 200, { ok: true });
  }

  if (HOSTED && req.method === 'POST' && url.pathname === '/api/worker/exchange') {
    if (req.headers.origin && (!sameOrigin(req) || new URL(PUBLIC_URL).origin !== new URL(req.headers.origin).origin)) return send(res, 403, { error: 'Cross-origin request rejected.' });
    if (EXECUTION_MODE !== 'worker') return send(res, 503, { error: 'The local runner is not enabled on this deployment.' });
    const { code } = await bodyJson(req, 2000);
    const pending = typeof code === 'string' ? pairingCodes.get(code) : null;
    if (!pending || pending.expiresAt < Date.now()) return send(res, 401, { error: 'Pairing code is invalid or expired. Generate a new code from your signed-in PatchLoop session.' });
    pairingCodes.delete(code);
    const token = randomBytes(32).toString('base64url');
    await store.registerWorker(pending.ownerId, hashToken(token));
    return send(res, 200, { token, paired: true });
  }

  if (HOSTED && url.pathname.startsWith('/api/worker/') && !['/api/worker/pair', '/api/worker/status'].includes(url.pathname)) {
    if (EXECUTION_MODE !== 'worker') return send(res, 503, { error: 'The local runner is not enabled on this deployment.' });
    const match = (req.headers.authorization ?? '').match(/^Bearer ([A-Za-z0-9_-]{40,100})$/);
    if (!match) return send(res, 401, { error: 'Worker authentication required.' });
    const tokenHash = hashToken(match[1]);
    if (!await store.workerByTokenHash(tokenHash)) return send(res, 401, { error: 'Runner token is invalid or has been replaced.' });
    if (req.method === 'GET' && url.pathname === '/api/worker/next') {
      return send(res, 200, { run: await store.claimWorkerRun(tokenHash) });
    }
    if (req.method === 'POST' && url.pathname === '/api/worker/report') {
      const snapshot = await bodyJson(req, 2_000_000);
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return send(res, 400, { error: 'Runner report must be an object.' });
      if (Array.isArray(snapshot.attempts)) for (const attempt of snapshot.attempts) {
        if (typeof attempt.outputTail === 'string') attempt.outputTail = redact(attempt.outputTail).slice(-10000);
        if (typeof attempt.finalEvent === 'string') attempt.finalEvent = redact(attempt.finalEvent).slice(0, 8000);
      }
      if (Array.isArray(snapshot.events)) for (const event of snapshot.events) if (typeof event.message === 'string') event.message = redact(event.message).slice(0, 2000);
      if (typeof snapshot.lastDiff === 'string') snapshot.lastDiff = redactDiff(snapshot.lastDiff).slice(0, 1_400_000);
      if (typeof snapshot.diffStat === 'string') snapshot.diffStat = redact(snapshot.diffStat).slice(0, 2000);
      return send(res, 200, { run: await store.reportWorkerRun(tokenHash, snapshot) });
    }
    if (req.method === 'POST' && url.pathname === '/api/worker/disconnect') {
      await store.removeWorker(tokenHash);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'Worker endpoint not found.' });
  }

  const user = userFor(req);
  if (HOSTED && url.pathname.startsWith('/api/') && !['/api/health', '/api/session'].includes(url.pathname) && !user) return send(res, 401, { error: 'Sign in with Google to access your private PatchLoop session.' });
  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    const originOk = sameOrigin(req) && (!HOSTED || (origin && PUBLIC_URL && new URL(PUBLIC_URL).origin === new URL(origin).origin));
    if (!originOk) return send(res, 403, { error: 'Cross-origin request rejected.' });
  }

  if (HOSTED && EXECUTION_MODE === 'worker' && req.method === 'POST' && url.pathname === '/api/worker/pair') {
    for (const [code, value] of pairingCodes) if (value.expiresAt < Date.now()) pairingCodes.delete(code);
    if ([...pairingCodes.values()].filter((item) => item.ownerId === user.sub).length >= 2) return send(res, 429, { error: 'Too many active pairing codes. Wait 10 minutes and try again.' });
    const code = randomBytes(18).toString('base64url');
    pairingCodes.set(code, { ownerId: user.sub, expiresAt: Date.now() + 10 * 60 * 1000 });
    return send(res, 201, { code, expiresInSeconds: 600 });
  }
  if (HOSTED && EXECUTION_MODE === 'worker' && req.method === 'GET' && url.pathname === '/api/worker/status') {
    return send(res, 200, await store.workerStatus(user.sub));
  }

  if (req.method === 'GET' && url.pathname === '/api/preflight') {
    if (HOSTED && EXECUTION_MODE === 'worker') return send(res, 200, { hosted: true, executionEnabled: true, worker: await store.workerStatus(user.sub) });
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
    if (!HOSTED && engine.busy) return send(res, 409, { error: 'Another Kane or agent process is running.' });
    const run = await store.create({ task, objective, objectiveHash: hashText(objective), ownerId: HOSTED ? user.sub : null });
    if (HOSTED) await store.update(run.id, (item) => { item.workerAction = 'verify'; });
    else void engine.startVerification(run.id).catch((error) => store.update(run.id, (item) => { item.state = 'setup_error'; item.events.push({ at: new Date().toISOString(), type: 'setup_error', message: redact(error.message) }); }));
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
      if (!HOSTED && engine.busy) return send(res, 409, { error: 'Another Kane or agent process is running.' });
      const run = await store.get(id);
      if (!canReadRun(user, run) || !['needs_review', 'unresolved', 'inconclusive', 'setup_error'].includes(run.state)) return send(res, 409, { error: 'This task cannot be re-verified yet.' });
      if (HOSTED) await store.update(id, (item) => { item.state = 'queued'; item.workerAction = 'verify'; item.events.push({ at: new Date().toISOString(), type: 'verification_queued', message: 'The unchanged objective is waiting for your paired local runner.' }); });
      else void engine.startVerification(id).catch((error) => store.update(id, (item) => { item.state = 'setup_error'; item.events.push({ at: new Date().toISOString(), type: 'setup_error', message: redact(error.message) }); }));
      return send(res, 202, { accepted: true });
    }
    if (req.method === 'POST' && action === 'repair') {
      if (!EXECUTION_ENABLED) return send(res, 503, { error: 'Hosted execution is paused until isolated per-user workers are available.' });
      if (!HOSTED && engine.busy) return send(res, 409, { error: 'Another Kane or agent process is running.' });
      const run = await store.get(id);
      if (!canReadRun(user, run) || !['needs_review', 'agent_error'].includes(run.state)) return send(res, 409, { error: 'Only your recorded Kane failure or failed agent call can be retried.' });
      if (HOSTED) await store.update(id, (item) => { item.workerFromState = item.state; item.state = 'queued'; item.workerAction = 'repair'; item.events.push({ at: new Date().toISOString(), type: 'repair_queued', message: 'The recorded failure is waiting for your paired local runner.' }); });
      else void engine.repair(id).catch((error) => store.update(id, (item) => { item.state = 'agent_error'; item.events.push({ at: new Date().toISOString(), type: 'agent_error', message: redact(error.message) }); }));
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
