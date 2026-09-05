const formatterCache = new Map();

export function getFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  }
  return formatterCache.get(timeZone);
}

export function getZonedParts(date, timeZone) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number.parseInt(values.hour, 10),
    minute: Number.parseInt(values.minute, 10),
  };
}

export function parseDateKey(dateKey) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

export function formatUtcDateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function getPreviousDateKey(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() - 1);
  return formatUtcDateKey(date);
}

export function getDateKeyDifference(fromDateKey, toDateKey) {
  const fromDate = parseDateKey(fromDateKey);
  const toDate = parseDateKey(toDateKey);
  if (!fromDate || !toDate) {
    return null;
  }
  return Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
}

const invalidTimeZones = new Set();

export function isValidTimeZoneName(timeZone) {

  if (!timeZone) {

    return false;

  }

  if (formatterCache.has(timeZone)) {
    return true;
  }

  if (invalidTimeZones.has(timeZone)) {
    return false;
  }

  try {

    getFormatter(timeZone).format(new Date());

    return true;

  } catch {

    invalidTimeZones.add(timeZone);
    return false;

  }

}
