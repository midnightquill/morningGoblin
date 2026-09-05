export function getUserPreferences(guildState, userId) {
  return { quiet: false, callouts: true, vacationUntil: null, ...guildState.userPreferences?.[userId] };
}

export function isCalloutSuppressed(guildState, userId, now = Date.now()) {
  const preferences = getUserPreferences(guildState, userId);
  return !preferences.callouts || Date.parse(preferences.vacationUntil) > now;
}

export function suppressCheckInReply(guildState, userId) {
  return guildState.suppressedCheckInReplyUserIds.includes(userId) || getUserPreferences(guildState, userId).quiet;
}

export function updatePreference(guildState, userId, key, value, now = Date.now()) {
  const preferences = getUserPreferences(guildState, userId);
  if (["quiet", "callouts"].includes(key) && ["on", "off"].includes(value)) {
    preferences[key] = value === "on";
  } else if (key === "vacation" && value === "off") {
    preferences.vacationUntil = null;
  } else if (key === "vacation" && /^([1-9]|[12]\d|30)d?$/.test(value ?? "")) {
    preferences.vacationUntil = new Date(now + parseInt(value, 10) * 86_400_000).toISOString();
  } else return false;
  guildState.userPreferences ??= {};
  guildState.userPreferences[userId] = preferences;
  return true;
}
