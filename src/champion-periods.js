const CHAMPION_ANNOUNCEMENT_START_MINUTES = 23 * 60 + 55;

function parseDateKey(dateKey) {
  const match = dateKey?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function getWeekKey(dateKey) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return dateKey;
  }

  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return formatDateKey(date);
}

export function getMonthKey(dateKey) {
  return dateKey.slice(0, 7);
}

export function getYearKey(dateKey) {
  return dateKey.slice(0, 4);
}

export function getPeriodKey(periodType, dateKey) {
  switch (periodType) {
    case "week":
      return getWeekKey(dateKey);
    case "month":
      return getMonthKey(dateKey);
    case "year":
      return getYearKey(dateKey);
    default:
      return dateKey;
  }
}

export function getPeriodKeys(dateKey) {
  return {
    week: getWeekKey(dateKey),
    month: getMonthKey(dateKey),
    year: getYearKey(dateKey),
  };
}

export function getPeriodEndDateKey(periodType, periodKey) {
  switch (periodType) {
    case "week": {
      const date = parseDateKey(periodKey);

      if (!date) {
        return periodKey;
      }

      date.setUTCDate(date.getUTCDate() + 6);
      return formatDateKey(date);
    }

    case "month": {
      const match = periodKey?.match(/^(\d{4})-(\d{2})$/);

      if (!match) {
        return periodKey;
      }

      const year = Number.parseInt(match[1], 10);
      const month = Number.parseInt(match[2], 10);
      return formatDateKey(new Date(Date.UTC(year, month, 0)));
    }

    case "year":
      return /^\d{4}$/.test(periodKey) ? `${periodKey}-12-31` : periodKey;

    default:
      return periodKey;
  }
}

export function getDueChampionPeriodTypes(dateKey) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return [];
  }

  const due = [];

  if (date.getUTCDay() === 0) {
    due.push("week");
  }

  const tomorrow = new Date(date);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  if (tomorrow.getUTCMonth() !== date.getUTCMonth()) {
    due.push("month");
  }

  if (tomorrow.getUTCFullYear() !== date.getUTCFullYear()) {
    due.push("year");
  }

  return due;
}

export function isChampionAnnouncementWindow(zonedParts) {
  const minutes = zonedParts.hour * 60 + zonedParts.minute;
  return minutes >= CHAMPION_ANNOUNCEMENT_START_MINUTES;
}
