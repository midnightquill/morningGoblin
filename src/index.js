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

const LOCK_PATH = path.resolve(process.cwd(), "data", "bot.lock");

const POINTS_PER_CHECK_IN = 1;

const PERIOD_TYPES = ["week", "month", "year"];

const PERIOD_HISTORY_LIMITS = {
  week: 16,
  month: 18,
  year: 10,
};

const DEFAULT_PRESENCE = {
  type: "watching",
  name: "watching for illegal pre-gm chatter",
};
const AUTO_PRESENCE_MIN_DELAY_MS = 6 * 60 * 60 * 1000;
const AUTO_PRESENCE_MAX_DELAY_MS = 12 * 60 * 60 * 1000;
const AUTO_PRESENCE_OPTIONS = [
  { type: "watching", name: "watching for illegal pre-gm chatter" },
  { type: "watching", name: "hiding from Grandma" },
  { type: "watching", name: "trying to be like Kap" },
  { type: "watching", name: "searching for crown animals" },
  { type: "watching", name: "exploring Denmark" },
  { type: "watching", name: "exploring The Netherlands" },
  { type: "watching", name: "researching mong plorp origins" },
  { type: "listening", name: "blahhblahblahbabaapapaDODO" },
  { type: "watching", name: "making salty Nate memes" },
  { type: "watching", name: "not playing Slay the Spire 2" },
  { type: "watching", name: "watching suspicious sunrise activity" },
  { type: "watching", name: "watching the clock with distrust" },
  { type: "watching", name: "watching the dawn paperwork pile up" },
  { type: "watching", name: "watching for illegal brunch behavior" },
  { type: "watching", name: "watching for contraband snoozing" },
  { type: "watching", name: "watching the east coast wake up first" },
  { type: "watching", name: "watching for fake gms from Jak" },
  { type: "watching", name: "watching for Mong Plorps" },
  { type: "watching", name: "watching the vibes with concern" },
  { type: "watching", name: "watching tiny goblin bureaucracy" },
  { type: "watching", name: "watching clipboard-related incidents" },
  { type: "watching", name: "watching for coffee-based miracles" },
  { type: "watching", name: "watching for forged morning papers" },
  { type: "watching", name: "watching for hallway-level nonsense" },
  { type: "watching", name: "watching the bagel situation" },
  { type: "watching", name: "watching the sunrise compliance board" },
  { type: "watching", name: "watching everyone with little goblin eyes" },
  { type: "watching", name: "watching for unlicensed yawning" },
  { type: "watching", name: "watching for rogue afternoon greetings" },
  { type: "playing", name: "playing clipboard simulator" },
  { type: "playing", name: "playing dawn patrol" },
  { type: "playing", name: "playing coffee% any%" },
  { type: "playing", name: "playing sunrise compliance" },
  { type: "playing", name: "playing catch fake mornings" },
  { type: "playing", name: "playing hide and shriek" },
  { type: "playing", name: "playing goblin office tycoon" },
  { type: "playing", name: "playing deadline chicken with the sun" },
  { type: "playing", name: "playing spreadsheet goblin deluxe" },
  { type: "playing", name: "playing blame the timezone" },
  { type: "playing", name: "playing staring contest with daylight" },
  { type: "listening", name: "listening to morning excuses" },
  { type: "listening", name: "listening to distant coffee brewing" },
  { type: "listening", name: "listening to tiny administrative screams" },
  { type: "listening", name: "listening for the first yawn of the day" },
  { type: "listening", name: "listening to the sound of legal morning" },
  { type: "listening", name: "listening for goblin praise" },
  { type: "listening", name: "listening for suspicious silence" },
  { type: "listening", name: "listening to the breakfast economy" },
  { type: "listening", name: "listening to a very loud sunrise" },
  { type: "listening", name: "listening for fake productivity" },
  { type: "listening", name: "listening for Dutch complaints" },
  { type: "competing", name: "competing in sunrise compliance" },
  { type: "competing", name: "competing against the concept of sleep" },
  { type: "competing", name: "competing with the rooster lobby" },
  { type: "competing", name: "competing in office goblin finals" },
  { type: "competing", name: "competing for employee of the dawn" },
  { type: "competing", name: "competing against illegal noon behavior" },
  { type: "competing", name: "competing in paperwork endurance" },
  { type: "competing", name: "competing for regional sunrise dominance" },
  { type: "competing", name: "competing with the bagel mafia" },
  { type: "competing", name: "competing in advanced gm studies" },
];
const OFFLINE_AWAY_LINES = [
  "administrative notice: the Morning Goblin is going offline for a bit. remain calm, remain weird, and try not to commit any sunrise crimes while i am gone.",
  "the Morning Goblin will be temporarily unavailable due to important goblin logistics. do not panic. do not form a committee. i will be back.",
  "brief goblin outage: i am clocking out for a while. please continue your nonsense in an orderly fashion until i return.",
  "the goblin is stepping away to recharge, regroup, and maybe hiss at a power cable. i will return when circumstances become less rude.",
  "small scheduling update: i am about to vanish for a bit. this is a temporary goblin situation, not a collapse of civilization.",
];
const OFFLINE_RETURN_LINES = [
  "the Morning Goblin has returned. order has been restored, the clipboard is back, and i am once again available for administrative dawn nonsense.",
  "i have re-emerged from the void. the goblin is back online and already judging the paperwork.",
  "the outage is over. the goblin has returned, lightly caffeinated and professionally suspicious.",
  "good news for weird little citizens everywhere: the Morning Goblin is back online and immediately resuming oversight.",
  "the goblin has returned from its mysterious absence. please clap in a restrained and bureaucratically appropriate manner.",
];
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
let currentAutoPresence = null;
let autoPresenceTimeout = null;



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
      records: {
        best: null,
        worst: null,
      },
      points: null,
      offlineNotice: {
        pendingReturn: false,
        channelId: null,
      },
    };

  }



  if (!Array.isArray(guilds[guildId].suppressedCheckInReplyUserIds)) {
    guilds[guildId].suppressedCheckInReplyUserIds = [];
  }

  if (!guilds[guildId].records || typeof guilds[guildId].records !== "object") {
    guilds[guildId].records = { best: null, worst: null };
  }

  if (!("best" in guilds[guildId].records)) {
    guilds[guildId].records.best = null;
  }

  if (!("worst" in guilds[guildId].records)) {
    guilds[guildId].records.worst = null;
  }

  if (!guilds[guildId].points || typeof guilds[guildId].points !== "object") {
    guilds[guildId].points = null;
  }

  if (!guilds[guildId].offlineNotice || typeof guilds[guildId].offlineNotice !== "object") {
    guilds[guildId].offlineNotice = { pendingReturn: false, channelId: null };
  }

  if (!("pendingReturn" in guilds[guildId].offlineNotice)) {
    guilds[guildId].offlineNotice.pendingReturn = false;
  }

  if (!("channelId" in guilds[guildId].offlineNotice)) {
    guilds[guildId].offlineNotice.channelId = null;
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



function parseDateKey(dateKey) {

  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);



  if (!match) {

    return null;

  }



  return new Date(Date.UTC(
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10) - 1,
    Number.parseInt(match[3], 10),
  ));

}



function formatUtcDateKey(date) {

  return date.toISOString().slice(0, 10);

}



function getWeekKey(dateKey) {

  const date = parseDateKey(dateKey);



  if (!date) {

    return dateKey;

  }



  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - day);
  return formatUtcDateKey(date);

}



function getMonthKey(dateKey) {

  return dateKey.slice(0, 7);

}



function getYearKey(dateKey) {

  return dateKey.slice(0, 4);

}



function getPeriodKey(periodType, dateKey) {

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



function getPeriodKeys(dateKey) {

  return {
    week: getWeekKey(dateKey),
    month: getMonthKey(dateKey),
    year: getYearKey(dateKey),
  };

}



function createEmptyPeriodBucket(key) {

  return {
    key,
    scores: {},
  };

}



function createPointsState(dateKey) {

  const periodKeys = getPeriodKeys(dateKey);



  return {
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

    if (!Array.isArray(pointsState.history[periodType])) {
      pointsState.history[periodType] = [];
    }
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

  if (!periodState?.key) {
    return false;
  }

  const entries = getSortedScoreEntries(periodState.scores);

  if (entries.length === 0 || entries[0][1] <= 0) {
    return false;
  }

  const topScore = entries[0][1];
  const winnerUserIds = entries.filter(([, score]) => score === topScore).map(([userId]) => userId);

  const entry = {
    periodType,
    periodKey: periodState.key,
    winnerUserIds,
    points: topScore,
  };

  pointsState.history[periodType].unshift(entry);

  const historyLimit = PERIOD_HISTORY_LIMITS[periodType] ?? 12;

  if (pointsState.history[periodType].length > historyLimit) {
    pointsState.history[periodType].length = historyLimit;
  }

  pointsState.pendingAnnouncements.push(entry);
  return true;

}



function advancePointPeriods(guildState, nextDateKey) {

  const pointsState = ensurePointsState(guildState, nextDateKey);
  const nextKeys = getPeriodKeys(nextDateKey);
  let changed = false;

  for (const periodType of PERIOD_TYPES) {
    const periodState = pointsState.periods[periodType];

    if (periodState.key !== nextKeys[periodType]) {
      finalizePointPeriod(pointsState, periodType, periodState);
      pointsState.periods[periodType] = createEmptyPeriodBucket(nextKeys[periodType]);
      changed = true;
    }
  }

  return changed;

}



function awardPoint(guildState, userId, dateKey, amount = POINTS_PER_CHECK_IN) {

  const pointsState = ensurePointsState(guildState, dateKey);
  const currentKeys = getPeriodKeys(dateKey);

  pointsState.lifetime[userId] = (pointsState.lifetime[userId] ?? 0) + amount;

  for (const periodType of PERIOD_TYPES) {
    if (pointsState.periods[periodType].key !== currentKeys[periodType]) {
      pointsState.periods[periodType] = createEmptyPeriodBucket(currentKeys[periodType]);
    }

    pointsState.periods[periodType].scores[userId] = (pointsState.periods[periodType].scores[userId] ?? 0) + amount;
  }

}



function formatPointsWord(points) {

  return `${points} point${points === 1 ? "" : "s"}`;

}



function finalizeCompletedDailyState(guildState, dailyState, nextDateKey) {

  if (!dailyState || !dailyState.dateKey) {

    return { changed: false, newBest: false, userIds: [], count: 0 };

  }



  const recordUpdate = updateRecords(guildState, dailyState);
  const pointsChanged = advancePointPeriods(guildState, nextDateKey);

  return {
    ...recordUpdate,
    changed: recordUpdate.changed || pointsChanged,
  };

}



function ensureDailyState(guildState, dateKey) {

  ensurePointsState(guildState, dateKey);

  if (!guildState.daily) {

    guildState.daily = createDailyState(dateKey);

    return guildState.daily;

  }



  if (guildState.daily.dateKey !== dateKey) {

    finalizeCompletedDailyState(guildState, guildState.daily, dateKey);

    guildState.daily = createDailyState(dateKey);

  }



  return guildState.daily;

}

function isBoundaryCharacter(char) {

  return !char || !/[\p{L}\p{N}]/u.test(char);

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



function getSavedBotPresence() {

  const savedPresence = store.state.botPresence;



  if (!savedPresence?.name || !parsePresenceType(savedPresence.type)) {

    return null;

  }



  return {

    type: savedPresence.type,

    name: savedPresence.name,

  };

}



function getNextAutoPresence() {

  const nextPresence = pickFromPoolBag("presence:autoRotation", AUTO_PRESENCE_OPTIONS);



  if (!nextPresence?.name || !parsePresenceType(nextPresence.type)) {

    return DEFAULT_PRESENCE;

  }



  return {

    type: nextPresence.type,

    name: nextPresence.name,

  };

}



function getRandomAutoPresenceDelayMs() {

  return AUTO_PRESENCE_MIN_DELAY_MS + Math.floor(Math.random() * (AUTO_PRESENCE_MAX_DELAY_MS - AUTO_PRESENCE_MIN_DELAY_MS + 1));

}



function describePresence(presence) {

  const normalizedName = presence.name.toLowerCase();

  if (normalizedName.startsWith(presence.type + " ")) {
    return "`" + presence.name + "`";
  }

  return presence.type + " `" + presence.name + "`";

}



function getBotPresence() {

  const savedPresence = getSavedBotPresence();



  if (savedPresence) {

    return savedPresence;

  }



  if (!currentAutoPresence) {

    currentAutoPresence = getNextAutoPresence();

  }



  return currentAutoPresence;

}



function scheduleAutoPresenceRotation() {

  if (autoPresenceTimeout) {

    clearTimeout(autoPresenceTimeout);

  }



  const delayMs = getRandomAutoPresenceDelayMs();



  autoPresenceTimeout = setTimeout(() => {

    rotateAutoPresence().catch((error) => {

      console.error("Auto presence rotation failed:", error);

    });

  }, delayMs);



  if (typeof autoPresenceTimeout?.unref === "function") {

    autoPresenceTimeout.unref();

  }

}



function initializeAutoPresenceRotation() {

  if (!currentAutoPresence) {

    currentAutoPresence = getNextAutoPresence();

  }



  scheduleAutoPresenceRotation();

}



async function rotateAutoPresence() {

  currentAutoPresence = getNextAutoPresence();



  if (!getSavedBotPresence()) {

    await applyBotPresence();

  }



  scheduleAutoPresenceRotation();

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

  if (await isReplyToBot(message)) {
    const keywordReply = getMatchingKeywordReply(message);
    return keywordReply ?? getGenericReply(message);
  }

  if (isWakeWordMessage(message.content)) {
    const keywordReply = getMatchingKeywordReply(message);
    return keywordReply ?? getGenericReply(message);
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



async function getOfflineNoticeChannel(guild, guildState) {

  const preferredChannelId = guildState.offlineNotice?.channelId;

  if (preferredChannelId) {
    try {
      const preferredChannel = await guild.channels.fetch(preferredChannelId);

      if (preferredChannel && preferredChannel.isTextBased()) {
        return preferredChannel;
      }
    } catch {
      // Fall back to the configured morning channel.
    }
  }

  return getMorningChannel(guild);

}



async function announcePendingReturnMessages() {

  let stateChanged = false;

  for (const guild of client.guilds.cache.values()) {
    const guildState = ensureGuildState(guild.id);

    if (!guildState.offlineNotice?.pendingReturn) {
      continue;
    }

    const targetChannel = await getOfflineNoticeChannel(guild, guildState);

    if (targetChannel) {
      try {
        await safeSend(targetChannel, pickFromPoolBag("offline:returnLines", OFFLINE_RETURN_LINES));
      } catch (error) {
        console.error("Failed to send return notice:", error);
      }
    }

    guildState.offlineNotice.pendingReturn = false;
    guildState.offlineNotice.channelId = null;
    stateChanged = true;
  }

  if (stateChanged) {
    await store.save();
  }

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

  const recordUpdate = updateRecords(guildState, dailyState);

  if (recordUpdate.newBest) {
    const celebration = buildNewBestCelebration(dailyState);

    if (celebration) {
      await channel.send({
        content: celebration.content,
        allowedMentions: { parse: [], users: celebration.userIds },
      });
    }
  }

  return true;
}



function getOrderedCheckInEntries(dailyState) {
  return Object.entries(dailyState.checkIns).sort((left, right) => left[1].timestamp - right[1].timestamp);
}

function getCheckInNames(dailyState) {
  return getOrderedCheckInEntries(dailyState).map(([, entry]) => entry.displayName);
}

function getCheckInUserIds(dailyState) {
  return getOrderedCheckInEntries(dailyState).map(([userId]) => userId);
}

function buildRecordsSummary(guildState) {
  const best = guildState.records?.best;
  const worst = guildState.records?.worst;
  const parts = [];

  if (best) {
    parts.push(`best day: ${best.count} on ${best.dateKey}`);
  }

  if (worst) {
    parts.push(`worst day: ${worst.count} on ${worst.dateKey}`);
  }

  return parts.length > 0 ? parts.join(" | ") : null;
}

function updateRecords(guildState, dailyState) {
  const count = Object.keys(dailyState.checkIns).length;
  const userIds = getCheckInUserIds(dailyState);
  const dateKey = dailyState.dateKey;
  const records = guildState.records;
  let newBest = false;
  let changed = false;

  if (!records.best || count > records.best.count) {
    records.best = { count, dateKey, userIds };
    newBest = count > 0;
    changed = true;
  }

  if (!records.worst || count < records.worst.count) {
    records.worst = { count, dateKey };
    changed = true;
  }

  return { changed, newBest, userIds, count };
}

function buildNewBestCelebration(dailyState) {
  const count = Object.keys(dailyState.checkIns).length;
  const contributors = getCheckInUserIds(dailyState);

  if (count === 0 || contributors.length === 0) {
    return null;
  }

  const templates = [
    `new all-time gm record: ${count}. applause for the dawn athletes: ${contributors.map((userId) => `<@${userId}>`).join(" ")}` ,
    `record shattered. ${count} check-ins. the morning goblin salutes ${contributors.map((userId) => `<@${userId}>`).join(" ")}` ,
    `historic sunrise behavior detected. ${count} people checked in. medals to ${contributors.map((userId) => `<@${userId}>`).join(" ")}` ,
    `the books have been rewritten: ${count} check-ins. celebratory paperwork for ${contributors.map((userId) => `<@${userId}>`).join(" ")}` ,
    `brand-new morning record. ${count} legal dawn participants. screaming professionally for ${contributors.map((userId) => `<@${userId}>`).join(" ")}` ,
  ];

  return {
    content: pickFromPoolBag("records:newBestCelebrations", templates),
    userIds: contributors,
  };
}



function formatPeriodLabel(periodType, periodKey) {

  switch (periodType) {

    case "week":
      return `week of ${periodKey}`;

    case "month": {
      const date = parseDateKey(`${periodKey}-01`);
      return date
        ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)
        : periodKey;
    }

    case "year":
      return periodKey;

    default:
      return periodKey;

  }

}



function buildChampionAnnouncement(entry) {

  if (!entry || !Array.isArray(entry.winnerUserIds) || entry.winnerUserIds.length === 0) {
    return null;
  }

  const winners = entry.winnerUserIds.map((userId) => `<@${userId}>`).join(" ");
  const pointsText = formatPointsWord(entry.points);
  const label = formatPeriodLabel(entry.periodType, entry.periodKey);
  const championWord = entry.winnerUserIds.length === 1 ? "champion" : "co-champions";

  let templates = [];

  switch (entry.periodType) {
    case "week":
      templates = [
        `weekly good morning ${championWord} for the ${label}: ${winners} with ${pointsText}. the goblin salutes your sustained sunrise paperwork.`,
        `the ${label} weekly dawn title goes to ${winners} with ${pointsText}. an incredible seven-day display of administrative discipline.`,
        `weekly gm throne claimed for the ${label}: ${winners}, posting ${pointsText} and terrifying the blankets.`,
      ];
      break;

    case "month":
      templates = [
        `monthly good morning ${championWord} for ${label}: ${winners} with ${pointsText}. the goblin is filing this under elite long-term sunrise behavior.`,
        `${label} belongs to ${winners}, our monthly dawn ${championWord}, with ${pointsText}. absurdly consistent morning paperwork.`,
        `monthly sunrise crown awarded for ${label}: ${winners} on ${pointsText}. the forms themselves are applauding.`,
      ];
      break;

    case "year":
      templates = [
        `yearly good morning ${championWord} for ${label}: ${winners} with ${pointsText}. this is hall-of-fame rooster activity.`,
        `the ${label} annual dawn title goes to ${winners} with ${pointsText}. the goblin lowers its tiny ceremonial banner in respect.`,
        `supreme morning ${championWord} for ${label}: ${winners}, posting ${pointsText} and becoming a legend in the sunrise records.`,
      ];
      break;

    default:
      templates = [
        `good morning ${championWord}: ${winners} with ${pointsText}.`,
      ];
      break;
  }

  return {
    content: pickFromPoolBag(`champions:${entry.periodType}`, templates),
    userIds: entry.winnerUserIds,
  };

}



async function maybePostPendingChampionAnnouncements(guild, guildState) {

  const pending = guildState.points?.pendingAnnouncements;



  if (!Array.isArray(pending) || pending.length === 0) {

    return false;

  }



  const channel = await getMorningChannel(guild);



  if (!channel) {

    return false;

  }



  for (const entry of pending) {
    const announcement = buildChampionAnnouncement(entry);

    if (!announcement) {
      continue;
    }

    await channel.send({
      content: announcement.content,
      allowedMentions: { parse: [], users: announcement.userIds },
    });
  }

  guildState.points.pendingAnnouncements = [];
  await store.save();
  return true;

}



async function getUserDisplayLabel(guild, userId) {

  const cachedMember = guild.members.cache.get(userId);



  if (cachedMember) {
    return cachedMember.displayName;
  }

  const fetchedMember = await guild.members.fetch(userId).catch(() => null);

  return fetchedMember?.displayName || `user ${userId.slice(-4)}`;

}



async function formatScoreboard(guild, scores, limit = 5) {

  const entries = getSortedScoreEntries(scores).slice(0, limit);



  if (entries.length === 0) {

    return "nobody yet";

  }



  const formatted = [];

  for (const [userId, score] of entries) {
    formatted.push(`${await getUserDisplayLabel(guild, userId)} (${score})`);
  }

  return formatted.join(", ");

}



async function formatChampionSummary(guild, entry) {

  if (!entry) {
    return null;
  }

  const winnerNames = [];

  for (const userId of entry.winnerUserIds) {
    winnerNames.push(await getUserDisplayLabel(guild, userId));
  }

  return `${winnerNames.join(", ")} with ${formatPointsWord(entry.points)} (${formatPeriodLabel(entry.periodType, entry.periodKey)})`;

}



async function postPoints(message) {

  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const todayKey = getZonedParts(new Date(), timeZone).dateKey;
  ensureDailyState(guildState, todayKey);

  const pointsState = ensurePointsState(guildState, todayKey);
  const lines = [
    "gm points board:",
    `this week (${formatPeriodLabel("week", pointsState.periods.week.key)}): ${await formatScoreboard(message.guild, pointsState.periods.week.scores, 3)}`,
    `this month (${formatPeriodLabel("month", pointsState.periods.month.key)}): ${await formatScoreboard(message.guild, pointsState.periods.month.scores, 3)}`,
    `this year (${formatPeriodLabel("year", pointsState.periods.year.key)}): ${await formatScoreboard(message.guild, pointsState.periods.year.scores, 3)}`,
    `lifetime: ${await formatScoreboard(message.guild, pointsState.lifetime, 5)}`,
  ];

  for (const periodType of PERIOD_TYPES) {
    const latestChampion = pointsState.history[periodType]?.[0];
    const summary = await formatChampionSummary(message.guild, latestChampion);

    if (summary) {
      lines.push(`last ${periodType} champion: ${summary}`);
    }
  }

  await message.reply({
    content: lines.join("\n"),
    allowedMentions: { repliedUser: false, parse: [] },
  });

}



async function postStatus(message) {
  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const dailyState = ensureDailyState(guildState, getZonedParts(new Date(), timeZone).dateKey);
  const names = getCheckInNames(dailyState);
  const recordsSummary = buildRecordsSummary(guildState);

  if (names.length === 0) {
    const content = recordsSummary
      ? `today's good-morning count: 0. a truly suspicious level of silence.\n${recordsSummary}`
      : "today's good-morning count: 0. a truly suspicious level of silence.";


    await message.reply({
      content,
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  const totalHumans = await getHumanMemberCount(message.guild);
  const summary =
    totalHumans && totalHumans > 0
      ? `today's good-morning count: ${names.length}/${totalHumans}.`
      : `today's good-morning count: ${names.length}.`;

  const lines = [`${summary}`, `checked in so far: ${formatRoster(names)}`];

  if (recordsSummary) {
    lines.push(recordsSummary);
  }

  await message.reply({
    content: lines.join("\n"),
    allowedMentions: { repliedUser: false, parse: [] },
  });
}



function recordCheckIn(guildState, dateKey, userId, entry) {

  const dailyState = ensureDailyState(guildState, dateKey);
  const alreadyCheckedIn = Boolean(dailyState.checkIns[userId]);

  dailyState.checkIns[userId] = entry;
  delete dailyState.nudgedUsers[userId];

  if (!alreadyCheckedIn) {
    awardPoint(guildState, userId, dateKey);
  }

  return {
    dailyState,
    alreadyCheckedIn,
    totalCheckIns: Object.keys(dailyState.checkIns).length,
    pointsAwarded: alreadyCheckedIn ? 0 : POINTS_PER_CHECK_IN,
  };

}



async function maybeCelebrateCheckIn(message, guildState, alreadyCheckedIn, totalCheckIns, options = {}) {
  const { forceReply = false, ignoreQuietList = false } = options;

  try {
    await message.react("\u2600\uFE0F");
  } catch {
    // Reactions are optional sugar.
  }

  if (!ignoreQuietList && guildState.suppressedCheckInReplyUserIds.includes(message.author.id)) {
    return;
  }

  const reply = alreadyCheckedIn
    ? pickFromPoolBag("checkin:duplicateReplies", morningConfig.duplicateReplies)
    : `${pickFromPoolBag("checkin:checkInReplies", morningConfig.checkInReplies)} (${totalCheckIns} logged today.)`;

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



function parseMessageLink(input) {
  const match = input.match(/^https?:\/\/(?:canary\.)?discord\.com\/channels\/(\d{17,20})\/(\d{17,20})\/(\d{17,20})$/i);

  if (!match) {
    return null;
  }

  return {
    guildId: match[1],
    channelId: match[2],
    messageId: match[3],
  };
}

async function fetchReferencedMessage(guild, channelId, messageId) {
  try {
    const channel = await guild.channels.fetch(channelId);

    if (!channel || !channel.isTextBased() || !("messages" in channel)) {
      return null;
    }

    return channel.messages.fetch(messageId);
  } catch {
    return null;
  }
}

async function handleManualLogAdd(message, body) {
  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const todayKey = getZonedParts(new Date(), timeZone).dateKey;
  const input = body.slice("logadd".length).trim();
  const tokens = input.match(/\S+/g) ?? [];

  if (tokens.length === 0) {
    await message.reply({
      content: "use `" + COMMAND_PREFIX + " logadd @user #channel 123456789012345678` or paste a full Discord message link.",

      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  let index = 0;
  let targetUserId = null;
  let targetChannelId = null;

  const userMentionMatch = tokens[index]?.match(/^<@!?(\d{17,20})>$/);

  if (userMentionMatch) {
    targetUserId = userMentionMatch[1];
    index += 1;
  } else if (/^\d{17,20}$/.test(tokens[index] ?? "")) {
    targetUserId = tokens[index];
    index += 1;
  }

  const channelMentionMatch = tokens[index]?.match(/^<#(\d{17,20})>$/);

  if (channelMentionMatch) {
    targetChannelId = channelMentionMatch[1];
    index += 1;
  }

  const referenceToken = tokens[index] ?? "";

  if (!referenceToken) {
    await message.reply({
      content: "i still need the message id or message link so i know which goblin document to file.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (tokens.length > index + 1) {
    await message.reply({
      content: "too many tokens. keep it to a user, an optional channel, and one message id or message link.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  let messageId = null;
  const linkedMessage = parseMessageLink(referenceToken);

  if (linkedMessage) {
    if (linkedMessage.guildId !== message.guild.id) {
      await message.reply({
        content: "that message link points to a different server. cross-border goblin paperwork denied.",
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }

    targetChannelId = linkedMessage.channelId;
    messageId = linkedMessage.messageId;
  } else if (/^\d{17,20}$/.test(referenceToken)) {
    messageId = referenceToken;
    targetChannelId ??= message.channelId;
  } else {
    await message.reply({
      content: "that does not look like a Discord message id or link. the goblin cannot notarize vibes alone.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const sourceMessage = await fetchReferencedMessage(message.guild, targetChannelId, messageId);

  if (!sourceMessage) {
    await message.reply({
      content: "could not fetch that message. either the id is wrong or the goblin does not have channel access.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (sourceMessage.author.bot) {
    await message.reply({
      content: "i am not manually logging another bot. the paperwork stops here.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const sourceDateKey = getZonedParts(new Date(sourceMessage.createdTimestamp), timeZone).dateKey;

  if (sourceDateKey !== todayKey) {
    await message.reply({
      content: "that message is not from today in this server's timezone, so i am not filing it under today's sunrise crimes.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const inferredUserId = sourceMessage.author.id;

  if (targetUserId && targetUserId !== inferredUserId) {
    await message.reply({
      content: "the user you gave me does not match the author of that message. suspicious paperwork. fix one of them and try again.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  targetUserId ??= inferredUserId;

  const sourceMember = sourceMessage.member ?? (await message.guild.members.fetch(targetUserId).catch(() => null));

  const { alreadyCheckedIn, totalCheckIns, pointsAwarded } = recordCheckIn(guildState, todayKey, targetUserId, {
    displayName: sourceMember?.displayName || sourceMessage.author.username,
    timestamp: sourceMessage.createdTimestamp,
    channelId: sourceMessage.channelId,
    message: sourceMessage.content || "[manual log from attachment-only message]",
  });

  await store.save();

  const action = alreadyCheckedIn ? "updated" : "added";
  const pointNote = pointsAwarded > 0 ? ` +${pointsAwarded} dawn point awarded.` : "";

  await message.reply({
    content: "manual gm log " + action + " for <@" + targetUserId + "> from " + sourceMessage.url + ". " + totalCheckIns + " logged today." + pointNote,
    allowedMentions: { repliedUser: false, parse: ["users"] },
  });
}

async function handleManualLogReply(message, body) {
  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const todayKey = getZonedParts(new Date(), timeZone).dateKey;
  const input = body.slice("logreply".length).trim();
  const tokens = input.match(/\S+/g) ?? [];

  if (tokens.length === 0) {
    await message.reply({
      content: "use `" + COMMAND_PREFIX + " logreply #channel 123456789012345678` or paste a full Discord message link.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  let index = 0;
  let targetChannelId = null;
  const channelMentionMatch = tokens[index]?.match(/^<#(\d{17,20})>$/);

  if (channelMentionMatch) {
    targetChannelId = channelMentionMatch[1];
    index += 1;
  }

  const referenceToken = tokens[index] ?? "";

  if (!referenceToken) {
    await message.reply({
      content: "i still need the message id or message link so i know where to do the dramatic retroactive paperwork.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (tokens.length > index + 1) {
    await message.reply({
      content: "too many tokens. keep it to an optional channel plus one message id or message link.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  let messageId = null;
  const linkedMessage = parseMessageLink(referenceToken);

  if (linkedMessage) {
    if (linkedMessage.guildId !== message.guild.id) {
      await message.reply({
        content: "that message link points to a different server. i am not doing international goblin paperwork today.",
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }

    targetChannelId = linkedMessage.channelId;
    messageId = linkedMessage.messageId;
  } else if (/^\d{17,20}$/.test(referenceToken)) {
    messageId = referenceToken;
    targetChannelId ??= message.channelId;
  } else {
    await message.reply({
      content: "that does not look like a Discord message id or link. the goblin cannot react to a concept.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const sourceMessage = await fetchReferencedMessage(message.guild, targetChannelId, messageId);

  if (!sourceMessage) {
    await message.reply({
      content: "could not fetch that message. either the id is wrong or i do not have channel access.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (sourceMessage.author.bot) {
    await message.reply({
      content: "i am not doing a fake retro-gm for another bot. that is spiritually embarrassing.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const sourceDateKey = getZonedParts(new Date(sourceMessage.createdTimestamp), timeZone).dateKey;

  if (sourceDateKey !== todayKey) {
    await message.reply({
      content: "that message is not from today in this server's timezone, so i am not filing it into today's dawn ledger.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const targetUserId = sourceMessage.author.id;
  const sourceMember = sourceMessage.member ?? (await message.guild.members.fetch(targetUserId).catch(() => null));

  const { alreadyCheckedIn, totalCheckIns } = recordCheckIn(guildState, todayKey, targetUserId, {
    displayName: sourceMember?.displayName || sourceMessage.author.username,
    timestamp: sourceMessage.createdTimestamp,
    channelId: sourceMessage.channelId,
    message: sourceMessage.content || "[manual retro-reply log from attachment-only message]",
  });

  await store.save();

  try {
    await maybeCelebrateCheckIn(sourceMessage, guildState, alreadyCheckedIn, totalCheckIns, {
      forceReply: true,
      ignoreQuietList: true,
    });
  } catch {
    await message.reply({
      content: "i logged the gm for <@" + targetUserId + ">, but the reaction/reply part failed. probably channel permissions being dramatic.",
      allowedMentions: { repliedUser: false, parse: ["users"] },
    });
    return;
  }

  await message.reply({
    content: "retro gm reaction fired for <@" + targetUserId + "> on " + sourceMessage.url + ".",
    allowedMentions: { repliedUser: false, parse: ["users"] },
  });
}
async function handleCheckIn(message) {
  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const zonedNow = getZonedParts(new Date(), timeZone);

  const { alreadyCheckedIn, totalCheckIns } = recordCheckIn(guildState, zonedNow.dateKey, message.author.id, {
    displayName: message.member?.displayName || message.author.username,
    timestamp: Date.now(),
    channelId: message.channelId,
    message: message.content,
  });

  await store.save();
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



  if (commandName === "logadd") {

    await handleManualLogAdd(message, body);
    return;

  }

  if (commandName === "logreply") {

    await handleManualLogReply(message, body);
    return;

  }

  if (commandName === "offline") {

    const guildState = ensureGuildState(message.guild.id);
    const targetChannel = (await getMorningChannel(message.guild)) ?? (message.channel.isTextBased() ? message.channel : null);

    if (!targetChannel) {
      await message.reply({
        content: "i do not have a valid channel for the dramatic departure speech yet. set a morning channel first with `" + COMMAND_PREFIX + " here`.",
        allowedMentions: { repliedUser: false, parse: [] },
      });

      return;
    }

    await safeSend(targetChannel, pickFromPoolBag("offline:awayLines", OFFLINE_AWAY_LINES));

    guildState.offlineNotice.pendingReturn = true;
    guildState.offlineNotice.channelId = targetChannel.id;
    await store.save();
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

      currentAutoPresence = getNextAutoPresence();

      await store.save();

      await applyBotPresence();

      scheduleAutoPresenceRotation();

      await message.reply({

        content: "presence reset. the goblin is back on auto-rotation and currently " + describePresence(currentAutoPresence) + ".",

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

      content: "presence updated: " + describePresence({ type: rawType.toLowerCase(), name }) + ".",

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

          `- \`${COMMAND_PREFIX} points\` to see the weekly/monthly/yearly scoreboard`,

          `- \`${COMMAND_PREFIX} phrases\` to see accepted morning openings`,
          `- \`${COMMAND_PREFIX} quiet @user\` to suppress check-in text replies for a user`,
          `- \`${COMMAND_PREFIX} unquiet @user\` to re-enable check-in text replies for a user`,
          `- \`${COMMAND_PREFIX} quietlist\` to show the no-reply check-in list`,
          `- \`${COMMAND_PREFIX} reload\` to reload config/morning-config.json`,

          `- \`${COMMAND_PREFIX} say your message here\` to force the bot to speak here (owner only)`,

          `- \`${COMMAND_PREFIX} sayto #channel your message here\` to make the bot speak in another channel (owner only)`,

          `- \`${COMMAND_PREFIX} offline\` to announce a temporary goblin outage and a later return (owner only)`,

          `- \`${COMMAND_PREFIX} logadd @user #channel 123456789012345678\` to manually file a gm from an existing message (owner only)`,

          `- \`${COMMAND_PREFIX} logreply #channel 123456789012345678\` to retro-react and reply on an existing gm message (owner only)`,

          "- `" + COMMAND_PREFIX + " presence watching for Mong Plorps` to change the bot status (owner only)",

          "- mention the bot, reply to it, or use a wake word like `morning goblin` to make it chatter back",
          "- `" + COMMAND_PREFIX + " fact` for a random morning fact",

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

    case "points": {

      await postPoints(message);

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
    case "fact":
    case "morningfact": {
      const fact = pickFromPoolBag("facts:morningFacts", morningConfig.morningFacts);
      await message.reply({
        content: `morning fact: ${fact}`,
        allowedMentions: { repliedUser: false, parse: [] },
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

    case "sayto":

    case "logadd":

    case "logreply":

    case "offline": {

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

        await maybePostPendingChampionAnnouncements(guild, guildState);

      }



      continue;

    }



    if (nowMinutes >= reminderMinutes) {

      await maybePostPendingChampionAnnouncements(guild, guildState);

    }



    if (


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

  initializeAutoPresenceRotation();

  await applyBotPresence();



  console.log(`Logged in as ${client.user.tag}`);

  console.log(`Loaded ${morningConfig.conversation.mentionReplies.length} mention replies.`);

  console.log(`Loaded ${AUTO_PRESENCE_OPTIONS.length} rotating statuses.`);

  await announcePendingReturnMessages();

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


















