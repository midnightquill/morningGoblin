import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { JsonStore } from "../src/storage.js";

async function withTempStore(run) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "morning-goblin-store-"));

  try {
    await run(new JsonStore({ dataDir }), dataDir);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

test("load creates a new state file with defaults", async () => {
  await withTempStore(async (store, dataDir) => {
    const state = await store.load();

    assert.deepEqual(state, { guilds: {}, botPresence: null });
    assert.deepEqual(
      JSON.parse(await readFile(path.join(dataDir, "state.json"), "utf8")),
      state,
    );
  });
});

test("load preserves extra state while restoring required defaults", async () => {
  await withTempStore(async (store, dataDir) => {
    await writeFile(
      path.join(dataDir, "state.json"),
      JSON.stringify({ streamTracker: { lastStreamDateKey: "2026-07-01" } }),
      "utf8",
    );

    assert.deepEqual(await store.load(), {
      guilds: {},
      botPresence: null,
      streamTracker: { lastStreamDateKey: "2026-07-01" },
    });
  });
});

test("concurrent saves persist the newest state", async () => {
  await withTempStore(async (store, dataDir) => {
    await store.load();

    store.state.guilds.first = { enabled: true };
    const firstSave = store.save();
    store.state.guilds.second = { enabled: true };
    const secondSave = store.save();

    await Promise.all([firstSave, secondSave]);

    const saved = JSON.parse(await readFile(path.join(dataDir, "state.json"), "utf8"));
    assert.deepEqual(saved.guilds, {
      first: { enabled: true },
      second: { enabled: true },
    });
  });
});

test("a failed write does not poison later saves", async () => {
  await withTempStore(async (store, dataDir) => {
    await store.load();

    store.statePath = dataDir;
    await assert.rejects(store.save());

    store.statePath = path.join(dataDir, "state.json");
    store.state.guilds.recovered = { enabled: true };
    await store.save();

    const saved = JSON.parse(await readFile(store.statePath, "utf8"));
    assert.deepEqual(saved.guilds.recovered, { enabled: true });
  });
});
