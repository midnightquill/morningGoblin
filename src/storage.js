import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), "data");

function createEmptyState() {
  return {
    guilds: {},
    botPresence: null,
  };
}

export class JsonStore {
  constructor({ dataDir = DEFAULT_DATA_DIR } = {}) {
    this.dataDir = dataDir;
    this.statePath = path.join(dataDir, "state.json");
    this.state = createEmptyState();
    this.directoryReady = null;
    this.pendingSnapshot = null;
    this.flushPromise = null;
  }

  async ensureDataDirectory() {
    if (!this.directoryReady) {
      this.directoryReady = mkdir(this.dataDir, { recursive: true }).catch((error) => {
        this.directoryReady = null;
        throw error;
      });
    }

    return this.directoryReady;
  }

  async load() {
    await this.ensureDataDirectory();

    try {
      const raw = await readFile(this.statePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = {
        ...createEmptyState(),
        ...parsed,
        guilds: parsed?.guilds ?? {},
        botPresence: parsed?.botPresence ?? null,
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      this.state = createEmptyState();
      await this.save();
    }

    return this.state;
  }

  async save() {
    await this.ensureDataDirectory();
    this.pendingSnapshot = JSON.stringify(this.state, null, 2);

    if (!this.flushPromise) {
      this.flushPromise = this.flushPendingSnapshots();
    }

    return this.flushPromise;
  }

  async flushPendingSnapshots() {
    try {
      while (this.pendingSnapshot !== null) {
        const snapshot = this.pendingSnapshot;
        this.pendingSnapshot = null;
        await writeFile(this.statePath, snapshot, "utf8");
      }
    } finally {
      this.flushPromise = null;
    }
  }
}
