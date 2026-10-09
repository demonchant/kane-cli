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
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return { schema: 1, runs: [] };
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
}
