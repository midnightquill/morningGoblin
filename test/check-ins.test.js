import assert from "node:assert/strict";
import test from "node:test";
import { createCheckInService } from "../src/check-ins.js";
import { createPointsRules } from "../src/points.js";
import { getZonedParts } from "../src/dates.js";
import { createCommandHandler } from "../src/commands.js";

function setup(guild = {}) {
  const points = createPointsRules();
  const service = createCheckInService(points);
  return { guild, points, ...service };
}
const entry = (day, id = "first") => ({ timestamp: Date.parse(`${day}T15:00:00Z`), messageId: id, displayName: "Goblin fan" });

test("off preserves daily filing, first timestamp, and one point per day", async () => {
  const { guild, recordCheckIn } = setup();
  recordCheckIn(guild, "2026-09-05", "user", entry("2026-09-05"));
  const commands = createCommandHandler({ getMorningConfig: () => ({}), COMMAND_PREFIX: "!gm", ensureGuildState: () => guild,
    hasManageGuild: () => true, safeReply: async () => {}, store: { save: async () => {} } });
  await commands({ content: "!gm off", guild: { id: "g" } });
  assert.equal(guild.morningChannelId, null);
  const duplicate = recordCheckIn(guild, "2026-09-05", "user", entry("2026-09-05", "second"));
  assert.equal(duplicate.alreadyCheckedIn, true);
  assert.equal(guild.points.lifetime.user, 1);
  assert.equal(guild.daily.checkIns.user.messageId, "first");
});

test("midnight-delayed check-in uses its source date without rolling current state backward", () => {
  const { guild, recordCheckIn, ensureDailyState } = setup();
  ensureDailyState(guild, "2026-09-07");
  const timestamp = Date.parse("2026-09-07T06:59:59Z");
  const dateKey = getZonedParts(new Date(timestamp), "America/Phoenix").dateKey;
  recordCheckIn(guild, dateKey, "user", { timestamp }, { activeDateKey: "2026-09-07" });
  assert.equal(dateKey, "2026-09-06");
  assert.equal(guild.daily.dateKey, "2026-09-07");
  assert.equal(guild.daily.checkIns.user, undefined);
  assert.equal(guild.points.periods.week.key, "2026-09-07");
  assert.equal(guild.points.periods.week.scores.user, undefined);
  assert.equal(guild.points.lifetime.user, 1);
});

test("only the completed total becomes a worst-day record", () => {
  const { guild, recordCheckIn, ensureDailyState } = setup({ records: { best: { count: 8, dateKey: "2026-08-01" }, worst: { count: 3, dateKey: "2026-08-02" } } });
  for (const user of ["a", "b"]) recordCheckIn(guild, "2026-09-05", user, entry("2026-09-05"));
  assert.equal(guild.records.worst.count, 3);
  for (const user of ["c", "d"]) recordCheckIn(guild, "2026-09-05", user, entry("2026-09-05"));
  ensureDailyState(guild, "2026-09-06");
  assert.equal(guild.records.worst.count, 3);
  assert.equal(guild.checkInLedger.completedDays["2026-09-05"].count, 4);
});

test("legacy noon records are replaced by the actual completed count", () => {
  const { guild, ensureDailyState } = setup({ records: { best: { count: 8, dateKey: "old" }, worst: { count: 2, dateKey: "2026-09-05" } },
    daily: { dateKey: "2026-09-05", checkIns: { a: {}, b: {}, c: {}, d: {} }, nudgedUsers: {} } });
  ensureDailyState(guild, "2026-09-06");
  assert.equal(guild.records.worst.count, 4);
});

test("backfills repair a broken streak and cannot double-award after reload", () => {
  const { guild, recordCheckIn, getCheckInStats } = setup();
  recordCheckIn(guild, "2026-09-01", "user", entry("2026-09-01"));
  recordCheckIn(guild, "2026-09-03", "user", entry("2026-09-03"));
  recordCheckIn(guild, "2026-09-02", "user", entry("2026-09-02"), { activeDateKey: "2026-09-03" });
  assert.equal(getCheckInStats(guild, "user", "2026-09-03").current, 3);
  const reloaded = setup(JSON.parse(JSON.stringify(guild)));
  reloaded.recordCheckIn(reloaded.guild, "2026-09-02", "user", entry("2026-09-02"), { activeDateKey: "2026-09-03" });
  assert.equal(reloaded.guild.points.lifetime.user, 3);
  assert.equal(reloaded.getCheckInStats(reloaded.guild, "user", "2026-09-05").current, 0);
});

test("existing points and streaks migrate without extra awards", () => {
  const points = createPointsRules();
  const guild = { points: points.createPointsState("2026-09-05"), daily: { dateKey: "2026-09-05", checkIns: { user: entry("2026-09-05") }, nudgedUsers: {} },
    streaks: { users: { user: { current: 9, best: 12, lastDateKey: "2026-09-05" } } } };
  guild.points.lifetime.user = 50;
  const { recordCheckIn, getCheckInStats } = createCheckInService(points);
  recordCheckIn(guild, "2026-09-05", "user", entry("2026-09-05"));
  assert.equal(guild.points.lifetime.user, 50);
  recordCheckIn(guild, "2026-09-06", "user", entry("2026-09-06"));
  assert.equal(getCheckInStats(guild, "user", "2026-09-06").current, 10);
});

test("historical recovery cannot rewrite a finalized champion bucket or undo a season reset", () => {
  const { guild, recordCheckIn, points } = setup();
  recordCheckIn(guild, "2026-09-06", "winner", entry("2026-09-06"));
  points.finalizeDuePointPeriods(guild, "2026-09-06");
  recordCheckIn(guild, "2026-09-06", "late", entry("2026-09-06"));
  assert.equal(guild.points.periods.week.scores.late, undefined);
  guild.points = points.createPointsState("2026-09-06");
  guild.pointsResetAt = Date.parse("2026-09-06T17:00:00Z");
  recordCheckIn(guild, "2026-09-05", "old", entry("2026-09-05"), { activeDateKey: "2026-09-06" });
  assert.equal(guild.points.lifetime.old, undefined);
});
