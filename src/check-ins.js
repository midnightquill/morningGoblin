import { getPreviousDateKey, getDateKeyDifference } from "./dates.js";

function createDailyState(dateKey, checkIns = {}) {
  return { dateKey, checkIns, reminderSent: false, recapSent: false, randomOffenderSent: false,
    microQuestPrompt: null, nudgedUsers: {} };
}

export function createCheckInService(points) {
  function ensureLedger(guildState, dateKey) {
    if (!guildState.checkInLedger) {
      const daily = guildState.daily;
      const baselineRecords = structuredClone(guildState.records ?? { best: null, worst: null });
      // Old noon snapshots are provisional; use the actual completed day instead.
      for (const type of ["best", "worst"]) {
        if (baselineRecords[type]?.dateKey === daily?.dateKey) baselineRecords[type] = null;
      }
      guildState.checkInLedger = {
        version: 1, startedAt: new Date().toISOString(), startDateKey: dateKey,
        entries: {}, completedDays: {}, baselineRecords,
        streakBaseline: structuredClone(guildState.streaks?.users ?? {}),
        hasLegacyHistory: Object.keys(guildState.points?.lifetime ?? {}).length > 0,
      };
      const ledger = guildState.checkInLedger;
      for (const [day, users] of Object.entries(guildState.catchupLoggedCheckIns ?? {})) {
        ledger.entries[day] = structuredClone(users);
      }
      if (daily?.dateKey) {
        ledger.entries[daily.dateKey] = { ...ledger.entries[daily.dateKey], ...structuredClone(daily.checkIns ?? {}) };
      }
    }
    return guildState.checkInLedger;
  }

  function updateCompletedRecords(guildState) {
    const ledger = guildState.checkInLedger;
    const records = structuredClone(ledger.baselineRecords);
    for (const [dateKey, day] of Object.entries(ledger.completedDays).sort()) {
      if (!records.best || day.count > records.best.count) {
        records.best = { count: day.count, dateKey, userIds: day.userIds };
      }
      if (!records.worst || day.count < records.worst.count) {
        records.worst = { count: day.count, dateKey };
      }
    }
    guildState.records = records;
  }

  function ensureDailyState(guildState, dateKey) {
    const ledger = ensureLedger(guildState, dateKey);
    points.ensurePointsState(guildState, dateKey);
    if (guildState.daily && guildState.daily.dateKey < dateKey) {
      const old = guildState.daily;
      ledger.entries[old.dateKey] = { ...ledger.entries[old.dateKey], ...old.checkIns };
      const userIds = Object.keys(ledger.entries[old.dateKey]);
      ledger.completedDays[old.dateKey] = { count: userIds.length, userIds };
      updateCompletedRecords(guildState);
      guildState.daily = null;
    }
    if (!guildState.daily) {
      points.advancePointPeriods(guildState, dateKey);
      ledger.entries[dateKey] ??= {};
      guildState.daily = createDailyState(dateKey, ledger.entries[dateKey]);
    } else {
      // Reconnect loaded JSON references to the canonical ledger.
      ledger.entries[guildState.daily.dateKey] ??= guildState.daily.checkIns;
      guildState.daily.checkIns = ledger.entries[guildState.daily.dateKey];
    }
    return guildState.daily;
  }

  function repairStreak(guildState, userId) {
    const ledger = guildState.checkInLedger;
    const baseline = ledger.streakBaseline[userId];
    const days = new Set(Object.keys(ledger.entries).filter((date) => ledger.entries[date][userId]));
    // Preserve the pre-upgrade run; earlier missing check-in history is unknown.
    if (baseline?.lastDateKey) {
      let date = baseline.lastDateKey;
      for (let i = 0; i < Math.min(baseline.current ?? 0, 10000); i++) {
        days.add(date);
        date = getPreviousDateKey(date);
      }
    }
    let current = 0;
    let best = baseline?.best ?? 0;
    let previous = null;
    for (const day of [...days].sort()) {
      current = previous === getPreviousDateKey(day) ? current + 1 : 1;
      best = Math.max(best, current);
      previous = day;
    }
    guildState.streaks ??= { users: {} };
    guildState.streaks.users ??= {};
    guildState.streaks.users[userId] = { current, best, lastDateKey: previous };
    return guildState.streaks.users[userId];
  }

  function recordCheckIn(guildState, dateKey, userId, entry, { activeDateKey = dateKey, award = true } = {}) {
    const dailyState = ensureDailyState(guildState, activeDateKey);
    const ledger = guildState.checkInLedger;
    const entries = ledger.entries[dateKey] ??= {};
    const alreadyCheckedIn = Boolean(entries[userId]);
    let streakEvent = null;
    if (!alreadyCheckedIn) {
      const previous = guildState.streaks?.users?.[userId];
      entries[userId] = { ...entry, bonusPoints: 0 };
      if (award && (!guildState.pointsResetAt || entry.timestamp >= guildState.pointsResetAt)) {
        points.awardPoint(guildState, userId, dateKey);
      }
      const streak = repairStreak(guildState, userId);
      const gapDays = previous?.lastDateKey ? getDateKeyDifference(previous.lastDateKey, dateKey) : null;
      const type = streak.current === 7 ? "sevenDay" : streak.current === 3 ? "threeDay"
        : gapDays > 1 ? "comeback" : null;
      streakEvent = { ...streak, type, gapDays, previous: previous?.current ?? 0 };
      if (dateKey < dailyState.dateKey) {
        if (ledger.completedDays[dateKey]) {
          const day = ledger.completedDays[dateKey];
          if (!day.userIds.includes(userId)) { day.userIds.push(userId); day.count += 1; }
        } else if (dateKey >= ledger.startDateKey) {
          const userIds = Object.keys(entries);
          ledger.completedDays[dateKey] = { count: userIds.length, userIds };
        }
        updateCompletedRecords(guildState);
      }
    }
    if (dateKey === dailyState.dateKey) delete dailyState.nudgedUsers[userId];
    return { dailyState, entry: entries[userId], alreadyCheckedIn, streakEvent,
      totalCheckIns: Object.keys(entries).length,
      pointsAwarded: !alreadyCheckedIn && award && (!guildState.pointsResetAt || entry.timestamp >= guildState.pointsResetAt) ? 1 : 0 };
  }

  function getCheckInStats(guildState, userId, todayKey) {
    const ledger = ensureLedger(guildState, todayKey);
    const entries = Object.entries(ledger.entries).filter(([, users]) => users[userId]);
    const last = entries.sort(([a], [b]) => b.localeCompare(a))[0];
    const streak = guildState.streaks?.users?.[userId] ?? { current: 0, best: 0 };
    const current = streak.lastDateKey === todayKey || streak.lastDateKey === getPreviousDateKey(todayKey) ? streak.current : 0;
    return { checkIns: entries.length, bonusPoints: entries.reduce((sum, [, users]) => sum + (users[userId].bonusPoints ?? 0), 0),
      current, best: streak.best, lastDateKey: last?.[0] ?? null, lastEntry: last?.[1]?.[userId] ?? null,
      partialHistory: ledger.hasLegacyHistory };
  }

  return { ensureLedger, ensureDailyState, recordCheckIn, repairStreak, getCheckInStats };
}
