import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hashText, parseNdjson, redact } from './process.mjs';
import { evaluateRepeatability } from './repeatability.mjs';
import { Store } from './store.mjs';

test('acceptance objective hashing is stable and content-sensitive', () => {
  assert.equal(hashText('same objective'), hashText('same objective'));
  assert.notEqual(hashText('first objective'), hashText('second objective'));
});

test('Kane parser requires a final run_end event and successful code', () => {
  const passed = parseNdjson(`${JSON.stringify({ type: 'step', status: 'ok' })}\n${JSON.stringify({ type: 'run_end', status: 'passed', result_code: 100 })}`);
  assert.equal(passed.passed, true);
  assert.equal(passed.resultCode, 100);
  assert.equal(parseNdjson('{"type":"run_end","status":"failed","result_code":710}').passed, false);
  assert.equal(parseNdjson('{"type":"step"}').passed, false);
  assert.equal(parseNdjson('not json').malformedCount, 1);
});

test('redactor removes credential-shaped strings and signed query URLs', () => {
  assert.doesNotMatch(redact('access-key=abc123456789abcdef'), /abc123456789abcdef/);
  assert.doesNotMatch(redact('https://example.invalid/run?token=secret-value'), /secret-value/);
  assert.doesNotMatch(redact('https://test-manager.lambdatest.com/projects/abc/test-cases/def/dashboard/share/US_123456789012345678901234?type=summary'), /US_123456789012345678901234/);
});

test('first failure requires exact replay before Codex repair; conflicting replay is inconclusive', () => {
  const hash = hashText('fixed objective');
  const first = evaluateRepeatability([], 'failed', hash, 0);
  assert.equal(first.actionable, false);
  assert.equal(first.label, 'single_failure_needs_replay');
  const repeated = evaluateRepeatability([{ kind: 'kane', verdict: 'failed', objectiveHash: hash }], 'failed', hash, 0);
  assert.equal(repeated.actionable, true);
  assert.equal(repeated.label, 'failure_reproduced');
  const mismatch = evaluateRepeatability([{ kind: 'kane', verdict: 'failed', objectiveHash: hash }], 'passed', hash, 0);
  assert.equal(mismatch.inconsistent, true);
  const afterRepair = evaluateRepeatability([{ kind: 'agent', changed: true }], 'passed', hash, 1);
  assert.equal(afterRepair.inconsistent, false);
});

test('run history survives store reconstruction and objective hash remains attached', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'patchloop-store-'));
  try {
    const file = path.join(dir, 'state.json');
    const first = new Store(file);
    const objective = 'Verify a task persists after a reload.';
    const run = await first.create({ task: 'Persist a task after reload', objective, objectiveHash: hashText(objective) });
    await first.update(run.id, (record) => { record.state = 'needs_review'; record.attempts.push({ id: 'verify-1', kind: 'kane', verdict: 'failed', objectiveHash: record.objectiveHash }); });
    const restarted = new Store(file);
    const saved = await restarted.get(run.id);
    assert.equal(saved.state, 'needs_review');
    assert.equal(saved.objectiveHash, hashText(objective));
    assert.equal(saved.attempts.length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
