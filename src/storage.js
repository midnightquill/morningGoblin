import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), "data");
function createEmptyState() { return { guilds: {}, botPresence: null }; }

function parseState(raw) {
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      (parsed.guilds != null && (typeof parsed.guilds !== "object" || Array.isArray(parsed.guilds)))) {
    throw new Error("Invalid state file: expected a state object with a guilds object.");
  }
  return { ...createEmptyState(), ...parsed, guilds: parsed.guilds ?? {} };
}

// Same-directory replacement keeps readers from seeing partially written JSON.
export async function writeAtomic(filePath, content) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, filePath);
  } finally {
    await handle?.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
  }
}

export class JsonStore {
  constructor({ dataDir = DEFAULT_DATA_DIR } = {}) {
    this.dataDir = dataDir;
    this.statePath = path.join(dataDir, "state.json");
    this.backupPath = path.join(dataDir, "state.backup.json");
    this.state = createEmptyState();
    this.directoryReady = null;
    this.pendingSnapshot = null;
    this.flushPromise = null;
    this.committedSnapshot = null;
    this.lastSuccessfulSaveAt = null;
    this.lastError = null;
    this.recoveredFromBackup = false;
  }

  async ensureDataDirectory() {
    this.directoryReady ??= mkdir(this.dataDir, { recursive: true }).catch((error) => {
      this.directoryReady = null;
      throw error;
    });
    return this.directoryReady;
  }

  async load() {
    await this.ensureDataDirectory();
    try {
      this.state = parseState(await readFile(this.statePath, "utf8"));
    } catch (primaryError) {
      if (primaryError.code && primaryError.code !== "ENOENT") throw primaryError;
      try {
        this.state = parseState(await readFile(this.backupPath, "utf8"));
        this.recoveredFromBackup = true;
        console.warn("Recovered bot state from the last known-good backup.");
        await writeAtomic(this.statePath, JSON.stringify(this.state, null, 2));
      } catch (backupError) {
        if (primaryError.code !== "ENOENT" || backupError.code !== "ENOENT") {
          throw new AggregateError([primaryError, backupError], "State and backup could not be loaded; refusing to erase saved scores.");
        }
        this.state = createEmptyState();
        await this.save();
      }
    }
    this.committedSnapshot = JSON.stringify(this.state, null, 2);
    return this.state;
  }

  async save() {
    await this.ensureDataDirectory();
    this.pendingSnapshot = JSON.stringify(this.state, null, 2);
    if (!this.flushPromise) this.flushPromise = Promise.resolve().then(() => this.flushPendingSnapshots());
    return this.flushPromise;
  }

  async flushPendingSnapshots() {
    try {
      while (this.pendingSnapshot !== null) {
        const snapshot = this.pendingSnapshot;
        this.pendingSnapshot = null;
        if (snapshot !== this.committedSnapshot) {
          if (this.committedSnapshot !== null) await writeAtomic(this.backupPath, this.committedSnapshot);
          await writeAtomic(this.statePath, snapshot);
          this.committedSnapshot = snapshot;
        }
        this.lastSuccessfulSaveAt = new Date().toISOString();
        this.lastError = null;
      }
    } catch (error) {
      this.lastError = error.message;
      throw error;
    } finally {
      this.flushPromise = null;
    }
  }
}
