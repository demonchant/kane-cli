import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { Engine } from './engine.mjs';

const execFileAsync = promisify(execFile);

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
  const root = await makeTarget({ name: 'Manifest app', requirements: 'Node.js 20+', start: { command: 'node', args: ['server.mjs'] }, readyPath: '/api/health' });
  try {
    process.env.PATCHLOOP_TARGET_REPO = root;
    const engine = new Engine({});
    const targets = await engine.listTargets();
    assert.deepEqual(targets.map(({ id, ready }) => ({ id, ready })), [
      { id: 'bundled-demo', ready: true },
      { id: 'configured', ready: true },
    ]);
    assert.equal(targets[1].name, 'Manifest app');
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
