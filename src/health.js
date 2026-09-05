import path from "node:path";
import { writeAtomic } from "./storage.js";

export class BotHealth {
  constructor(dataDir) {
    this.path = path.join(dataDir, "heartbeat.json");
    this.startedAt = new Date().toISOString();
    this.lastSchedulerAt = null;
    this.lastMessageAt = null;
    this.lastError = null;
    this.scheduled = {};
    this.pending = null;
  }

  scheduledResult(name, result) {
    const counts = this.scheduled[name] ??= { sent: 0, skipped: 0, failed: 0 };
    counts[result] += 1;
  }

  error(context, error) {
    this.lastError = { context, message: error.message, at: new Date().toISOString() };
    console.error(context, error);
  }

  async write(client, store, { shuttingDown = false } = {}) {
    if (this.pending) return this.pending;
    const content = JSON.stringify({ pid: process.pid, startedAt: this.startedAt,
      updatedAt: new Date().toISOString(), ready: client.isReady(), shuttingDown,
      lastSchedulerAt: this.lastSchedulerAt, lastMessageAt: this.lastMessageAt,
      lastSuccessfulSaveAt: store.lastSuccessfulSaveAt, storageError: store.lastError,
      lastError: this.lastError, scheduled: this.scheduled }, null, 2);
    this.pending = writeAtomic(this.path, content).finally(() => { this.pending = null; });
    return this.pending;
  }
}
