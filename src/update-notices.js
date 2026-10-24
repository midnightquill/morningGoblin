export const UPDATE_AWAY_MESSAGE = "🛠️ **Quick goblin update!** the goblin is getting a tiny tune-up. back shortly; please do not eat the maintenance clipboard.";
export const UPDATE_RETURN_MESSAGE = "🛠️ **Goblin update complete.** back on duty. the screws left over are decorative.";

function belongsToGuild(channel, guild) {
  return channel?.guildId === guild.id || channel?.guild?.id === guild.id;
}

export async function getUpdateNoticeChannel(guild, { channelId = "", channelName = "general" } = {}) {
  if (channelId) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    return belongsToGuild(channel, guild) && channel.isTextBased() ? channel : null;
  }

  const matches = (channel) => belongsToGuild(channel, guild) && channel.isTextBased() &&
    channel.name?.normalize("NFKC").toLowerCase() === channelName.normalize("NFKC").toLowerCase();
  const cached = [...guild.channels.cache.values()].filter(matches);
  if (cached.length === 1) return cached[0];
  if (cached.length > 1) return null; // An explicit ID can disambiguate duplicate names.
  const channels = await guild.channels.fetch().catch(() => null);
  const matching = [...(channels?.values() ?? [])].filter(matches);
  return matching.length === 1 ? matching[0] : null;
}

export async function announceUpdateNotice({ guild, guildState, send, save, channelId, channelName }) {
  // Keep an owner-requested outage or an unannounced return intact.
  if (guildState.offlineNotice?.pendingReturn) return false;
  const channel = await getUpdateNoticeChannel(guild, { channelId, channelName });
  if (!channel) return false;

  const sent = await send(channel, {
    content: UPDATE_AWAY_MESSAGE,
    allowedMentions: { parse: [] },
  }, { prependPendingReturn: false });
  if (!sent) return false;

  guildState.offlineNotice = { pendingReturn: true, channelId: channel.id, reason: "update" };
  await save();
  return true;
}
