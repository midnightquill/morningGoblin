import "dotenv/config";

import { open, readFile, unlink } from "node:fs/promises";

import path from "node:path";

import { ActivityType, Client, GatewayIntentBits, PermissionsBitField } from "discord.js";

import { loadMorningConfig, normalizeAcceptedStarts } from "./config.js";

import { JsonStore } from "./storage.js";



const FALLBACK_TIMEZONE = "America/Phoenix";

const COMMAND_PREFIX = process.env.COMMAND_PREFIX?.trim() || "!gm";

const BOT_OWNER_ID = process.env.BOT_OWNER_ID?.trim() || "";

const DEFAULT_TIMEZONE = resolveDefaultTimeZone(process.env.DEFAULT_TIMEZONE?.trim());

const MORNING_REMINDER_HOUR = readNumber("MORNING_REMINDER_HOUR", 8, 0, 23);

const MORNING_REMINDER_MINUTE = readNumber("MORNING_REMINDER_MINUTE", 0, 0, 59);

const MORNING_FOLLOWUP_HOUR = readNumber("MORNING_FOLLOWUP_HOUR", 10, 0, 23);

const MORNING_FOLLOWUP_MINUTE = readNumber("MORNING_FOLLOWUP_MINUTE", 30, 0, 59);

const MORNING_WINDOW_END_HOUR = readNumber("MORNING_WINDOW_END_HOUR", 12, 0, 23);

const REMINDER_GRACE_MINUTES = 180;

const FOLLOWUP_GRACE_MINUTES = 180;

const RANDOM_REPLY_CHANCE = 0.42;

const LOCK_PATH = path.resolve(process.cwd(), "data", "bot.lock");

const DEFAULT_PRESENCE = {
  type: "watching",
  name: "illegal pre-gm chatter",
};
const US_MORNING_START_HOUR = 5;
const US_MORNING_END_HOUR = 11;
const UNITED_STATES_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];




const client = new Client({

  intents: [

    GatewayIntentBits.Guilds,

    GatewayIntentBits.GuildMessages,

    GatewayIntentBits.GuildMembers,

    GatewayIntentBits.MessageContent,

  ],

});



const store = new JsonStore();

const formatterCache = new Map();

const conversationState = {

  channelLastReply: new Map(),

  userLastReply: new Map(),

  poolBags: new Map(),

};



let morningConfig;

let acceptedStarts;

let acceptedPatterns;

let lockHandle = null;



function readNumber(name, fallback, min, max) {

  const raw = process.env[name];

  const parsed = Number.parseInt(raw ?? "", 10);



  if (Number.isNaN(parsed)) {

    return fallback;

  }



  return Math.min(Math.max(parsed, min), max);

}



function resolveDefaultTimeZone(candidate) {

  return isValidTimeZoneName(candidate) ? candidate : FALLBACK_TIMEZONE;

}



function isValidTimeZoneName(timeZone) {

  if (!timeZone) {

    return false;

  }



  try {

    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());

    return true;

  } catch {

    return false;

  }

}



function pickRandom(items) {

  return items[Math.floor(Math.random() * items.length)];

}



function shuffle(items) {

  const copy = [...items];



  for (let index = copy.length - 1; index > 0; index -= 1) {

    const swapIndex = Math.floor(Math.random() * (index + 1));

    const current = copy[index];

    copy[index] = copy[swapIndex];

    copy[swapIndex] = current;

  }



  return copy;

}



function pickFromPoolBag(poolKey, items) {

  if (items.length === 0) {

    return "";

  }



  let bag = conversationState.poolBags.get(poolKey) ?? [];



  if (bag.length === 0) {

    bag = shuffle(items);

  }



  const nextChoice = bag.pop();

  conversationState.poolBags.set(poolKey, bag);

  return nextChoice;

}



function shouldReply() {

  return Math.random() < RANDOM_REPLY_CHANCE;

}



async function isPidRunning(pid) {

  if (!Number.isInteger(pid) || pid <= 0) {

    return false;

  }



  try {

    process.kill(pid, 0);

    return true;

  } catch (error) {

    return error?.code === "EPERM";

  }

}



async function writeLockFile(handle) {

  await handle.truncate(0);

  await handle.writeFile(`${process.pid}\n`);

}



async function acquireInstanceLock() {

  try {

    lockHandle = await open(LOCK_PATH, "wx");

    await writeLockFile(lockHandle);

    return;

  } catch (error) {

    if (error?.code !== "EEXIST") {

      throw error;

    }

  }



  const existingPidRaw = await readFile(LOCK_PATH, "utf8").catch(() => "");

  const existingPid = Number.parseInt(existingPidRaw.trim(), 10);



  if (await isPidRunning(existingPid)) {

    throw new Error(`Morning Goblin is already running (PID ${existingPid}). Close the other bot window before starting a new one.`);

  }



  await unlink(LOCK_PATH).catch(() => {});

  lockHandle = await open(LOCK_PATH, "wx");

  await writeLockFile(lockHandle);

}



async function releaseInstanceLock() {

  if (!lockHandle) {

    return;

  }



  const handleToClose = lockHandle;

  lockHandle = null;



  await handleToClose.close().catch(() => {});

  await unlink(LOCK_PATH).catch(() => {});

}



function createDailyState(dateKey) {

  return {

    dateKey,

    reminderSent: false,

    followupSent: false,

    checkIns: {},

    nudgedUsers: {},

  };

}



function ensureGuildState(guildId) {

  const guilds = store.state.guilds;



  if (!guilds[guildId]) {

    guilds[guildId] = {
      morningChannelId: null,
      timezone: DEFAULT_TIMEZONE,
      daily: null,
      suppressedCheckInReplyUserIds: [],
    };

  }



  if (!Array.isArray(guilds[guildId].suppressedCheckInReplyUserIds)) {
    guilds[guildId].suppressedCheckInReplyUserIds = [];
  }

  return guilds[guildId];
}



function getGuildTimezone(guildState) {

  return isValidTimeZoneName(guildState.timezone) ? guildState.timezone : DEFAULT_TIMEZONE;

}



function getFormatter(timeZone) {

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



function getZonedParts(date, timeZone) {

  const parts = getFormatter(timeZone).formatToParts(date);

  const values = Object.fromEntries(

    parts

      .filter((part) => part.type !== "literal")

      .map((part) => [part.type, part.value]),

  );



  return {

    dateKey: `${values.year}-${values.month}-${values.day}`,

    hour: Number.parseInt(values.hour, 10),

    minute: Number.parseInt(values.minute, 10),

  };

}



function ensureDailyState(guildState, dateKey) {

  if (!guildState.daily || guildState.daily.dateKey !== dateKey) {

    guildState.daily = createDailyState(dateKey);

  }



  return guildState.daily;

}



function isBoundaryCharacter(char) {

  return !char || /[\s.,!?;:'"`()\[\]{}<>\-_/\\]/.test(char);

}



function matchesAcceptedStart(content, acceptedStart) {

  if (!content.startsWith(acceptedStart)) {

    return false;

  }



  const nextChar = content.charAt(acceptedStart.length);

  return isBoundaryCharacter(nextChar);

}



function matchesAcceptedPattern(content) {

  return acceptedPatterns.some((pattern) => pattern.test(content));

}



function isGoodMorningMessage(content) {
  const normalized = content.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    acceptedStarts.some((acceptedStart) => matchesAcceptedStart(normalized, acceptedStart)) ||
    matchesAcceptedPattern(normalized)
  );
}

function isMorningInTimeZone(date, timeZone) {
  const { hour } = getZonedParts(date, timeZone);
  return hour >= US_MORNING_START_HOUR && hour <= US_MORNING_END_HOUR;
}

function isMorningSomewhereInUnitedStates(date = new Date()) {
  return UNITED_STATES_TIMEZONES.some((timeZone) => isMorningInTimeZone(date, timeZone));
}


function hasManageGuild(member) {

  return Boolean(member) && member.permissions.has(PermissionsBitField.Flags.ManageGuild);

}



function isBotOwner(userId) {

  return Boolean(BOT_OWNER_ID) && userId === BOT_OWNER_ID;

}



function parsePresenceType(rawType) {

  const normalized = rawType?.trim().toLowerCase();



  switch (normalized) {

    case "playing":

      return ActivityType.Playing;

    case "watching":

      return ActivityType.Watching;

    case "listening":

      return ActivityType.Listening;

    case "competing":

      return ActivityType.Competing;

    default:

      return null;

  }

}



function getBotPresence() {

  const savedPresence = store.state.botPresence;



  if (!savedPresence?.name || !parsePresenceType(savedPresence.type)) {

    return DEFAULT_PRESENCE;

  }



  return {

    type: savedPresence.type,

    name: savedPresence.name,

  };

}



async function applyBotPresence() {

  if (!client.user) {

    return;

  }



  const presence = getBotPresence();

  const activityType = parsePresenceType(presence.type) ?? ActivityType.Watching;



  client.user.setPresence({

    activities: [

      {

        name: presence.name,

        type: activityType,

      },

    ],

    status: "online",

  });

}



function parseTargetUserId(message) {
  return message.mentions.users.first()?.id || message.content.match(/\b(\d{17,20})\b/)?.[1] || null;
}

function formatSuppressedReplyList(guild) {
  const suppressed = ensureGuildState(guild.id).suppressedCheckInReplyUserIds;

  if (suppressed.length === 0) {
    return "nobody is currently on the no-reply check-in list. the goblin remains chatty.";
  }

  return "check-in reply suppression list: " + suppressed.map((userId) => `<@${userId}>`).join(", ");
}

function formatRoster(names) {

  const limit = 20;



  if (names.length <= limit) {

    return names.join(", ");

  }



  const shown = names.slice(0, limit).join(", ");

  return `${shown}, and ${names.length - limit} more`;

}



function formatBotText(template, message) {

  return template

    .replaceAll("{user}", message.member?.displayName || message.author.username)

    .replaceAll("{prefix}", COMMAND_PREFIX)

    .replaceAll("{channel}", `<#${message.channelId}>`);

}



function cleanMessageContent(content) {

  return content.replace(/<@!?\d+>/g, " ").trim();

}



function isWakeWordMessage(content) {

  const normalized = cleanMessageContent(content).toLowerCase();



  if (!normalized) {

    return false;

  }



  return morningConfig.conversation.wakeWords.some((wakeWord) => normalized.includes(wakeWord));

}



function getMatchingKeywordReply(message) {

  const normalized = cleanMessageContent(message.content).toLowerCase();



  for (const rule of morningConfig.conversation.keywordRules) {

    if (rule.triggers.some((trigger) => normalized.includes(trigger.toLowerCase()))) {

      return formatBotText(pickRandom(rule.replies), message);

    }

  }



  return null;

}



function getMentionReply(message) {

  return formatBotText(

    pickFromPoolBag("conversation:mentionReplies", morningConfig.conversation.mentionReplies),

    message,

  );

}



function getGenericReply(message) {

  return formatBotText(

    pickFromPoolBag("conversation:genericReplies", morningConfig.conversation.genericReplies),

    message,

  );

}



function isConversationCoolingDown(message) {

  const now = Date.now();

  const channelCooldownMs = morningConfig.conversation.channelCooldownSeconds * 1000;

  const userCooldownMs = morningConfig.conversation.userCooldownSeconds * 1000;

  const lastChannelReply = conversationState.channelLastReply.get(message.channelId) ?? 0;

  const lastUserReply = conversationState.userLastReply.get(message.author.id) ?? 0;



  if (channelCooldownMs > 0 && now - lastChannelReply < channelCooldownMs) {

    return true;

  }



  if (userCooldownMs > 0 && now - lastUserReply < userCooldownMs) {

    return true;

  }



  return false;

}



function markConversationReply(message) {

  const now = Date.now();

  conversationState.channelLastReply.set(message.channelId, now);

  conversationState.userLastReply.set(message.author.id, now);

}



async function isReplyToBot(message) {

  if (!message.reference?.messageId) {

    return false;

  }



  try {

    const referenced = await message.fetchReference();

    return referenced.author.id === client.user.id;

  } catch {

    return false;

  }

}



async function getConversationReply(message) {

  if (!morningConfig.conversation.enabled) {

    return null;

  }



  const directlyMentioned = message.mentions.users.has(client.user.id);



  if (directlyMentioned) {

    const keywordReply = getMatchingKeywordReply(message);

    return keywordReply ?? getMentionReply(message);

  }



  if (isConversationCoolingDown(message)) {

    return null;

  }



  const keywordReply = getMatchingKeywordReply(message);



  if (keywordReply) {

    return keywordReply;

  }



  if (await isReplyToBot(message)) {

    return getGenericReply(message);

  }



  if (isWakeWordMessage(message.content)) {

    return getGenericReply(message);

  }



  return null;

}



async function maybeHandleConversation(message) {

  const reply = await getConversationReply(message);



  if (!reply) {

    return false;

  }



  markConversationReply(message);

  await safeSend(message.channel, reply);

  return true;

}



async function reloadMorningConfig() {

  morningConfig = await loadMorningConfig();

  acceptedStarts = normalizeAcceptedStarts(morningConfig.acceptedStarts);

  acceptedPatterns = morningConfig.acceptedPatterns.map((pattern) => new RegExp(pattern, "i"));

}



async function getMorningChannel(guild) {

  const guildState = ensureGuildState(guild.id);



  if (!guildState.morningChannelId) {

    return null;

  }



  try {

    const channel = await guild.channels.fetch(guildState.morningChannelId);



    if (!channel || !channel.isTextBased()) {

      return null;

    }



    return channel;

  } catch {

    return null;

  }

}



async function safeSend(channel, content) {

  return channel.send({

    content,

    allowedMentions: { parse: [] },

  });

}



async function postReminder(guild) {

  const channel = await getMorningChannel(guild);



  if (!channel) {

    return false;

  }



  await safeSend(channel, pickRandom(morningConfig.reminderLines));

  return true;

}



async function getHumanMemberCount(guild) {

  try {

    await guild.members.fetch();

  } catch {

    return null;

  }



  return guild.members.cache.filter((member) => !member.user.bot).size;

}



async function buildFollowupMessage(guild, dailyState) {

  const checkInCount = Object.keys(dailyState.checkIns).length;



  if (checkInCount === 0) {

    return pickRandom(morningConfig.noCheckInsFollowups);

  }



  const totalHumans = await getHumanMemberCount(guild);



  if (!totalHumans) {

    return `morning census update: ${checkInCount} brave little legends have checked in. the rest are either asleep or lost in a cereal bowl.`;

  }



  const missingCount = Math.max(totalHumans - checkInCount, 0);



  if (missingCount === 0) {

    return `morning census update: ${checkInCount}/${totalHumans} humans checked in. stunning. immaculate. the sun feels seen.`;

  }



  return `morning census update: ${checkInCount}/${totalHumans} humans have said good morning. ${missingCount} remain unverified and are presumably negotiating with their blankets.`;

}



async function postFollowup(guild) {

  const guildState = ensureGuildState(guild.id);

  const timeZone = getGuildTimezone(guildState);

  const dailyState = ensureDailyState(guildState, getZonedParts(new Date(), timeZone).dateKey);

  const channel = await getMorningChannel(guild);



  if (!channel) {

    return false;

  }



  await safeSend(channel, await buildFollowupMessage(guild, dailyState));

  return true;

}



function getCheckInNames(dailyState) {

  return Object.values(dailyState.checkIns)

    .sort((left, right) => left.timestamp - right.timestamp)

    .map((entry) => entry.displayName);

}



async function postStatus(message) {

  const guildState = ensureGuildState(message.guild.id);

  const timeZone = getGuildTimezone(guildState);

  const dailyState = ensureDailyState(guildState, getZonedParts(new Date(), timeZone).dateKey);

  const names = getCheckInNames(dailyState);



  if (names.length === 0) {

    await message.reply({

      content: "today's good-morning count: 0. a truly suspicious level of silence.",

      allowedMentions: { repliedUser: false },

    });

    return;

  }



  const totalHumans = await getHumanMemberCount(message.guild);

  const summary =

    totalHumans && totalHumans > 0

      ? `today's good-morning count: ${names.length}/${totalHumans}.`

      : `today's good-morning count: ${names.length}.`;



  await message.reply({

    content: `${summary}\nchecked in so far: ${formatRoster(names)}`,

    allowedMentions: { repliedUser: false, parse: [] },

  });

}



async function maybeCelebrateCheckIn(message, guildState, alreadyCheckedIn, totalCheckIns) {
  try {
    await message.react("☀️");
  } catch {
    // Reactions are optional sugar.
  }

  if (guildState.suppressedCheckInReplyUserIds.includes(message.author.id)) {
    return;
  }

  if (!shouldReply()) {
    return;
  }

  const reply = alreadyCheckedIn
    ? pickRandom(morningConfig.duplicateReplies)
    : `${pickRandom(morningConfig.checkInReplies)} (${totalCheckIns} logged today.)`;

  await message.reply({
    content: reply,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}



async function maybeNudge(message, guildState, dailyState, nowMinutes) {

  const startMinutes = MORNING_REMINDER_HOUR * 60 + MORNING_REMINDER_MINUTE;

  const endMinutes = MORNING_WINDOW_END_HOUR * 60 + 59;



  if (nowMinutes < startMinutes || nowMinutes > endMinutes) {

    return;

  }



  if (!guildState.morningChannelId) {

    return;

  }



  if (message.content.trim().length === 0) {

    return;

  }



  if (dailyState.checkIns[message.author.id] || dailyState.nudgedUsers[message.author.id]) {

    return;

  }



  dailyState.nudgedUsers[message.author.id] = true;

  await store.save();



  const channelMention = `<#${guildState.morningChannelId}>`;

  const reply = pickRandom(morningConfig.nudgeReplies).replace("{channel}", channelMention);



  await message.reply({

    content: reply,

    allowedMentions: { repliedUser: false, parse: [] },

  });

}



async function handleCheckIn(message) {
  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const zonedNow = getZonedParts(new Date(), timeZone);
  const dailyState = ensureDailyState(guildState, zonedNow.dateKey);
  const alreadyCheckedIn = Boolean(dailyState.checkIns[message.author.id]);

  dailyState.checkIns[message.author.id] = {
    displayName: message.member?.displayName || message.author.username,
    timestamp: Date.now(),
    channelId: message.channelId,
    message: message.content,
  };

  delete dailyState.nudgedUsers[message.author.id];
  await store.save();

  const totalCheckIns = Object.keys(dailyState.checkIns).length;
  await maybeCelebrateCheckIn(message, guildState, alreadyCheckedIn, totalCheckIns);
}

async function handleRejectedCheckIn(message) {
  const reply = formatBotText(
    pickFromPoolBag("checkin:invalidCheckInReplies", morningConfig.invalidCheckInReplies),
    message,
  );

  await message.reply({
    content: reply,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}


async function handleOwnerSpeech(message, commandName, body) {

  if (!isBotOwner(message.author.id)) {

    await message.reply({

      content: "that command is owner-only. very exclusive. velvet rope situation.",

      allowedMentions: { repliedUser: false },

    });

    return;

  }



  if (commandName === "say") {

    const text = body.slice(commandName.length).trim();



    if (!text) {

      await message.reply({

        content: "use it like `" + COMMAND_PREFIX + " say hello goblins`.",

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }



    await safeSend(message.channel, text);

    return;

  }



  if (commandName === "presence") {

    const input = body.slice(commandName.length).trim();



    if (!input) {

      await message.reply({

        content: "use `" + COMMAND_PREFIX + " presence watching for Mong Plorps` or `" + COMMAND_PREFIX + " presence reset`.",

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }



    if (["reset", "default"].includes(input.toLowerCase())) {

      store.state.botPresence = null;

      await store.save();

      await applyBotPresence();

      await message.reply({

        content: "presence reset to default: " + DEFAULT_PRESENCE.type + " `" + DEFAULT_PRESENCE.name + "`.",

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }



    const [rawType, ...nameParts] = input.split(/\s+/);

    const activityType = parsePresenceType(rawType);

    const name = nameParts.join(" ").trim();



    if (!activityType || !name) {

      await message.reply({

        content: "use one of: playing, watching, listening, competing. example: `" + COMMAND_PREFIX + " presence watching for Mong Plorps`.",

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }



    store.state.botPresence = {

      type: rawType.toLowerCase(),

      name,

    };

    await store.save();

    await applyBotPresence();

    await message.reply({

      content: "presence updated: " + rawType.toLowerCase() + " `" + name + "`.",

      allowedMentions: { repliedUser: false, parse: [] },

    });

    return;

  }



  const targetChannel = message.mentions.channels.first();



  if (!targetChannel || !targetChannel.isTextBased()) {

    await message.reply({

      content: "use it like `" + COMMAND_PREFIX + " sayto #general hello goblins`.",

      allowedMentions: { repliedUser: false, parse: [] },

    });

    return;

  }



  const text = body

    .slice(commandName.length)

    .trim()

    .replace(/^<#[0-9]+>s*/, "")

    .trim();



  if (!text) {

    await message.reply({

      content: "give me a message too, like `" + COMMAND_PREFIX + " sayto #general hello goblins`.",

      allowedMentions: { repliedUser: false, parse: [] },

    });

    return;

  }



  await safeSend(targetChannel, text);

}



async function handleCommand(message) {

  const body = message.content.slice(COMMAND_PREFIX.length).trim();

  const [command = "help", ...args] = body.split(/\s+/);

  const guildState = ensureGuildState(message.guild.id);



  switch (command.toLowerCase()) {

    case "":

    case "help": {

      await message.reply({

        content: [

          "commands:",

          `- \`${COMMAND_PREFIX} here\` to make this channel the gm zone`,

          `- \`${COMMAND_PREFIX} off\` to disable the bot in this server`,

          `- \`${COMMAND_PREFIX} status\` to see today's gm roster`,

          `- \`${COMMAND_PREFIX} phrases\` to see accepted morning openings`,
          `- \`${COMMAND_PREFIX} quiet @user\` to suppress check-in text replies for a user`,
          `- \`${COMMAND_PREFIX} unquiet @user\` to re-enable check-in text replies for a user`,
          `- \`${COMMAND_PREFIX} quietlist\` to show the no-reply check-in list`,
          `- \`${COMMAND_PREFIX} reload\` to reload config/morning-config.json`,

          `- \`${COMMAND_PREFIX} say your message here\` to force the bot to speak here (owner only)`,

          `- \`${COMMAND_PREFIX} sayto #channel your message here\` to make the bot speak in another channel (owner only)`,

          "- `" + COMMAND_PREFIX + " presence watching for Mong Plorps` to change the bot status (owner only)",

          `- mention the bot, reply to it, or say its name to make it chatter back`,

          `- \`${COMMAND_PREFIX} test\` to fire the reminder right now`,

          `- \`${COMMAND_PREFIX} timezone America/New_York\` to set a server timezone`,

        ].join("\n"),

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }

    case "status": {

      await postStatus(message);

      return;

    }

    case "phrases": {
      await message.reply({
        content: `accepted morning starts: ${morningConfig.acceptedStarts.join(", ")}`,
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }
    case "quietlist": {
      if (!hasManageGuild(message.member)) {
        await message.reply({
          content: "you need `Manage Server` for that one, chief.",
          allowedMentions: { repliedUser: false },
        });
        return;
      }

      await message.reply({
        content: formatSuppressedReplyList(message.guild),
        allowedMentions: { repliedUser: false, parse: ["users"] },
      });
      return;
    }
    case "quiet":
    case "unquiet": {
      if (!hasManageGuild(message.member)) {
        await message.reply({
          content: "you need `Manage Server` for that one, chief.",
          allowedMentions: { repliedUser: false },
        });
        return;
      }

      const targetUserId = parseTargetUserId(message);

      if (!targetUserId) {
        await message.reply({
          content: "tag a user or paste their user id so i know whose check-in replies to hush.",
          allowedMentions: { repliedUser: false },
        });
        return;
      }

      const suppressed = guildState.suppressedCheckInReplyUserIds;
      const alreadySuppressed = suppressed.includes(targetUserId);

      if (command.toLowerCase() === "quiet") {
        if (!alreadySuppressed) {
          suppressed.push(targetUserId);
          await store.save();
        }

        await message.reply({
          content: alreadySuppressed
            ? `<@${targetUserId}> is already on the no-reply check-in list. the goblin was already holding its tongue.`
            : `<@${targetUserId}> will still get logged and reacted to, but the goblin will stop sending text replies to their check-ins.`,
          allowedMentions: { repliedUser: false, parse: ["users"] },
        });
        return;
      }

      if (alreadySuppressed) {
        guildState.suppressedCheckInReplyUserIds = suppressed.filter((userId) => userId !== targetUserId);
        await store.save();
        await message.reply({
          content: `<@${targetUserId}> has been removed from the no-reply check-in list. the goblin may resume yapping at them.`,
          allowedMentions: { repliedUser: false, parse: ["users"] },
        });
        return;
      }

      await message.reply({
        content: `<@${targetUserId}> was not on the no-reply check-in list in the first place.`,
        allowedMentions: { repliedUser: false, parse: ["users"] },
      });
      return;
    }
    case "reload": {

      if (!hasManageGuild(message.member)) {

        await message.reply({

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      await reloadMorningConfig();

      await message.reply({

        content: "config reloaded. the goblin has consumed the new script notes.",

        allowedMentions: { repliedUser: false },

      });

      return;

    }

    case "say":

    case "presence":

    case "sayto": {

      await handleOwnerSpeech(message, command.toLowerCase(), body);

      return;

    }

    case "here": {

      if (!hasManageGuild(message.member)) {

        await message.reply({

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      if (!message.channel.isTextBased()) {

        await message.reply({

          content: "pick a normal text-ish channel for the morning nonsense.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      guildState.morningChannelId = message.channelId;

      await store.save();

      await message.reply({

        content: `beautiful. this channel is now the official gm pit. timezone is currently \`${getGuildTimezone(guildState)}\`.`,

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }

    case "off": {

      if (!hasManageGuild(message.member)) {

        await message.reply({

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      guildState.morningChannelId = null;

      guildState.daily = null;

      await store.save();

      await message.reply({

        content: "morning surveillance disabled. everyone may now be sleepy in peace.",

        allowedMentions: { repliedUser: false },

      });

      return;

    }

    case "timezone": {

      if (!hasManageGuild(message.member)) {

        await message.reply({

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      const candidate = args.join(" ").trim();



      if (!candidate || !isValidTimeZoneName(candidate)) {

        await message.reply({

          content: "that timezone looks cursed. try something like `America/Phoenix`.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      guildState.timezone = candidate;

      await store.save();

      await message.reply({

        content: `timezone set to \`${candidate}\`. the rooster will now scream on local time.`,

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }

    case "test": {

      if (!hasManageGuild(message.member)) {

        await message.reply({

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      if (!guildState.morningChannelId) {

        await message.reply({

          content: `set a channel first with \`${COMMAND_PREFIX} here\`.`,

          allowedMentions: { repliedUser: false, parse: [] },

        });

        return;

      }



      const sent = await postReminder(message.guild);

      await message.reply({

        content: sent

          ? "test reminder deployed. the goblin horn has sounded."

          : "i could not post the test reminder. make sure the configured channel still exists and i can talk there.",

        allowedMentions: { repliedUser: false },

      });

      return;

    }

    default: {

      await message.reply({

        content: `i do not know \`${command}\`, but i do know \`${COMMAND_PREFIX} help\`.`,

        allowedMentions: { repliedUser: false, parse: [] },

      });

    }

  }

}



async function schedulerTick() {

  if (!client.isReady()) {

    return;

  }



  for (const guild of client.guilds.cache.values()) {

    const guildState = ensureGuildState(guild.id);



    if (!guildState.morningChannelId) {

      continue;

    }



    const zonedNow = getZonedParts(new Date(), getGuildTimezone(guildState));

    const dailyState = ensureDailyState(guildState, zonedNow.dateKey);

    const nowMinutes = zonedNow.hour * 60 + zonedNow.minute;

    const reminderMinutes = MORNING_REMINDER_HOUR * 60 + MORNING_REMINDER_MINUTE;

    const followupMinutes = MORNING_FOLLOWUP_HOUR * 60 + MORNING_FOLLOWUP_MINUTE;



    if (

      !dailyState.reminderSent &&

      nowMinutes >= reminderMinutes &&

      nowMinutes <= reminderMinutes + REMINDER_GRACE_MINUTES

    ) {

      const sent = await postReminder(guild);



      if (sent) {

        dailyState.reminderSent = true;

        await store.save();

      }



      continue;

    }



    if (

      dailyState.reminderSent &&

      !dailyState.followupSent &&

      nowMinutes >= followupMinutes &&

      nowMinutes <= followupMinutes + FOLLOWUP_GRACE_MINUTES

    ) {

      const sent = await postFollowup(guild);



      if (sent) {

        dailyState.followupSent = true;

        await store.save();

      }

    }

  }

}



client.once("clientReady", async () => {

  await applyBotPresence();



  console.log(`Logged in as ${client.user.tag}`);

  console.log(`Loaded ${morningConfig.conversation.mentionReplies.length} mention replies.`);

  await schedulerTick();



  setInterval(() => {

    schedulerTick().catch((error) => {

      console.error("Scheduler tick failed:", error);

    });

  }, 30000);

});



client.on("messageCreate", async (message) => {

  if (!message.inGuild() || message.author.bot) {

    return;

  }



  const guildState = ensureGuildState(message.guild.id);

  const timeZone = getGuildTimezone(guildState);

  const zonedNow = getZonedParts(new Date(), timeZone);

  const dailyState = ensureDailyState(guildState, zonedNow.dateKey);

  const nowMinutes = zonedNow.hour * 60 + zonedNow.minute;



  try {

    if (message.content.startsWith(COMMAND_PREFIX)) {

      await handleCommand(message);

      return;

    }



    if (isGoodMorningMessage(message.content)) {
      if (!isMorningSomewhereInUnitedStates(new Date())) {
        await handleRejectedCheckIn(message);
        return;
      }

      await handleCheckIn(message);
      return;
    }


    await maybeNudge(message, guildState, dailyState, nowMinutes);

    await maybeHandleConversation(message);

  } catch (error) {

    console.error("Message handler failed:", error);

  }

});



client.on("guildCreate", async (guild) => {

  ensureGuildState(guild.id);

  await store.save();

});



async function start() {

  if (!process.env.DISCORD_TOKEN) {

    throw new Error("Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.");

  }



  await acquireInstanceLock();

  await reloadMorningConfig();

  await store.load();

  await client.login(process.env.DISCORD_TOKEN);

}



const cleanupAndExit = async (code = 0) => {

  await releaseInstanceLock();

  process.exit(code);

};



process.once("SIGINT", () => {

  cleanupAndExit(0).catch((error) => {

    console.error("Failed to release Morning Goblin lock during shutdown:", error);

    process.exit(1);

  });

});



process.once("SIGTERM", () => {

  cleanupAndExit(0).catch((error) => {

    console.error("Failed to release Morning Goblin lock during shutdown:", error);

    process.exit(1);

  });

});



start().catch(async (error) => {

  console.error(error);

  await releaseInstanceLock();

  process.exitCode = 1;

});













