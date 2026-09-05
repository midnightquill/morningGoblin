import assert from "node:assert/strict";
import test from "node:test";
import { MemberSnapshotCache } from "../src/member-cache.js";
import { KeyedWorkQueue } from "../src/work-queue.js";
import { followupBlock, joinMessageSections, fitMessage } from "../src/message-format.js";
import { isCalloutSuppressed, updatePreference } from "../src/preferences.js";

test("concurrent member requests share a fetch and reuse it until expiry", async () => {
  let now = 0;
  let fetches = 0;
  const cache = new MemberSnapshotCache({ now: () => now, ttlMs: 100 });
  const guild = { id: "g", members: { fetch: async () => { fetches++; return new Map([["human", { user: { bot: false } }], ["bot", { user: { bot: true } }]]); } } };
  const [first, second] = await Promise.all([cache.get(guild), cache.get(guild)]);
  assert.equal(fetches, 1);
  assert.equal(first.length, 1);
  assert.equal(first, second);
  await cache.get(guild);
  assert.equal(fetches, 1);
  now = 101;
  await cache.get(guild);
  assert.equal(fetches, 2);
});

test("a failing member fetch backs off", async () => {
  const cache = new MemberSnapshotCache();
  let attempts = 0;
  const guild = { id: "g", members: { fetch: async () => { attempts++; throw new Error("missing access"); } } };
  assert.equal(await cache.get(guild), null);
  assert.equal(await cache.get(guild), null);
  assert.equal(attempts, 1);
});

test("guild queue survives errors and drains accepted work in order", async () => {
  const queue = new KeyedWorkQueue();
  const order = [];
  const first = queue.run("g", async () => { order.push(1); throw new Error("failed"); });
  const second = queue.run("g", async () => { order.push(2); });
  await assert.rejects(first);
  await queue.drain();
  await second;
  assert.deepEqual(order, [1, 2]);
});

test("comeback follow-up is a labeled block separated from the normal reply", () => {
  assert.equal(joinMessageSections("this is now official enough to be annoying. (2 logged today.)",
    followupBlock("↩️ Welcome back", "re-entry approved. your morning file has been reopened with dramatic restraint.")),
  "this is now official enough to be annoying. (2 logged today.)\n\n**↩️ Welcome back**\n> re-entry approved. your morning file has been reopened with dramatic restraint.");
  assert.equal(fitMessage("a".repeat(2200)).length, 2000);
});

test("vacation suppresses callouts only until expiry", () => {
  const guild = {};
  assert.equal(updatePreference(guild, "user", "vacation", "7d", 0), true);
  assert.equal(isCalloutSuppressed(guild, "user", 1), true);
  assert.equal(isCalloutSuppressed(guild, "user", 8 * 86_400_000), false);
  assert.equal(updatePreference(guild, "user", "vacation", "999d"), false);
});
