import assert from "node:assert/strict";
import test from "node:test";

import {
  getDueChampionPeriodTypes,
  getPeriodEndDateKey,
  getPeriodKeys,
  getWeekKey,
  isChampionAnnouncementWindow,
} from "../src/champion-periods.js";

test("weeks run Monday through Sunday", () => {
  assert.equal(getWeekKey("2026-07-13"), "2026-07-13");
  assert.equal(getWeekKey("2026-07-19"), "2026-07-13");
  assert.equal(getWeekKey("2026-07-20"), "2026-07-20");
  assert.equal(getPeriodEndDateKey("week", "2026-07-13"), "2026-07-19");
});

test("period keys use their containing calendar period", () => {
  assert.deepEqual(getPeriodKeys("2026-07-19"), {
    week: "2026-07-13",
    month: "2026-07",
    year: "2026",
  });
  assert.equal(getPeriodEndDateKey("month", "2028-02"), "2028-02-29");
  assert.equal(getPeriodEndDateKey("year", "2026"), "2026-12-31");
});

test("weekly champions are due only Sunday and monthly champions only month-end", () => {
  assert.deepEqual(getDueChampionPeriodTypes("2026-07-19"), ["week"]);
  assert.deepEqual(getDueChampionPeriodTypes("2026-07-31"), ["month"]);
  assert.deepEqual(getDueChampionPeriodTypes("2026-05-31"), ["week", "month"]);
  assert.deepEqual(getDueChampionPeriodTypes("2026-12-31"), ["month", "year"]);
  assert.deepEqual(getDueChampionPeriodTypes("2026-07-15"), []);
});

test("champion announcements wait until the last five minutes of the local day", () => {
  assert.equal(isChampionAnnouncementWindow({ hour: 23, minute: 54 }), false);
  assert.equal(isChampionAnnouncementWindow({ hour: 23, minute: 55 }), true);
  assert.equal(isChampionAnnouncementWindow({ hour: 23, minute: 59 }), true);
});
