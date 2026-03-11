import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const STATE_PATH = path.join(DATA_DIR, "state.json");

function createEmptyState() {
  return {
    guilds: {},
    botPresence: null,
  };
}

export class JsonStore {
  constructor() {
    this.state = createEmptyState();
    this.writeQueue = Promise.resolve();
  }

  async load() {
    await mkdir(DATA_DIR, { recursive: true });

    try {
      const raw = await readFile(STATE_PATH, "utf8");
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
    await mkdir(DATA_DIR, { recursive: true });
    const snapshot = JSON.stringify(this.state, null, 2);

    this.writeQueue = this.writeQueue.then(() =>
      writeFile(STATE_PATH, snapshot, "utf8"),
    );

    return this.writeQueue;
  }
}
