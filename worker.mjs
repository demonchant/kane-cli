import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcess } from './lib/process.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, '.patchloop', 'remote-worker');
const CONFIG_FILE = path.join(DATA_DIR, 'worker-auth.json');
const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
};
const site = argValue('--url');
const pairingCode = argValue('--pair-code');
const disconnect = args.includes('--disconnect');

if (!site) {
  process.stderr.write('Usage: npm run worker -- --url https://your-patchloop.onrender.com [--pair-code CODE]\n');
  process.exit(2);
}
let siteUrl;
try {
  siteUrl = new URL(site);
  if (siteUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(siteUrl.hostname)) throw new Error('HTTPS is required for the hosted runner.');
  if (siteUrl.pathname !== '/' || siteUrl.search || siteUrl.hash) throw new Error('Pass the site origin only, without a path or query.');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(2);
}

await mkdir(DATA_DIR, { recursive: true });
let credentials = null;
try { credentials = JSON.parse(await readFile(CONFIG_FILE, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }

async function saveCredentials(value) {
  const temporary = `${CONFIG_FILE}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, CONFIG_FILE);
}

async function request(endpoint, { method = 'GET', body, authenticated = true } = {}) {
  const response = await fetch(new URL(endpoint, siteUrl), {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(authenticated && credentials?.token ? { authorization: `Bearer ${credentials.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const content = await response.text();
  let result;
  try { result = content ? JSON.parse(content) : {}; } catch { result = {}; }
  if (!response.ok) throw new Error(result.error ?? `PatchLoop request failed (${response.status}).`);
  return result;
}

if (pairingCode) {
  const result = await request('/api/worker/exchange', { method: 'POST', body: { code: pairingCode }, authenticated: false });
  credentials = { token: result.token, pairedAt: new Date().toISOString() };
  await saveCredentials(credentials);
  process.stdout.write(`Paired with ${siteUrl.origin}. The runner token is stored only in ${CONFIG_FILE}.\n`);
}
if (!credentials?.token) {
  process.stderr.write('This computer is not paired. Sign in to PatchLoop, create a pairing code, then pass --pair-code CODE once.\n');
  process.exit(2);
}
if (disconnect) {
  await request('/api/worker/disconnect', { method: 'POST' });
  await unlink(CONFIG_FILE);
  process.stdout.write('Runner disconnected and the local token file was removed.\n');
  process.exit(0);
}

process.env.PATCHLOOP_DATA_DIR = DATA_DIR;
const [{ Engine }, { Store }] = await Promise.all([
  import('./lib/engine.mjs'),
  import('./lib/store.mjs'),
]);
const store = new Store(path.join(DATA_DIR, 'state.json'));
const engine = new Engine(store);
const preflight = await engine.preflight();
const codexAuth = await runProcess(process.execPath, [process.env.PATCHLOOP_CODEX_ENTRY ?? globalCodexEntry(), 'login', 'status'], { timeoutMs: 12_000, maxBytes: 12_000 });
const codexUsesApiKey = /api[ -]?key/i.test(codexAuth.stdout);
if (!preflight.kane.installed || !preflight.kane.authenticated || !preflight.agent.installed || codexAuth.code !== 0 || codexUsesApiKey) {
  process.stderr.write('Runner setup is incomplete. Install Kane CLI and Codex CLI, sign into Kane with `kane-cli login --oauth`, and sign into Codex with `codex login`.\n');
  process.exit(2);
}
process.stdout.write(`Local tools ready. Watching ${siteUrl.origin} for your private tasks. Press Ctrl+C to stop.\n`);

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

while (!stopping) {
  try {
    const response = await request('/api/worker/next');
    if (!response.run) {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      continue;
    }
    const remoteRun = response.run;
    const action = remoteRun.workerAction;
    await store.importWorkerRun(remoteRun, action);
    process.stdout.write(`Running ${action} for ${remoteRun.id}. Task and provider execution remain on this computer.\n`);
    let reportRunning = false;
    const report = async () => {
      if (reportRunning) return;
      reportRunning = true;
      try {
        const current = await store.get(remoteRun.id);
        if (current) await request('/api/worker/report', { method: 'POST', body: current });
      } catch (error) { process.stderr.write(`Progress sync delayed: ${error.message}\n`); }
      finally { reportRunning = false; }
    };
    const heartbeat = setInterval(() => { void report(); }, 1800);
    try {
      if (action === 'verify') await engine.startVerification(remoteRun.id);
      else if (action === 'repair') await engine.repair(remoteRun.id);
      else throw new Error('The server assigned an unknown runner action.');
    } catch (error) {
      await store.update(remoteRun.id, (run) => {
        run.state = action === 'repair' ? 'agent_error' : 'setup_error';
        run.events.push({ at: new Date().toISOString(), type: action === 'repair' ? 'agent_error' : 'setup_error', message: error.message.slice(0, 1200) });
      });
    } finally {
      clearInterval(heartbeat);
      await report();
    }
    process.stdout.write(`Finished ${remoteRun.id}. Review the evidence in the PatchLoop page.\n`);
  } catch (error) {
    process.stderr.write(`Runner connection: ${error.message}\n`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

process.stdout.write('Local runner stopped. The saved pairing will be available the next time it starts.\n');

function globalCodexEntry() {
  if (process.env.PATCHLOOP_CODEX_ENTRY) return path.resolve(process.env.PATCHLOOP_CODEX_ENTRY);
  const npmGlobal = process.platform === 'win32'
    ? path.join(process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? '', 'AppData', 'Roaming'), 'npm', 'node_modules')
    : path.join(process.env.NPM_CONFIG_PREFIX ?? '/usr/local', 'lib', 'node_modules');
  return path.join(npmGlobal, '@openai', 'codex', 'bin', 'codex.js');
}
