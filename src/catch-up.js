export async function fetchRecentMessagesSince(channel, cutoffTimestamp, { maxMessages = 5000, before: initialBefore } = {}) {
  const collected = [];
  let before = initialBefore;
  let reachedCutoff = false;
  while (collected.length < maxMessages) {
    const page = await channel.messages.fetch({ limit: Math.min(100, maxMessages - collected.length), ...(before ? { before } : {}) });
    const messages = [...page.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    if (!messages.length) { reachedCutoff = true; break; }
    collected.push(...messages);
    const oldest = messages.at(-1);
    before = oldest.id;
    if (oldest.createdTimestamp < cutoffTimestamp || page.size < 100) { reachedCutoff = true; break; }
  }
  return { messages: collected.filter((message) => message.createdTimestamp >= cutoffTimestamp),
    truncated: !reachedCutoff, before };
}

function hasBotReaction(message, botUserId) {
  // Discord's reaction.me already identifies our reaction; no per-emoji user fetches.
  return [...(message.reactions?.cache?.values() ?? [])].some((reaction) => reaction.me || reaction.users?.cache?.has(botUserId));
}

export async function scanCheckIns({ guildState, channel, cutoffTimestamp, activeDateKey, toDateKey,
  isGoodMorningMessage, isMorningSomewhereInUnitedStates, recordCheckIn, ensureLedger,
  save, react, botUserId, before, maxMessages }) {
  const ledger = ensureLedger(guildState, activeDateKey);
  const page = await fetchRecentMessagesSince(channel, cutoffTimestamp, { before, maxMessages });
  const messages = page.messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const botReplies = new Set(messages.filter((message) => message.author.id === botUserId)
    .map((message) => message.reference?.messageId).filter(Boolean));
  const candidates = messages.filter((message) => !message.author.bot && isGoodMorningMessage(message.content));
  const legacyProcessed = new Set();
  for (const message of candidates) {
    if (message.createdTimestamp < Date.parse(ledger.startedAt) &&
        (botReplies.has(message.id) || hasBotReaction(message, botUserId))) {
      legacyProcessed.add(`${toDateKey(message.createdTimestamp)}:${message.author.id}`);
    }
  }
  const stats = { scanned: messages.length, validMorningMessages: candidates.length, logged: 0, alreadyLogged: 0,
    outsideUsMorning: 0, failures: 0, legacyImported: 0, dates: new Set(), truncated: page.truncated, before: page.before };
  for (const message of candidates) {
    if (!isMorningSomewhereInUnitedStates(new Date(message.createdTimestamp))) { stats.outsideUsMorning++; continue; }
    const dateKey = toDateKey(message.createdTimestamp);
    const legacy = legacyProcessed.has(`${dateKey}:${message.author.id}`);
    const result = recordCheckIn(guildState, dateKey, message.author.id, {
      messageId: message.id, channelId: message.channelId, timestamp: message.createdTimestamp,
      displayName: message.member?.displayName || message.author.username,
      message: message.content, source: legacy ? "legacy" : "catchup",
    }, { activeDateKey, award: !legacy });
    // Persist even for an existing entry: it may be an in-memory retry of a failed save.
    await save();
    if (result.alreadyCheckedIn || legacy) {
      stats.alreadyLogged++;
      if (legacy && !result.alreadyCheckedIn) stats.legacyImported++;
    } else {
      stats.logged++;
      stats.dates.add(dateKey);
    }
    if (result.entry.messageId === message.id && !hasBotReaction(message, botUserId)) {
      if (!await react(message)) stats.failures++;
    }
  }
  return stats;
}
