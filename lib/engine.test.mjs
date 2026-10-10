import test from 'node:test';
import { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testDataDir = await mkdtemp(path.join(os.tmpdir(), 'patchloop-engine-test-'));
const originalDataDir = process.env.PATCHLOOP_DATA_DIR;
const originalKaneEntry = process.env.PATCHLOOP_KANE_ENTRY;
const testCli = path.join(testDataDir, 'test-kane.mjs');
process.env.PATCHLOOP_DATA_DIR = testDataDir;
process.env.PATCHLOOP_KANE_ENTRY = testCli;
await writeFile(testCli, "const url = process.argv[process.argv.indexOf('--url') + 1];\nconst response = await fetch(new URL('/api/health', url));\nif (!response.ok) process.exit(1);\nconsole.log(JSON.stringify({ type: 'run_end', status: 'passed', result_code: 100 }));\n");
const { Engine } = await import('./engine.mjs');

after(async () => {
  if (originalDataDir === undefined) delete process.env.PATCHLOOP_DATA_DIR;
  else process.env.PATCHLOOP_DATA_DIR = originalDataDir;
  if (originalKaneEntry === undefined) delete process.env.PATCHLOOP_KANE_ENTRY;
  else process.env.PATCHLOOP_KANE_ENTRY = originalKaneEntry;
  await rm(testDataDir, { recursive: true, force: true });
});

async function makeTarget(manifest) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'patchloop-target-'));
  await writeFile(path.join(root, 'server.mjs'), "import { createServer } from 'node:http';\ncreateServer((req, res) => { res.writeHead(200); res.end('ok'); }).listen(Number(process.env.PORT), process.env.PATCHLOOP_HOST);\n");
  if (manifest !== null) await writeFile(path.join(root, 'patchloop.target.json'), `${JSON.stringify(manifest)}\n`);
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: root });
  await execFileAsync('git', ['add', '-A'], { cwd: root });
  await execFileAsync('git', ['-c', 'user.name=PatchLoop test', '-c', 'user.email=test@patchloop.invalid', 'commit', '-m', 'Target fixture'], { cwd: root });
  return root;
}

test('catalog registers a committed manifest target without exposing its checkout path', async () => {
  const previous = process.env.PATCHLOOP_TARGET_REPO;
  const root = await makeTarget({ name: 'Manifest app', requirements: 'Node.js 20+; checkout C:\\private\\showcase', start: { command: 'node', args: ['server.mjs'] }, readyPath: '/api/health' });
  try {
    process.env.PATCHLOOP_TARGET_REPO = root;
    const engine = new Engine({});
    const targets = await engine.listTargets();
    assert.deepEqual(targets.map(({ id, ready }) => ({ id, ready })), [
      { id: 'bundled-demo', ready: true },
      { id: 'configured', ready: true },
    ]);
    assert.equal(targets[1].name, 'Manifest app');
    assert.match(targets[1].requirements, /\[local path\]/);
    assert.equal(targets[1].requirements.includes('C:\\private'), false);
    assert.equal(JSON.stringify(targets).includes(root), false);
  } finally {
    if (previous === undefined) delete process.env.PATCHLOOP_TARGET_REPO;
    else process.env.PATCHLOOP_TARGET_REPO = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test('invalid target manifests leave the bundled repository available and hide local errors', async () => {
  const previous = process.env.PATCHLOOP_TARGET_REPO;
  const root = await makeTarget({ name: 'Broken target', start: { command: 'node', args: ['server.mjs'] }, readyPath: 'https://example.invalid/' });
  try {
    process.env.PATCHLOOP_TARGET_REPO = root;
    const targets = await new Engine({}).listTargets();
    assert.equal(targets[0].ready, true);
    assert.equal(targets[1].ready, false);
    assert.equal('error' in targets[1], false);
    assert.equal(JSON.stringify(targets).includes(root), false);
    assert.match(targets[1].requirements, /Check the local repository/);
  } finally {
    if (previous === undefined) delete process.env.PATCHLOOP_TARGET_REPO;
    else process.env.PATCHLOOP_TARGET_REPO = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test('launches the showcase manifest in an isolated worktree and waits for its health path', async () => {
  const previous = process.env.PATCHLOOP_TARGET_REPO;
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'patchloop-showcase-target-'));
  try {
    await cp(path.join(repoRoot, 'examples', 'patchloop-full-showcase'), targetRoot, { recursive: true });
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: targetRoot });
    await execFileAsync('git', ['add', '-A'], { cwd: targetRoot });
    await execFileAsync('git', ['-c', 'user.name=PatchLoop test', '-c', 'user.email=test@patchloop.invalid', 'commit', '-m', 'Showcase test baseline'], { cwd: targetRoot });
    process.env.PATCHLOOP_TARGET_REPO = targetRoot;

    const store = new Store(path.join(testDataDir, 'showcase-state.json'));
    const objective = 'Confirm the manifest target starts and reaches its declared health path.';
    const run = await store.create({ task: 'Start the showcase target', objective, objectiveHash: 'test-objective-hash', targetId: 'configured' });
    const completed = await new Engine(store).startVerification(run.id);

    assert.equal(completed.state, 'verified');
    assert.equal(completed.targetId, 'configured');
    assert.notEqual(completed.worktree, targetRoot);
    assert.equal(completed.attempts[0].kind, 'kane');
    assert.equal(completed.attempts[0].resultCode, 100);
    assert.equal(completed.events.some((event) => event.type === 'verification_started'), true);
  } finally {
    if (previous === undefined) delete process.env.PATCHLOOP_TARGET_REPO;
    else process.env.PATCHLOOP_TARGET_REPO = previous;
    await rm(targetRoot, { recursive: true, force: true });
  }
});
