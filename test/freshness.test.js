import assert from "node:assert/strict";
import test from "node:test";
import { pickSurrealReply } from "../src/flavor.js";
import { ensureDailyDilemma, prepareRecapDilemma, postDailyDilemma } from "../src/dilemmas.js";
import { createCheckInService } from "../src/check-ins.js";
import { createPointsRules } from "../src/points.js";

const first = (_key, items) => items[0];
const config = { enabled: true, recapChance: 0.4, prompts: [
  { question: "Who gets the keys?", optionA: "A goose", optionB: "A suspicious toaster" },
  { question: "Which snack?", optionA: "Toast", optionB: "A biscuit" },
] };

function fixture() {
  const dailyState = {};
  const sent = [];
  const reactions = [];
  let snapshot;
  const options = { dailyState, config, pick: first, guildId: "guild", channelId: "channel",
    save: async () => { snapshot = JSON.stringify(dailyState); },
    send: async content => {
      sent.push(content);
      return { id: String(sent.length), react: async emoji => { reactions.push(emoji); } };
    },
  };
  return { options, sent, reactions, get snapshot() { return snapshot; } };
}

test("surreal replies respect probability and a saved server cooldown", () => {
  const surreal = { chance: 0.035, cooldownMinutes: 30, lines: ["THE ORB HAS REQUESTED A CASUAL DRESS CODE."] };
  assert.equal(pickSurrealReply(surreal, {}, first, { random: () => 0.5 }), null);
  assert.equal(pickSurrealReply(surreal, {}, first, { random: () => 0 }), surreal.lines[0]);
  const restored = JSON.parse(JSON.stringify({ lastSurrealReplyAt: 1000 }));
  assert.equal(pickSurrealReply(surreal, restored, first, { now: 1001, random: () => 0 }), null);
  assert.equal(pickSurrealReply(surreal, restored, first, { now: 1_801_000, random: () => 0 }), surreal.lines[0]);
  assert.equal(pickSurrealReply({ ...surreal, chance: 0 }, {}, first, { random: () => 0 }), null);
});

test("one daily ballot survives restart and later requests link to the original", async () => {
  const f = fixture();
  await postDailyDilemma(f.options);
  assert.match(f.sent[0], /Break-room Referendum/);
  assert.deepEqual(f.reactions, ["🅰️", "🅱️"]);
  await postDailyDilemma({ ...f.options, dailyState: JSON.parse(f.snapshot), channelId: "other-channel" });
  assert.match(f.sent[1], /https:\/\/discord.com\/channels\/guild\/channel\/1$/);
  assert.equal(f.reactions.length, 2);
});

test("a blocked ballot send keeps its question without recording a nonexistent post", async () => {
  const f = fixture();
  await postDailyDilemma({ ...f.options, send: async () => null });
  const restored = JSON.parse(f.snapshot);
  assert.equal(restored.dilemma.messageId, null);
  await postDailyDilemma({ ...f.options, dailyState: restored, pick: (_key, items) => items[1] });
  assert.match(f.sent[0], /Who gets the keys/);
});

test("a failed initial save prevents a ballot from being sent", async () => {
  const f = fixture();
  await assert.rejects(postDailyDilemma({ ...f.options, save: async () => { throw new Error("disk full"); } }), /disk full/);
  assert.equal(f.sent.length, 0);
});

test("missing reaction permission does not lose the original ballot", async () => {
  const f = fixture();
  await postDailyDilemma({ ...f.options, send: async () => ({ id: "saved", react: async () => { throw new Error("missing permission"); } }) });
  const restored = JSON.parse(f.snapshot);
  assert.equal(restored.dilemma.messageId, "saved");
  await postDailyDilemma({ ...f.options, dailyState: restored });
  assert.match(f.sent[0], /\/saved$/);
});

test("recap eligibility is decided once and cannot reroll on retry or restart", () => {
  const dailyState = {};
  assert.equal(prepareRecapDilemma(dailyState, config, first, () => 0.9), null);
  assert.equal(prepareRecapDilemma(JSON.parse(JSON.stringify(dailyState)), config, first, () => 0), null);
  const chosen = {};
  const question = prepareRecapDilemma(chosen, config, first, () => 0);
  assert.equal(prepareRecapDilemma(chosen, config, () => config.prompts[1], () => 0.9), question);
});

test("a manually opened ballot is not duplicated by the noon recap", async () => {
  const f = fixture();
  await postDailyDilemma(f.options);
  assert.equal(prepareRecapDilemma(f.options.dailyState, config, first, () => 0), null);
});

test("day rollover opens a fresh ballot while retaining scores", () => {
  const guild = {};
  const service = createCheckInService(createPointsRules());
  const dayOne = service.ensureDailyState(guild, "2026-10-24");
  ensureDailyDilemma(dayOne, config, first).messageId = "yesterday";
  const points = structuredClone(guild.points);
  const dayTwo = service.ensureDailyState(guild, "2026-10-25");
  assert.equal(dayTwo.dilemma, undefined);
  assert.equal(ensureDailyDilemma(dayTwo, config, first).messageId, null);
  assert.deepEqual(guild.points, points);
});

test("disabled or empty dilemma banks do not create daily state", () => {
  const dailyState = {};
  assert.equal(ensureDailyDilemma(dailyState, { ...config, enabled: false }, first), null);
  assert.equal(prepareRecapDilemma(dailyState, { ...config, prompts: [] }, first, () => 0), null);
  assert.deepEqual(dailyState, {});
});
