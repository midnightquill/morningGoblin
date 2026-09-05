export class KeyedWorkQueue {
  constructor() { this.pending = new Map(); }

  run(key, work) {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(work).finally(() => {
      if (this.pending.get(key) === current) this.pending.delete(key);
    });
    this.pending.set(key, current);
    return current;
  }

  async drain() { await Promise.allSettled([...this.pending.values()]); }
}
