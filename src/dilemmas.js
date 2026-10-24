export function ensureDailyDilemma(dailyState, config, pick) {
  if (!config?.enabled || !config.prompts.length) return null;
  dailyState.dilemma ??= { ...pick("dilemmas:prompts", config.prompts), messageId: null, channelId: null };
  return dailyState.dilemma;
}

export function prepareRecapDilemma(dailyState, config, pick, random = Math.random) {
  if (!config?.enabled || !config.prompts.length || dailyState.dilemma?.messageId) return null;
  // Decide once per day so a blocked/retried recap cannot keep rerolling the odds.
  dailyState.dilemmaInRecap ??= random() < config.recapChance;
  return dailyState.dilemmaInRecap ? ensureDailyDilemma(dailyState, config, pick) : null;
}

export function formatDilemma(dilemma) {
  return `**🗳️ Break-room Referendum**\n${dilemma.question}\n🅰️ ${dilemma.optionA}\n🅱️ ${dilemma.optionB}\nReact 🅰️ or 🅱️. Defend your terrible choice in chat.`;
}

export async function recordDilemmaMessage(dilemma, sent, channelId, save) {
  if (!sent) return;
  dilemma.messageId = sent.id;
  dilemma.channelId = channelId;
  await save();
  for (const emoji of ["🅰️", "🅱️"]) {
    try { await sent.react(emoji); }
    catch (error) { console.warn("Dilemma reaction unavailable:", error.message); }
  }
}

export async function postDailyDilemma({ dailyState, config, pick, guildId, channelId, send, save }) {
  const dilemma = ensureDailyDilemma(dailyState, config, pick);
  if (!dilemma) return send("the break-room ballot box is closed for now.");
  if (dilemma.messageId) {
    return send(`today's deeply unnecessary decision is already on the table. vote here: https://discord.com/channels/${guildId}/${dilemma.channelId}/${dilemma.messageId}`);
  }
  await save();
  const sent = await send(formatDilemma(dilemma));
  await recordDilemmaMessage(dilemma, sent, channelId, save);
  return sent;
}
