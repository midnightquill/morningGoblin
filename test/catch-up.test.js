import assert from "node:assert/strict";
import test from "node:test";
import { scanCheckIns, fetchRecentMessagesSince } from "../src/catch-up.js";
import { createPointsRules } from "../src/points.js";
import { createCheckInService } from "../src/check-ins.js";

function fixture() {
  let guildState = {};
  const service = createCheckInService(createPointsRules());
  const message = { id: "100", channelId: "channel", author: { id: "user", username: "user", bot: false },
    content: "gm", createdTimestamp: Date.parse("2026-09-05T15:00:00Z"), reactions: { cache: new Map() } };
  const channel = { messages: { fetch: async () => new Map([[message.id, message]]) } };
  const options = { channel, cutoffTimestamp: 0, activeDateKey: "2026-09-06", toDateKey: () => "2026-09-05",
    isGoodMorningMessage: () => true, isMorningSomewhereInUnitedStates: () => true, ...service, botUserId: "bot",
    save: async () => {}, react: async () => { message.reactions.cache.set("sun", { me: true }); return true; } };
  return { message, options, get state() { return guildState; }, set state(value) { guildState = value; },
    scan: (changes = {}) => scanCheckIns({ guildState, ...options, ...changes }) };
}

test("overlapping catch-up scans credit one user/day once", async () => {
  const f = fixture();
  await Promise.all([f.scan(), f.scan()]);
  assert.equal(f.state.points.lifetime.user, 1);
});

test("failed save cannot leave a reaction that hides an unsaved GM on restart", async () => {
  const f = fixture();
  await assert.rejects(f.scan({ save: async () => { throw new Error("disk full"); } }), /disk full/);
  assert.equal(f.message.reactions.cache.size, 0);
  f.state = {};
  await f.scan();
  assert.equal(f.state.points.lifetime.user, 1);
  assert.equal(f.message.reactions.cache.size, 1);
});

test("reaction failure leaves a saved check-in that a retry can react to", async () => {
  const f = fixture();
  let persisted;
  await f.scan({ save: async () => { persisted = JSON.stringify(f.state); }, react: async () => false });
  f.state = JSON.parse(persisted);
  await f.scan();
  assert.equal(f.state.points.lifetime.user, 1);
  assert.equal(f.message.reactions.cache.size, 1);
});

test("legacy reaction evidence imports history without awarding points again", async () => {
  const f = fixture();
  f.message.reactions.cache.set("sun", { me: true });
  const result = await f.scan();
  assert.equal(result.legacyImported, 1);
  assert.equal(f.state.points.lifetime.user, undefined);
  assert.ok(f.state.checkInLedger.entries["2026-09-05"].user);
});

test("post-upgrade reactions never replace the durable ledger as proof of a filing", async () => {
  const f = fixture();
  f.options.ensureLedger(f.state, "2026-09-06").startedAt = "2026-09-01T00:00:00Z";
  f.message.reactions.cache.set("sun", { me: true });
  await f.scan();
  assert.equal(f.state.points.lifetime.user, 1);
});

test("bounded recovery reports truncation and resumes with its oldest-message cursor", async () => {
  const messages = Array.from({ length: 105 }, (_, index) => ({ id: String(105 - index), createdTimestamp: 105 - index }));
  const channel = { messages: { fetch: async ({ before, limit }) => new Map(messages.filter((message) => !before || Number(message.id) < Number(before)).slice(0, limit).map((message) => [message.id, message])) } };
  const first = await fetchRecentMessagesSince(channel, 1, { maxMessages: 100 });
  assert.equal(first.truncated, true);
  const second = await fetchRecentMessagesSince(channel, 1, { before: first.before, maxMessages: 100 });
  assert.equal(second.truncated, false);
  assert.equal(first.messages.length + second.messages.length, 105);
});
