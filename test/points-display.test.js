import assert from "node:assert/strict";
import test from "node:test";
import { createPointsPayload } from "../src/points-display.js";
import { createPointsRules } from "../src/points.js";

const { createPointsState, getSortedScoreEntries } = createPointsRules();
const display = (points, overrides = {}) => createPointsPayload({ points,
  resolveLabel: async (id) => id, sortEntries: getSortedScoreEntries,
  formatPeriodLabel: (_type, key) => key, timeZone: "America/Phoenix", ...overrides });

test("points card separates periods, sorts scores, and gives tied members the same rank", async () => {
  const points = createPointsState("2026-10-24");
  points.periods.week.scores = { fourth: 1, third: 4, jeff: 12, alice: 12 };
  points.lifetime = { jeff: 1234 };
  points.history.week.push({ periodType: "week", periodKey: "2026-10-12", winnerUserIds: ["alice", "jeff"],
    points: 8, officeTitle: "Director of Dawn Paperwork" });
  const original = structuredClone(points);
  const payload = await display(points);
  const fields = payload.embeds[0].fields;
  assert.match(fields[0].name, /This week.*2026-10-19/);
  assert.match(fields[1].name, /This month.*2026-10/);
  assert.match(fields[2].name, /This year.*2026/);
  assert.equal(fields[0].value, "🥇 **alice** — **12 points**\n🥇 **jeff** — **12 points**\n🥉 **third** — **4 points**\n\u200b");
  assert.match(fields[3].value, /1,234 points/);
  assert.match(fields[4].value, /alice, jeff.*8 points/);
  assert.match(fields[4].value, /Director of Dawn Paperwork/);
  assert.deepEqual(payload.allowedMentions, { repliedUser: false, parse: [] });
  assert.deepEqual(points, original);
});

test("empty points boards remain readable without inventing champions", async () => {
  const payload = await display(createPointsState("2026-10-24"));
  assert.equal(payload.embeds[0].fields.length, 4);
  for (const field of payload.embeds[0].fields) assert.match(field.value, /No points yet/);
});

test("Discord names cannot inject leaderboard lines, formatting, or mentions", async () => {
  const points = createPointsState("2026-10-24");
  points.lifetime = { jeff: 1 };
  const payload = await display(points, { resolveLabel: async () => "**Jeff**\n@everyone <@123>" });
  const value = payload.embeds[0].fields[3].value;
  assert.equal(value.split("\n").length, 1);
  assert.ok(value.includes("\\*\\*Jeff\\*\\*"));
  assert.ok(!value.includes("@everyone"));
  assert.ok(!value.includes("<@123>"));
  assert.match(value, /1 point\*\*$/);
});

test("large boards and co-champions fit Discord limits in embeds and text fallback", async () => {
  const points = createPointsState("2026-10-24");
  const scores = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`user${index}`, 1_000_000 - index]));
  points.lifetime = scores;
  for (const type of ["week", "month", "year"]) {
    points.periods[type].scores = scores;
    points.history[type].push({ periodType: type, periodKey: points.periods[type].key,
      winnerUserIds: Object.keys(scores), points: 1_000_000, officeTitle: "*".repeat(200) });
  }
  const options = { resolveLabel: async () => "*".repeat(32) };
  const rich = await display(points, options);
  const embed = rich.embeds[0];
  assert.equal(embed.fields.length, 7);
  for (const field of embed.fields) {
    assert.ok(field.name.length <= 256);
    assert.ok(field.value.length <= 1024);
  }
  assert.ok(embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, embed.footer.text.length) <= 6000);
  const text = await display(points, { ...options, useEmbeds: false });
  assert.ok(!text.embeds);
  assert.ok(text.content.length <= 2000);
  for (const field of embed.fields) assert.ok(text.content.includes(`### ${field.name}\n`));
});
