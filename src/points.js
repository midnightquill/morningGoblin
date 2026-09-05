import { getPeriodKeys, getDueChampionPeriodTypes, getPeriodEndDateKey } from "./champion-periods.js";
export const POINTS_PER_CHECK_IN = 1;
export const PERIOD_TYPES = ["week", "month", "year"];
export const POINT_PERIOD_SCHEMA_VERSION = 2;
const PERIOD_HISTORY_LIMITS = { week: 16, month: 18, year: 10 };

export function createPointsRules({ pickWeeklyOfficeTitle = () => null } = {}) {
  function createEmptyPeriodBucket(key) {
    return {
      key,
      scores: {},
      finalized: false,
    };
  }

  function createPointsState(dateKey) {
    const periodKeys = getPeriodKeys(dateKey);
    return {
      periodSchemaVersion: POINT_PERIOD_SCHEMA_VERSION,
      lifetime: {},
      periods: {
        week: createEmptyPeriodBucket(periodKeys.week),
        month: createEmptyPeriodBucket(periodKeys.month),
        year: createEmptyPeriodBucket(periodKeys.year),
      },
      history: {
        week: [],
        month: [],
        year: [],
      },
      pendingAnnouncements: [],
    };
  }

  function ensurePointsState(guildState, dateKey) {
    const periodKeys = getPeriodKeys(dateKey);
    let justInitialized = false;
    if (!guildState.points || typeof guildState.points !== "object") {
      guildState.points = createPointsState(dateKey);
      justInitialized = true;
    }
    const pointsState = guildState.points;
    if (!pointsState.lifetime || typeof pointsState.lifetime !== "object") {
      pointsState.lifetime = {};
    }
    if (!pointsState.periods || typeof pointsState.periods !== "object") {
      pointsState.periods = {};
    }
    if (!pointsState.history || typeof pointsState.history !== "object") {
      pointsState.history = {};
    }
    if (!Array.isArray(pointsState.pendingAnnouncements)) {
      pointsState.pendingAnnouncements = [];
    }
    for (const periodType of PERIOD_TYPES) {
      if (!pointsState.periods[periodType] || typeof pointsState.periods[periodType] !== "object") {
        pointsState.periods[periodType] = createEmptyPeriodBucket(periodKeys[periodType]);
      }
      if (!pointsState.periods[periodType].key) {
        pointsState.periods[periodType].key = periodKeys[periodType];
      }
      if (!pointsState.periods[periodType].scores || typeof pointsState.periods[periodType].scores !== "object") {
        pointsState.periods[periodType].scores = {};
      }
      if (typeof pointsState.periods[periodType].finalized !== "boolean") {
        pointsState.periods[periodType].finalized = false;
      }
      if (!Array.isArray(pointsState.history[periodType])) {
        pointsState.history[periodType] = [];
      }
    }
    if (pointsState.periodSchemaVersion !== POINT_PERIOD_SCHEMA_VERSION) {
      const weekState = pointsState.periods.week;
      if (weekState.key !== periodKeys.week) {
        if (weekState.key < periodKeys.week) {
          const legacySundayUserIds = new Set([
            ...Object.keys(guildState.catchupLoggedCheckIns?.[weekState.key] ?? {}),
            ...(guildState.daily?.dateKey === weekState.key
              ? Object.keys(guildState.daily.checkIns ?? {})
              : []),
          ]);
          for (const userId of legacySundayUserIds) {
            const migratedScore = (weekState.scores[userId] ?? 0) - POINTS_PER_CHECK_IN;
            if (migratedScore > 0) {
              weekState.scores[userId] = migratedScore;
            } else {
              delete weekState.scores[userId];
            }
          }
        }
        weekState.key = periodKeys.week;
        weekState.finalized = false;
      }
      // Older versions released rollover announcements on later mornings. Retire
      // those queued posts instead of ever publishing a weekly/monthly result late.
      pointsState.pendingAnnouncements = [];
      pointsState.periodSchemaVersion = POINT_PERIOD_SCHEMA_VERSION;
    }
    if (justInitialized && guildState.daily?.dateKey === dateKey) {
      for (const userId of Object.keys(guildState.daily.checkIns ?? {})) {
        pointsState.lifetime[userId] = (pointsState.lifetime[userId] ?? 0) + POINTS_PER_CHECK_IN;
        for (const periodType of PERIOD_TYPES) {
          pointsState.periods[periodType].scores[userId] = (pointsState.periods[periodType].scores[userId] ?? 0) + POINTS_PER_CHECK_IN;
        }
      }
    }
    return pointsState;
  }

  function getSortedScoreEntries(scores) {
    return Object.entries(scores ?? {}).sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    });
  }

  function finalizePointPeriod(pointsState, periodType, periodState) {
    if (!periodState?.key || periodState.finalized) {
      return false;
    }
    periodState.finalized = true;
    const entries = getSortedScoreEntries(periodState.scores);
    if (entries.length === 0 || entries[0][1] <= 0) {
      return true;
    }
    const topScore = entries[0][1];
    const winnerUserIds = entries.filter(([, score]) => score === topScore).map(([userId]) => userId);
    const entry = {
      periodType,
      periodKey: periodState.key,
      announcementDateKey: getPeriodEndDateKey(periodType, periodState.key),
      winnerUserIds,
      points: topScore,
    };
    if (periodType === "week") {
      entry.officeTitle = pickWeeklyOfficeTitle();
    }
    const existingHistoryIndex = pointsState.history[periodType].findIndex(
      (savedEntry) => savedEntry.periodKey === entry.periodKey,
    );
    if (existingHistoryIndex >= 0) {
      pointsState.history[periodType][existingHistoryIndex] = entry;
    } else {
      pointsState.history[periodType].unshift(entry);
    }
    const historyLimit = PERIOD_HISTORY_LIMITS[periodType] ?? 12;
    if (pointsState.history[periodType].length > historyLimit) {
      pointsState.history[periodType].length = historyLimit;
    }
    const alreadyPending = pointsState.pendingAnnouncements.some(
      (pendingEntry) =>
        pendingEntry.periodType === entry.periodType &&
        pendingEntry.periodKey === entry.periodKey,
    );
    if (!alreadyPending) {
      pointsState.pendingAnnouncements.push(entry);
    }
    return true;
  }

  function advancePointPeriods(guildState, nextDateKey) {
    const pointsState = ensurePointsState(guildState, nextDateKey);
    const nextKeys = getPeriodKeys(nextDateKey);
    let changed = false;
    for (const periodType of PERIOD_TYPES) {
      const periodState = pointsState.periods[periodType];
      if (periodState.key < nextKeys[periodType]) {
        finalizePointPeriod(pointsState, periodType, periodState);
        pointsState.periods[periodType] = createEmptyPeriodBucket(nextKeys[periodType]);
        changed = true;
      }
    }
    return changed;
  }

  function finalizeDuePointPeriods(guildState, dateKey) {
    const pointsState = ensurePointsState(guildState, dateKey);
    const currentKeys = getPeriodKeys(dateKey);
    let changed = false;
    for (const periodType of getDueChampionPeriodTypes(dateKey)) {
      const periodState = pointsState.periods[periodType];
      if (periodState.key === currentKeys[periodType]) {
        changed = finalizePointPeriod(pointsState, periodType, periodState) || changed;
      }
    }
    return changed;
  }

  function awardPoint(guildState, userId, dateKey, amount = POINTS_PER_CHECK_IN) {
    const activeDateKey = guildState.daily?.dateKey > dateKey ? guildState.daily.dateKey : dateKey;
    const pointsState = ensurePointsState(guildState, activeDateKey);
    const keys = getPeriodKeys(dateKey);
    pointsState.lifetime[userId] = (pointsState.lifetime[userId] ?? 0) + amount;
    for (const periodType of PERIOD_TYPES) {
      const bucket = pointsState.periods[periodType];
      if (bucket.key === keys[periodType] && !bucket.finalized) {
        bucket.scores[userId] = (bucket.scores[userId] ?? 0) + amount;
      }
    }
  }
  return { createEmptyPeriodBucket, createPointsState, ensurePointsState, getSortedScoreEntries, finalizePointPeriod, advancePointPeriods, finalizeDuePointPeriods, awardPoint };
}
