import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class Store {
  #file;
  #queue = Promise.resolve();

  constructor(file) {
    this.#file = file;
  }

  async #read() {
    try {
      const value = JSON.parse(await readFile(this.#file, 'utf8'));
      if (!Array.isArray(value.runs)) throw new Error('Invalid state file');
      return { ...value, workers: Array.isArray(value.workers) ? value.workers : [] };
    } catch (error) {
      if (error.code === 'ENOENT') return { schema: 1, runs: [], workers: [] };
      throw error;
    }
  }

  async #write(value) {
    await mkdir(path.dirname(this.#file), { recursive: true });
    const temporary = `${this.#file}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.#file);
  }

  #mutate(operation) {
    const result = this.#queue.then(async () => {
      const data = await this.#read();
      const value = await operation(data);
      await this.#write(data);
      return value;
    });
    this.#queue = result.catch(() => {});
    return result;
  }

  async list() {
    await this.#queue;
    const { runs } = await this.#read();
    return runs.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id) {
    return (await this.list()).find((run) => run.id === id) ?? null;
  }

  create(input) {
    return this.#mutate((data) => {
      const run = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        state: 'queued',
        repairCount: 0,
        task: input.task,
        objective: input.objective,
        objectiveHash: input.objectiveHash,
        targetId: input.targetId ?? 'bundled-demo',
        ownerId: input.ownerId ?? null,
        events: [{ at: new Date().toISOString(), type: 'created', message: 'Task captured. Acceptance objective is locked.' }],
        attempts: [],
        worktree: null,
      };
      data.runs.unshift(run);
      return run;
    });
  }

  update(id, updater) {
    return this.#mutate((data) => {
      const run = data.runs.find((item) => item.id === id);
      if (!run) throw new Error('Run not found');
      updater(run);
      run.updatedAt = new Date().toISOString();
      return run;
    });
  }

  delete(id) {
    return this.#mutate((data) => {
      const before = data.runs.length;
      data.runs = data.runs.filter((item) => item.id !== id);
      return data.runs.length !== before;
    });
  }

  registerWorker(ownerId, tokenHash) {
    return this.#mutate((data) => {
      const worker = {
        ownerId,
        tokenHash,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        busyRunId: null,
        targets: [],
      };
      const previous = data.workers.find((item) => item.ownerId === ownerId);
      if (previous?.busyRunId) {
        const run = data.runs.find((item) => item.id === previous.busyRunId && item.ownerId === ownerId);
        if (run && ['queued', 'verifying', 'repairing'].includes(run.state)) {
          run.state = run.workerAction === 'repair' ? 'agent_error' : 'setup_error';
          run.events.push({ at: new Date().toISOString(), type: 'worker_replaced', message: 'A new local runner was paired during this task. Review the record before retrying.' });
          run.updatedAt = new Date().toISOString();
        }
      }
      data.workers = data.workers.filter((item) => item.ownerId !== ownerId);
      data.workers.push(worker);
      return worker;
    });
  }

  setWorkerTargets(tokenHash, targets) {
    return this.#mutate((data) => {
      const worker = data.workers.find((item) => item.tokenHash === tokenHash);
      if (!worker) throw new Error('Runner token is invalid or has been replaced.');
      worker.targets = targets.slice(0, 20).map((target) => ({ id: String(target.id ?? '').slice(0, 80), name: String(target.name ?? '').slice(0, 100), kind: String(target.kind ?? 'local').slice(0, 20), ready: Boolean(target.ready), requirements: String(target.requirements ?? '').slice(0, 500) }));
      worker.lastSeenAt = new Date().toISOString();
      return worker.targets;
    });
  }

  async workerTargets(ownerId) {
    await this.#queue;
    const worker = (await this.#read()).workers.find((item) => item.ownerId === ownerId);
    return worker?.targets ?? [];
  }

  async workerByTokenHash(tokenHash) {
    await this.#queue;
    return (await this.#read()).workers.find((item) => item.tokenHash === tokenHash) ?? null;
  }

  async workerStatus(ownerId) {
    return this.#mutate((data) => {
      const worker = data.workers.find((item) => item.ownerId === ownerId);
      const lastSeenMs = worker ? Date.parse(worker.lastSeenAt) : 0;
      const connected = Boolean(worker && Date.now() - lastSeenMs < 45_000);
      if (worker && !connected && worker.busyRunId) {
        const run = data.runs.find((item) => item.id === worker.busyRunId && item.ownerId === worker.ownerId);
        if (run && ['queued', 'verifying', 'repairing'].includes(run.state)) {
          run.state = run.workerAction === 'repair' ? 'agent_error' : 'setup_error';
          run.events.push({ at: new Date().toISOString(), type: 'worker_lost', message: 'The paired local runner disconnected during this task. Review the record before retrying.' });
          run.updatedAt = new Date().toISOString();
        }
        worker.busyRunId = null;
      }
      return { connected, lastSeenAt: worker?.lastSeenAt ?? null, busy: Boolean(worker?.busyRunId) };
    });
  }

  removeWorker(tokenHash) {
    return this.#mutate((data) => {
      const worker = data.workers.find((item) => item.tokenHash === tokenHash);
      if (!worker) return false;
      if (worker.busyRunId) {
        const run = data.runs.find((item) => item.id === worker.busyRunId && item.ownerId === worker.ownerId);
        if (run && ['queued', 'verifying', 'repairing'].includes(run.state)) {
          run.state = run.workerAction === 'repair' ? 'agent_error' : 'setup_error';
          run.events.push({ at: new Date().toISOString(), type: 'worker_disconnected', message: 'The paired local runner disconnected during this task. Review the record before retrying.' });
          run.updatedAt = new Date().toISOString();
        }
      }
      data.workers = data.workers.filter((item) => item.tokenHash !== tokenHash);
      return true;
    });
  }

  claimWorkerRun(tokenHash) {
    return this.#mutate((data) => {
      const worker = data.workers.find((item) => item.tokenHash === tokenHash);
      if (!worker) return null;
      const now = new Date();
      const previousSeenAt = Date.parse(worker.lastSeenAt);
      worker.lastSeenAt = now.toISOString();
      if (worker.busyRunId) {
        if (now.getTime() - previousSeenAt < 45_000) return null;
        const abandoned = data.runs.find((item) => item.id === worker.busyRunId && item.ownerId === worker.ownerId);
        if (abandoned && ['queued', 'verifying', 'repairing'].includes(abandoned.state)) {
          abandoned.state = abandoned.workerAction === 'repair' ? 'agent_error' : 'setup_error';
          abandoned.events.push({ at: now.toISOString(), type: 'worker_lost', message: 'The paired local runner disconnected during this task. Review the record before retrying.' });
          abandoned.updatedAt = now.toISOString();
        }
        worker.busyRunId = null;
      }
      const run = data.runs.find((item) => item.ownerId === worker.ownerId && item.state === 'queued' && ['verify', 'repair'].includes(item.workerAction));
      if (!run) return null;
      worker.busyRunId = run.id;
      run.events.push({ at: new Date().toISOString(), type: 'worker_claimed', message: 'The paired local runner accepted this task.' });
      run.updatedAt = new Date().toISOString();
      return structuredClone(run);
    });
  }

  reportWorkerRun(tokenHash, snapshot) {
    return this.#mutate((data) => {
      const worker = data.workers.find((item) => item.tokenHash === tokenHash);
      if (!worker || worker.busyRunId !== snapshot.id) throw new Error('This runner is not assigned to that task.');
      const run = data.runs.find((item) => item.id === snapshot.id && item.ownerId === worker.ownerId);
      if (!run) throw new Error('Task not found for this runner.');
      for (const key of ['task', 'objective', 'objectiveHash', 'ownerId', 'targetId']) {
        const savedValue = key === 'targetId' ? (run.targetId ?? 'bundled-demo') : run[key];
        const reportedValue = key === 'targetId' ? (snapshot.targetId ?? 'bundled-demo') : snapshot[key];
        if (reportedValue !== savedValue) throw new Error('The runner report changed immutable task ownership, target selection, or acceptance criteria.');
      }
      const allowedStates = new Set(['queued', 'verifying', 'repairing', 'needs_review', 'agent_error', 'unresolved', 'inconclusive', 'setup_error', 'verified']);
      if (!allowedStates.has(snapshot.state) || !Array.isArray(snapshot.events) || !Array.isArray(snapshot.attempts)) throw new Error('The runner report is malformed.');
      run.state = snapshot.state;
      run.repairCount = Math.min(2, Math.max(0, Number.isInteger(snapshot.repairCount) ? snapshot.repairCount : run.repairCount));
      run.events = snapshot.events.slice(-500).map((item) => ({ at: String(item.at ?? '').slice(0, 40), type: String(item.type ?? '').slice(0, 80), message: String(item.message ?? '').slice(0, 2000) }));
      run.attempts = snapshot.attempts.slice(-20).map((attempt) => ({
        id: String(attempt.id ?? '').slice(0, 100),
        kind: ['kane', 'agent'].includes(attempt.kind) ? attempt.kind : 'unknown',
        startedAt: String(attempt.startedAt ?? '').slice(0, 40),
        completedAt: String(attempt.completedAt ?? '').slice(0, 40),
        objectiveHash: typeof attempt.objectiveHash === 'string' ? attempt.objectiveHash.slice(0, 128) : undefined,
        exitCode: Number.isInteger(attempt.exitCode) ? attempt.exitCode : null,
        timedOut: Boolean(attempt.timedOut),
        overflow: Boolean(attempt.overflow),
        timeoutSeconds: Number.isInteger(attempt.timeoutSeconds) ? attempt.timeoutSeconds : undefined,
        verdict: typeof attempt.verdict === 'string' ? attempt.verdict.slice(0, 40) : undefined,
        finalEvent: typeof attempt.finalEvent === 'string' ? attempt.finalEvent.slice(0, 8000) : null,
        outputTail: typeof attempt.outputTail === 'string' ? attempt.outputTail.slice(-10000) : '',
        resultCode: Number.isInteger(attempt.resultCode) ? attempt.resultCode : null,
        reasonCode: typeof attempt.reasonCode === 'string' ? attempt.reasonCode.slice(0, 120) : undefined,
        eventCount: Number.isInteger(attempt.eventCount) ? attempt.eventCount : undefined,
        malformedCount: Number.isInteger(attempt.malformedCount) ? attempt.malformedCount : undefined,
        repeatability: typeof attempt.repeatability === 'string' ? attempt.repeatability.slice(0, 80) : undefined,
        changed: Boolean(attempt.changed),
        diffHash: typeof attempt.diffHash === 'string' ? attempt.diffHash.slice(0, 128) : null,
      }));
      run.diffStat = String(snapshot.diffStat ?? '').slice(0, 2000);
      run.lastDiff = String(snapshot.lastDiff ?? '').slice(0, 1_400_000);
      run.baseCommit = typeof snapshot.baseCommit === 'string' ? snapshot.baseCommit.slice(0, 80) : run.baseCommit;
      run.targetMode = typeof snapshot.targetMode === 'string' ? snapshot.targetMode.slice(0, 120) : run.targetMode;
      run.worktree = null;
      run.currentUrl = null;
      run.updatedAt = new Date().toISOString();
      worker.lastSeenAt = run.updatedAt;
      if (!['queued', 'verifying', 'repairing'].includes(run.state)) worker.busyRunId = null;
      return structuredClone(run);
    });
  }

  importWorkerRun(snapshot, action) {
    return this.#mutate((data) => {
      let current = data.runs.find((item) => item.id === snapshot.id);
      if (!current) {
        current = structuredClone(snapshot);
        current.state = action === 'repair' ? (snapshot.workerFromState ?? 'needs_review') : 'queued';
        current.workerAction = undefined;
        current.workerFromState = undefined;
        current.worktree = null;
        current.currentUrl = null;
        data.runs.unshift(current);
        return current;
      }
      for (const key of ['task', 'objective', 'objectiveHash', 'targetId']) {
        if (current[key] !== snapshot[key]) throw new Error('Task integrity check failed while syncing with the hosted queue.');
      }
      const localPaths = { worktree: current.worktree, baseCommit: current.baseCommit, targetMode: current.targetMode };
      const merged = { ...current, ...structuredClone(snapshot), ...localPaths };
      merged.ownerId = snapshot.ownerId;
      merged.state = action === 'repair' ? (snapshot.workerFromState ?? 'needs_review') : (snapshot.state === 'queued' ? 'queued' : snapshot.state);
      merged.workerAction = undefined;
      merged.workerFromState = undefined;
      merged.currentUrl = null;
      data.runs[data.runs.indexOf(current)] = merged;
      return merged;
    });
  }
}
