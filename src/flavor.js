// Callers record the cooldown only after Discord accepts the message.
export function pickSurrealReply(config, guildState, pick, { now = Date.now(), random = Math.random } = {}) {
  if (!config?.lines.length || config.chance <= 0) return null;
  if (Number.isFinite(guildState.lastSurrealReplyAt) &&
      now - guildState.lastSurrealReplyAt < config.cooldownMinutes * 60_000) return null;
  if (random() >= config.chance) return null;
  return pick("surreal:lines", config.lines);
}
