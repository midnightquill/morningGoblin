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
    store.state.guilds.pending = { enabled: true };
    await assert.rejects(store.save());

    store.statePath = path.join(dataDir, "state.json");
    store.state.guilds.recovered = { enabled: true };
    await store.save();

    const saved = JSON.parse(await readFile(store.statePath, "utf8"));
    assert.deepEqual(saved.guilds.recovered, { enabled: true });
  });
});

test("an unchanged save does not prevent the next changed save", async () => {
  await withTempStore(async (store) => {
    await store.load();
    await store.save();
    store.state.guilds.next = {};
    await store.save();
    assert.ok(JSON.parse(await readFile(store.statePath, "utf8")).guilds.next);
  });
});

test("corrupt primary recovers the previous committed snapshot", async () => {
  await withTempStore(async (store, dataDir) => {
    await store.load();
    store.state.guilds.saved = { points: 7 };
    await store.save();
    store.state.guilds.saved.points = 8;
    await store.save();
    await writeFile(store.statePath, '{"guilds":');
    const recovered = new JsonStore({ dataDir });
    assert.equal((await recovered.load()).guilds.saved.points, 7);
    assert.equal(recovered.recoveredFromBackup, true);
    assert.equal(JSON.parse(await readFile(store.statePath, "utf8")).guilds.saved.points, 7);
  });
});

test("invalid state and backup fail without erasing either file", async () => {
  await withTempStore(async (store) => {
    await writeFile(store.statePath, '[]');
    await writeFile(store.backupPath, '{');
    await assert.rejects(store.load(), /refusing to erase/);
    assert.equal(await readFile(store.statePath, "utf8"), '[]');
  });
});
