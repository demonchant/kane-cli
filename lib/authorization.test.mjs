import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadRun } from './authorization.mjs';
import { signSession, verifySession } from './google-auth.mjs';

test('private run records are visible only to their owning account', () => {
  const run = { id: 'run-1', ownerId: 'google-subject-a' };
  assert.equal(canReadRun(run, 'google-subject-a'), true);
  assert.equal(canReadRun(run, 'google-subject-b'), false);
  assert.equal(canReadRun(run, ''), false);
  assert.equal(canReadRun(null, 'google-subject-a'), false);
});

test('signed sessions reject tampering and expired claims', () => {
  const secret = Buffer.from('test session signing key that is long enough');
  const now = 1_800_000_000_000;
  const valid = signSession({ sub: 'subject-a', email: 'a@example.com', exp: now / 1000 + 60 }, secret);
  assert.deepEqual(verifySession(valid, secret, now), { sub: 'subject-a', email: 'a@example.com', name: undefined });
  assert.equal(verifySession(`${valid}x`, secret, now), null);
  assert.equal(verifySession(valid, Buffer.from('a different signing key of adequate size'), now), null);
  assert.equal(verifySession(signSession({ sub: 'subject-a', exp: now / 1000 }, secret), secret, now), null);
  assert.equal(verifySession('not-a-session', secret, now), null);
});
