import "dotenv/config";

import { open, readFile, unlink } from "node:fs/promises";

import path from "node:path";

import { ActivityType, Client, GatewayIntentBits, PermissionsBitField } from "discord.js";

import { loadMorningConfig, normalizeAcceptedStarts } from "./config.js";

import {
  containsPhrase,
  findMatchingKeywordRule,
  isSilenceRequest,
  normalizeConversationText,
} from "./conversation-text.js";

import { ChannelMessageGuard } from "./message-guard.js";

import { JsonStore } from "./storage.js";

const formatterCache = new Map();
const invalidTimeZones = new Set();


const FALLBACK_TIMEZONE = "America/Phoenix";

const COMMAND_PREFIX = process.env.COMMAND_PREFIX?.trim() || "!gm";

const BOT_OWNER_ID = process.env.BOT_OWNER_ID?.trim() || "";

const DEFAULT_TIMEZONE = resolveDefaultTimeZone(process.env.DEFAULT_TIMEZONE?.trim());

const RANK_CHECK_CHANNEL_ID = process.env.RANK_CHECK_CHANNEL_ID?.trim() || "";

const RANK_CHECK_CHANNEL_NAME = process.env.RANK_CHECK_CHANNEL_NAME?.trim() || "rank-check\uD83C\uDFC6";

const ENABLE_MORNING_REMINDER = readBoolean("ENABLE_MORNING_REMINDER", false);

const MORNING_REMINDER_HOUR = readNumber("MORNING_REMINDER_HOUR", 8, 0, 23);

const MORNING_REMINDER_MINUTE = readNumber("MORNING_REMINDER_MINUTE", 0, 0, 59);

const ENABLE_NOON_RECAP = readBoolean("ENABLE_NOON_RECAP", true);

const NOON_RECAP_HOUR = readNumber("NOON_RECAP_HOUR", 12, 0, 23);

const NOON_RECAP_MINUTE = readNumber("NOON_RECAP_MINUTE", 0, 0, 59);

const NOON_RECAP_TIMEZONE = resolveTimeZoneWithFallback(
  process.env.NOON_RECAP_TIMEZONE?.trim(),
  "America/Los_Angeles",
);

const ENABLE_RANDOM_OFFENDER = readBoolean("ENABLE_RANDOM_OFFENDER", true);

const RANDOM_OFFENDER_HOUR = readNumber("RANDOM_OFFENDER_HOUR", 8, 0, 23);

const RANDOM_OFFENDER_MINUTE = readNumber("RANDOM_OFFENDER_MINUTE", 0, 0, 59);

const RANDOM_OFFENDER_TIMEZONE = resolveTimeZoneWithFallback(
  process.env.RANDOM_OFFENDER_TIMEZONE?.trim(),
  "America/Phoenix",
);

const MORNING_WINDOW_END_HOUR = readNumber("MORNING_WINDOW_END_HOUR", 12, 0, 23);

const MORNING_REMINDER_MINUTES = MORNING_REMINDER_HOUR * 60 + MORNING_REMINDER_MINUTE;
const NOON_RECAP_MINUTES = NOON_RECAP_HOUR * 60 + NOON_RECAP_MINUTE;
const RANDOM_OFFENDER_MINUTES = RANDOM_OFFENDER_HOUR * 60 + RANDOM_OFFENDER_MINUTE;

const REMINDER_GRACE_MINUTES = 180;

const FOLLOWUP_GRACE_MINUTES = 180;
const CATCHUP_DEFAULT_HOURS = 12;
const CATCHUP_MIN_HOURS = 1;
const CATCHUP_MAX_HOURS = 168;
const CATCHUP_FETCH_PAGE_SIZE = 100;
const CATCHUP_FETCH_MAX_MESSAGES = 5000;
const DISCORD_MESSAGE_MAX_LENGTH = 2000;

const LOCK_PATH = path.resolve(process.cwd(), "data", "bot.lock");

const POINTS_PER_CHECK_IN = 1;

const PERIOD_TYPES = ["week", "month", "year"];

const PERIOD_HISTORY_LIMITS = {
  week: 16,
  month: 18,
  year: 10,
};

const DEFAULT_LAST_STREAM_DATE_KEY = "2025-04-26";

const DEFAULT_PRESENCE = {
  type: "watching",
  name: "for illegal pre-gm chatter",
};
const DEFAULT_VOICE_PACK_KEY = "fresh";
const AUTO_PRESENCE_MIN_DELAY_MS = 6 * 60 * 60 * 1000;
const AUTO_PRESENCE_MAX_DELAY_MS = 12 * 60 * 60 * 1000;
const AUTO_PRESENCE_OPTIONS = [
  { type: "watching", name: "watching for illegal pre-gm chatter" },
  { type: "watching", name: "the snooze button plot its next move" },
  { type: "watching", name: "the sunrise lose another argument" },
  { type: "watching", name: "for missing gm paperwork" },
  { type: "watching", name: "distant time zones for legal morning" },
  { type: "watching", name: "international dawn behavior" },
  { type: "watching", name: "Mong Plorp origin documentaries" },
  { type: "listening", name: "listening to the sign-in sheet rustle" },
  { type: "watching", name: "tiny sunrise incident reports pile up" },
  { type: "competing", name: "snooze-button defense" },
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
  { type: "playing", name: "playing gm% any%" },
  { type: "playing", name: "playing sunrise compliance" },
  { type: "playing", name: "playing catch fake mornings" },
  { type: "playing", name: "playing snooze button defense" },
  { type: "playing", name: "playing goblin office tycoon" },
  { type: "playing", name: "playing deadline chicken with the sun" },
  { type: "playing", name: "playing spreadsheet goblin deluxe" },
  { type: "playing", name: "playing blame the timezone" },
  { type: "playing", name: "playing staring contest with daylight" },
  { type: "listening", name: "listening to morning excuses" },
  { type: "listening", name: "listening to distant coffee brewing" },
  { type: "listening", name: "listening to tiny administrative screams" },
  { type: "listening", name: "the first yawn of the day" },
  { type: "listening", name: "listening to the sound of legal morning" },
  { type: "listening", name: "goblin praise" },
  { type: "listening", name: "suspicious silence" },
  { type: "listening", name: "listening to the breakfast economy" },
  { type: "listening", name: "listening to a very loud sunrise" },
  { type: "listening", name: "fake productivity" },
  { type: "listening", name: "Dutch complaints" },
  { type: "competing", name: "competing in sunrise compliance" },
  { type: "competing", name: "the anti-sleep division" },
  { type: "competing", name: "the sunrise lobby games" },
  { type: "competing", name: "competing in office goblin finals" },
  { type: "competing", name: "employee-of-the-dawn trials" },
  { type: "competing", name: "illegal-noon prevention" },
  { type: "competing", name: "competing in paperwork endurance" },
  { type: "competing", name: "regional sunrise dominance" },
  { type: "competing", name: "the breakfast board games" },
  { type: "competing", name: "competing in advanced gm studies" },
];
const OFFLINE_AWAY_LINES = [
  "administrative notice: the Morning Goblin is going offline for a bit. remain calm, remain weird, and try not to commit any sunrise crimes while i am gone.",
  "the Morning Goblin will be temporarily unavailable due to important goblin logistics. do not panic. do not form a committee. i will be back.",
  "brief goblin outage: i am clocking out for a while. please continue your nonsense in an orderly fashion until i return.",
  "the goblin is stepping away to recharge, regroup, and argue with the router in a professional tone. i will return when circumstances become less rude.",
  "small scheduling update: i am about to vanish for a bit. this is a temporary goblin situation, not a collapse of civilization.",
];
const OFFLINE_RETURN_LINES = [
  "the Morning Goblin has returned. order has been restored, the clipboard is back, and i am once again available for administrative dawn nonsense.",
  "i have re-emerged from the void. the goblin is back online and already judging the paperwork.",
  "the outage is over. the goblin has returned, lightly caffeinated and professionally suspicious.",
  "good news for weird little citizens everywhere: the Morning Goblin is back online and immediately resuming oversight.",
  "the goblin has returned from its mysterious absence. please clap in a restrained and bureaucratically appropriate manner.",
];
const NOON_RECAP_LINES = [
  "noon recap: {count}/{total} checked in.",
  "noon recap: {count}/{total}. decent paperwork output.",
  "noon recap: {count}/{total}. the goblin has counted the forms.",
  "noon recap: {count}/{total}. continue your lawful little mornings.",
  "noon recap: {count}/{total}. forms reviewed. dawn status pending.",
];
const NOON_RECAP_NO_TOTAL_LINES = [
  "noon recap: {count} checked in.",
  "noon recap: {count} confirmed gm filings.",
  "noon recap: {count} legal morning citizens on the board.",
];
const NOON_RECAP_ZERO_LINES = [
  "noon recap: 0. catastrophic.",
  "noon recap: 0 check-ins. bleak little scenes.",
  "noon recap: zero. the paperwork weeps softly.",
];
const RANDOM_OFFENDER_LINES = [
  "today's randomly selected didn't-say-gm offender is {user}. how dare you.",
  "clipboard lottery results: {user} has been chosen as today's alleged gm evader.",
  "administrative spotlight lands on {user}, today's randomly selected non-gm citizen.",
  "breaking goblin news: {user} has been randomly selected for suspicious lack-of-gm behavior.",
  "the dawn compliance wheel has spoken. today's playful offender is {user}. explain yourself eventually.",
  "by deeply unserious lottery, {user} is today's featured didn't-say-gm goblin criminal.",
  "today's random gm delinquent is {user}. this is going on the tiny clipboard.",
  "goblin raffle update: {user} has won the title of today's no-gm rascal.",
  "official morning misconduct draw: {user}. the clipboard is staring directly at you.",
  "today's randomly chosen sunrise scofflaw is {user}. the clipboard has questions.",
  "the department of dawn nonsense has selected {user} as today's missing-gm character of interest.",
  "tiny public notice: {user} has been randomly selected for possible anti-gm activity.",
  "today's little paperwork goblin finger points at {user}. very suspicious non-gm posture.",
  "the goblin drumroll has concluded: {user} is today's randomly selected gm offender.",
  "random accountability goblin says {user} is today's didn't-say-gm wildcard.",
];
const MORNING_REACTION_EMOJIS = [
  "\u2600\uFE0F",
  "\uD83C\uDF1E",
  "\uD83C\uDF05",
  "\u2615",
  "\uD83E\uDD53",
  "\uD83E\uDD50",
  "\uD83E\uDD5E",
  "\uD83C\uDF69",
  "\uD83E\uDDD0",
];
const EVENING_GREETING_PATTERNS = [
  /\bgood evening\b/i,
  /\bgood night\b/i,
  /\bg['\u2019]?night\b/i,
  /\bgn\b/i,
  /\bevening\b/i,
  /\bnight(?:y)?\b/i,
  /\bsleep well\b/i,
  /\bsweet dreams\b/i,
];
const US_MORNING_START_HOUR = 0;
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

const conversationState = {

  channelLastReply: new Map(),

  userLastReply: new Map(),

  poolBags: new Map(),

};
const messageGuard = new ChannelMessageGuard(() => client.user?.id ?? null);



let morningConfig;

let acceptedStarts;

let acceptedPatterns;

let lockHandle = null;
let currentAutoPresence = null;
let autoPresenceTimeout = null;
let schedulerTickPromise = null;



function readNumber(name, fallback, min, max) {

  const raw = process.env[name];

  const parsed = Number.parseInt(raw ?? "", 10);



  if (Number.isNaN(parsed)) {

    return fallback;

  }



  return Math.min(Math.max(parsed, min), max);

}

function readBoolean(name, fallback) {

  const raw = process.env[name]?.trim().toLowerCase();



  if (!raw) {

    return fallback;

  }



  if (["1", "true", "yes", "on"].includes(raw)) {

    return true;

  }



  if (["0", "false", "no", "off"].includes(raw)) {

    return false;

  }



  return fallback;

}



function resolveDefaultTimeZone(candidate) {

  return isValidTimeZoneName(candidate) ? candidate : FALLBACK_TIMEZONE;

}

function resolveTimeZoneWithFallback(candidate, fallback) {

  return isValidTimeZoneName(candidate) ? candidate : fallback;

}



function isValidTimeZoneName(timeZone) {

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

    recapSent: false,

    randomOffenderSent: false,

    microQuestPrompt: null,

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
      voicePackKey: DEFAULT_VOICE_PACK_KEY,
      microQuestsEnabled: null,
      suppressedCheckInReplyUserIds: [],
      catchupLoggedCheckIns: {},
      records: {
        best: null,
        worst: null,
      },
      points: null,
      offlineNotice: {
        pendingReturn: false,
        channelId: null,
      },
      streaks: {
        users: {},
      },
    };

  }



  if (!Array.isArray(guilds[guildId].suppressedCheckInReplyUserIds)) {
    guilds[guildId].suppressedCheckInReplyUserIds = [];
  }

  if (typeof guilds[guildId].voicePackKey !== "string") {
    guilds[guildId].voicePackKey = DEFAULT_VOICE_PACK_KEY;
  }

  if (
    !("microQuestsEnabled" in guilds[guildId]) ||
    (typeof guilds[guildId].microQuestsEnabled !== "boolean" && guilds[guildId].microQuestsEnabled !== null)
  ) {
    guilds[guildId].microQuestsEnabled = null;
  }

  if (!guilds[guildId].catchupLoggedCheckIns || typeof guilds[guildId].catchupLoggedCheckIns !== "object") {
    guilds[guildId].catchupLoggedCheckIns = {};
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

  if (!guilds[guildId].streaks || typeof guilds[guildId].streaks !== "object") {
    guilds[guildId].streaks = { users: {} };
  }

  if (!guilds[guildId].streaks.users || typeof guilds[guildId].streaks.users !== "object") {
    guilds[guildId].streaks.users = {};
  }

  if (!("pendingReturn" in guilds[guildId].offlineNotice)) {
    guilds[guildId].offlineNotice.pendingReturn = false;
  }

  if (!("channelId" in guilds[guildId].offlineNotice)) {
    guilds[guildId].offlineNotice.channelId = null;
  }

  if (guilds[guildId].daily && typeof guilds[guildId].daily === "object") {
    if (!("recapSent" in guilds[guildId].daily)) {
      guilds[guildId].daily.recapSent = guilds[guildId].daily.followupSent ?? false;
    }

    if (!("randomOffenderSent" in guilds[guildId].daily)) {
      guilds[guildId].daily.randomOffenderSent = false;
    }

    if (!("microQuestPrompt" in guilds[guildId].daily)) {
      guilds[guildId].daily.microQuestPrompt = null;
    }
  }

  return guilds[guildId];
}



function getGuildTimezone(guildState) {

  return isValidTimeZoneName(guildState.timezone) ? guildState.timezone : DEFAULT_TIMEZONE;

}

function getAvailableVoicePackKeys() {
  return Object.keys(morningConfig?.voicePacks ?? { [DEFAULT_VOICE_PACK_KEY]: morningConfig });
}

function getGuildVoicePackKey(guildState) {
  const candidate = guildState?.voicePackKey;

  if (typeof candidate === "string" && morningConfig?.voicePacks?.[candidate]) {
    return candidate;
  }

  return DEFAULT_VOICE_PACK_KEY;
}

function getGuildVoiceConfig(guildState) {
  const key = getGuildVoicePackKey(guildState);
  return morningConfig?.voicePacks?.[key] ?? morningConfig;
}

function getVoicePoolBagKey(guildState, poolName) {
  return `${getGuildVoicePackKey(guildState)}:${poolName}`;
}

function formatTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function validateGuildVoicePack(guildState) {
  if (!morningConfig?.voicePacks?.[guildState.voicePackKey]) {
    guildState.voicePackKey = DEFAULT_VOICE_PACK_KEY;
  }

  return guildState.voicePackKey;
}

function getMicroQuestsEnabled(guildState) {
  return typeof guildState.microQuestsEnabled === "boolean"
    ? guildState.microQuestsEnabled
    : morningConfig.microQuests.enabled;
}

function ensureDailyMicroQuest(guildState, dailyState, options = {}) {
  const { reroll = false } = options;

  if (!getMicroQuestsEnabled(guildState)) {
    return { prompt: null, changed: false };
  }

  const prompts = morningConfig.microQuests.prompts;

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return { prompt: null, changed: false };
  }

  if (reroll || !dailyState.microQuestPrompt || !prompts.includes(dailyState.microQuestPrompt)) {
    dailyState.microQuestPrompt = pickFromPoolBag("microQuests:prompts", prompts);
    return { prompt: dailyState.microQuestPrompt, changed: true };
  }

  return { prompt: dailyState.microQuestPrompt, changed: false };
}

function formatMicroQuestLine(prompt) {
  return prompt ? `micro-quest: ${prompt}` : null;
}

function getPreviousDateKey(dateKey) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() - 1);
  return formatUtcDateKey(date);
}

function ensureStreakState(guildState) {
  if (!guildState.streaks || typeof guildState.streaks !== "object") {
    guildState.streaks = { users: {} };
  }

  if (!guildState.streaks.users || typeof guildState.streaks.users !== "object") {
    guildState.streaks.users = {};
  }

  return guildState.streaks;
}

function updateUserStreak(guildState, userId, dateKey) {
  const streaks = ensureStreakState(guildState);
  const previous = streaks.users[userId] ?? { current: 0, best: 0, lastDateKey: null };

  if (previous.lastDateKey === dateKey) {
    return { type: null, current: previous.current ?? 0, best: previous.best ?? 0 };
  }

  const previousDateKey = getPreviousDateKey(dateKey);
  const continued = previous.lastDateKey === previousDateKey;
  const gapDays = previous.lastDateKey ? getDateKeyDifference(previous.lastDateKey, dateKey) : null;
  const comeback = Boolean(previous.lastDateKey && !continued && gapDays !== null && gapDays > 1);
  const current = continued ? (previous.current ?? 0) + 1 : 1;
  const best = Math.max(previous.best ?? 0, current);

  streaks.users[userId] = {
    current,
    best,
    lastDateKey: dateKey,
  };

  let type = null;

  if (current === 7) {
    type = "sevenDay";
  } else if (current === 3) {
    type = "threeDay";
  } else if (comeback) {
    type = "comeback";
  }

  return {
    type,
    current,
    best,
    previous: previous.current ?? 0,
    gapDays,
  };
}

function buildStreakCelebrationLine(streakEvent, message) {
  if (!streakEvent?.type) {
    return null;
  }

  const pool = morningConfig.streakCelebrations[streakEvent.type] ?? [];

  if (pool.length === 0) {
    return null;
  }

  return formatTemplate(pickFromPoolBag(`streak:${streakEvent.type}`, pool), {
    user: message.member?.displayName || message.author.username,
    streak: streakEvent.current,
    best: streakEvent.best,
    previous: streakEvent.previous,
    gapDays: streakEvent.gapDays ?? 0,
  });
}

function maybeBuildRareShinyReward(message) {
  if (morningConfig.rareShinyReplyChance <= 0 || morningConfig.rareShinyReplies.length === 0) {
    return null;
  }

  if (Math.random() >= morningConfig.rareShinyReplyChance) {
    return null;
  }

  const points = Math.max(0, Math.floor(morningConfig.rareShinyPointReward));

  if (points <= 0) {
    return null;
  }

  const line = formatTemplate(
    formatBotText(pickFromPoolBag("checkin:rareShinyReplies", morningConfig.rareShinyReplies), message),
    { points },
  );

  return { line, points };
}

function buildCheckInBonusLines(message, guildState, dailyState, streakEvent) {
  const lines = [];
  const shinyReward = maybeBuildRareShinyReward(message);
  const streakLine = buildStreakCelebrationLine(streakEvent, message);
  const quest = ensureDailyMicroQuest(guildState, dailyState);
  const questLine = formatMicroQuestLine(quest.prompt);

  if (shinyReward) {
    awardPoint(guildState, message.author.id, dailyState.dateKey, shinyReward.points);
    lines.push(shinyReward.line);
  }

  if (streakLine) {
    lines.push(streakLine);
  }

  if (questLine) {
    lines.push(questLine);
  }

  return lines;
}

function pickWeeklyOfficeTitle() {
  return pickFromPoolBag("officeTitles:weekly", morningConfig.officeTitles.weekly);
}

function getTopScoreUserIds(scores) {
  let topScore = 0;
  let topUserIds = [];

  for (const [userId, score] of Object.entries(scores ?? {})) {
    if (score > topScore) {
      topScore = score;
      topUserIds = [userId];
    } else if (score === topScore && score > 0) {
      topUserIds.push(userId);
    }
  }

  return topUserIds.sort((left, right) => left.localeCompare(right));
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



function parseDateKey(dateKey) {

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

  if (periodType === "week") {
    entry.officeTitle = pickWeeklyOfficeTitle();
  }

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



function ensureStreamTracker() {

  if (!store.state.streamTracker || typeof store.state.streamTracker !== "object") {
    store.state.streamTracker = { lastStreamDateKey: DEFAULT_LAST_STREAM_DATE_KEY };
  }

  if (!parseDateKey(store.state.streamTracker.lastStreamDateKey)) {
    store.state.streamTracker.lastStreamDateKey = DEFAULT_LAST_STREAM_DATE_KEY;
  }

  return store.state.streamTracker;

}



function getDateKeyDifference(fromDateKey, toDateKey) {

  const fromDate = parseDateKey(fromDateKey);
  const toDate = parseDateKey(toDateKey);

  if (!fromDate || !toDate) {
    return null;
  }

  return Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));

}



function parseStreamDateInput(input) {

  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (trimmed === "today") {
    return getZonedParts(new Date(), DEFAULT_TIMEZONE).dateKey;
  }

  if (parseDateKey(trimmed)) {
    return trimmed;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!slashMatch) {
    return null;
  }

  const month = Number.parseInt(slashMatch[1], 10);
  const day = Number.parseInt(slashMatch[2], 10);
  const year = Number.parseInt(slashMatch[3], 10);

  const normalized = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

  return parseDateKey(normalized) ? normalized : null;

}



function buildStreamGapMessage(daysSinceLastStream, lastStreamDateKey) {

  if (daysSinceLastStream === 0) {
    return pickFromPoolBag("stream:status:today", [
      `stream activity confirmed today (${lastStreamDateKey}). the drought paperwork has been shredded.`,
      `the last stream was today (${lastStreamDateKey}). the goblin has stopped counting for now.`,
    ]);
  }

  const dayWord = daysSinceLastStream === 1 ? "day" : "days";

  const templates = [
    `it has been ${daysSinceLastStream} ${dayWord} since the last stream on ${lastStreamDateKey}. the drought paperwork is thriving.`,
    `${daysSinceLastStream} ${dayWord} since stream activity. last confirmed incident: ${lastStreamDateKey}.`,
    `current stream drought: ${daysSinceLastStream} ${dayWord}. the last known stream was ${lastStreamDateKey}.`,
    `the goblin records show ${daysSinceLastStream} ${dayWord} since the last stream (${lastStreamDateKey}). grim but well-documented.`,
  ];

  return pickFromPoolBag("stream:status", templates);

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



  if (!savedPresence?.name || parsePresenceType(savedPresence.type) === null) {

    return null;

  }



  return {

    type: savedPresence.type,

    name: savedPresence.name,

  };

}



function getNextAutoPresence() {

  const nextPresence = pickFromPoolBag("presence:autoRotation", AUTO_PRESENCE_OPTIONS);



  if (!nextPresence?.name || parsePresenceType(nextPresence.type) === null) {

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

  const displayPrefixes = {
    playing: "playing",
    watching: "watching",
    listening: "listening to",
    competing: "competing in",
  };

  return `\`${displayPrefixes[presence.type]} ${getDiscordActivityName(presence)}\``;

}

function getDiscordActivityName(presence) {
  const removablePrefixes = {
    playing: ["playing "],
    watching: ["watching "],
    listening: ["listening to ", "to "],
    competing: ["competing in ", "in "],
  };
  const normalizedName = presence.name.toLowerCase();
  const prefix = (removablePrefixes[presence.type] ?? []).find((candidate) =>
    normalizedName.startsWith(candidate),
  );

  return prefix ? presence.name.slice(prefix.length) : presence.name;
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

        name: getDiscordActivityName(presence),

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

  return "check-in reply suppression list: " + formatRoster(suppressed.map((userId) => `<@${userId}>`));
}

function formatRoster(names) {

  const limit = 20;



  if (names.length <= limit) {

    return names.join(", ");

  }



  const shown = names.slice(0, limit).join(", ");

  return `${shown}, and ${names.length - limit} more`;

}

function formatMentionRoster(userIds, limit = 20) {
  const displayedUserIds = userIds.slice(0, limit);
  const mentions = displayedUserIds.map((userId) => `<@${userId}>`);
  const overflow = userIds.length - displayedUserIds.length;

  return {
    text: overflow > 0 ? `${mentions.join(" ")} and ${overflow} more` : mentions.join(" "),
    userIds: displayedUserIds,
  };
}

async function formatUserRoster(guild, userIds, limit = 20, resolveLabel = null) {
  const displayedUserIds = userIds.slice(0, limit);
  const getLabel = resolveLabel ?? createUserDisplayLabelResolver(guild);
  const names = await Promise.all(displayedUserIds.map(getLabel));
  const overflow = userIds.length - displayedUserIds.length;

  return overflow > 0 ? `${names.join(", ")}, and ${overflow} more` : names.join(", ");
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

function getCatchupLoggedCheckInsForDate(guildState, dateKey) {
  if (!guildState.catchupLoggedCheckIns || typeof guildState.catchupLoggedCheckIns !== "object") {
    guildState.catchupLoggedCheckIns = {};
  }

  if (!guildState.catchupLoggedCheckIns[dateKey] || typeof guildState.catchupLoggedCheckIns[dateKey] !== "object") {
    guildState.catchupLoggedCheckIns[dateKey] = {};
  }

  return guildState.catchupLoggedCheckIns[dateKey];
}

function wasCatchupLogged(guildState, dateKey, userId) {
  return Boolean(guildState.catchupLoggedCheckIns?.[dateKey]?.[userId]);
}

function markCatchupLogged(guildState, dateKey, userId, sourceMessage) {
  const dateLogs = getCatchupLoggedCheckInsForDate(guildState, dateKey);
  dateLogs[userId] = {
    messageId: sourceMessage.id,
    channelId: sourceMessage.channelId,
    timestamp: sourceMessage.createdTimestamp,
  };
}

function awardHistoricalCatchupPoint(guildState, userId, dateKey, activeDateKey) {
  const pointsState = ensurePointsState(guildState, activeDateKey);
  const pointKeys = getPeriodKeys(dateKey);

  pointsState.lifetime[userId] = (pointsState.lifetime[userId] ?? 0) + POINTS_PER_CHECK_IN;

  for (const periodType of PERIOD_TYPES) {
    const periodState = pointsState.periods[periodType];

    if (periodState.key === pointKeys[periodType]) {
      periodState.scores[userId] = (periodState.scores[userId] ?? 0) + POINTS_PER_CHECK_IN;
    }
  }
}

function isEveningGreetingMessage(content) {

  const normalized = cleanMessageContent(content).toLowerCase();



  if (!normalized) {

    return false;

  }



  return EVENING_GREETING_PATTERNS.some((pattern) => pattern.test(normalized));

}



function isWakeWordMessage(content, guildState) {

  const normalized = cleanMessageContent(content).toLowerCase();



  if (!normalized) {

    return false;

  }



  return getGuildVoiceConfig(guildState).conversation.wakeWords.some((wakeWord) =>
    containsPhrase(normalized, wakeWord),
  );

}



function getMatchingKeywordReply(message, guildState) {
  const conversationConfig = getGuildVoiceConfig(guildState).conversation;
  const rule = findMatchingKeywordRule(
    message.content,
    conversationConfig.wakeWords,
    conversationConfig.keywordRules,
  );

  if (!rule) {
    return null;
  }

  const poolKey = `conversation:keyword:${rule.triggers[0]}`;
  return formatBotText(
    pickFromPoolBag(getVoicePoolBagKey(guildState, poolKey), rule.replies),
    message,
  );

}



function getMentionReply(message, guildState) {

  return formatBotText(

    pickFromPoolBag(
      getVoicePoolBagKey(guildState, "conversation:mentionReplies"),
      getGuildVoiceConfig(guildState).conversation.mentionReplies,
    ),

    message,

  );

}



function getGenericReply(message, guildState) {

  return formatBotText(

    pickFromPoolBag(
      getVoicePoolBagKey(guildState, "conversation:genericReplies"),
      getGuildVoiceConfig(guildState).conversation.genericReplies,
    ),

    message,

  );

}



function isConversationCoolingDown(message, guildState) {

  const now = Date.now();

  const conversationConfig = getGuildVoiceConfig(guildState).conversation;

  const channelCooldownMs = conversationConfig.channelCooldownSeconds * 1000;

  const userCooldownMs = conversationConfig.userCooldownSeconds * 1000;

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
  const guildState = ensureGuildState(message.guild.id);
  const conversationConfig = getGuildVoiceConfig(guildState).conversation;

  if (!conversationConfig.enabled) {
    return null;
  }

  const directlyMentioned = message.mentions.users.has(client.user.id);

  if (directlyMentioned) {
    const keywordReply = getMatchingKeywordReply(message, guildState);
    return keywordReply ?? getMentionReply(message, guildState);
  }

  if (isConversationCoolingDown(message, guildState)) {
    return null;
  }

  if (await isReplyToBot(message)) {
    const keywordReply = getMatchingKeywordReply(message, guildState);
    return keywordReply ?? getGenericReply(message, guildState);
  }

  if (isWakeWordMessage(message.content, guildState)) {
    const keywordReply = getMatchingKeywordReply(message, guildState);
    return keywordReply ?? getGenericReply(message, guildState);
  }

  return null;
}



async function maybeHandleConversation(message) {

  if (message.mentions.users.has(client.user.id) && isEveningGreetingMessage(message.content)) {
    try {
      await message.react("\uD83C\uDF19");
    } catch {
      // Reactions are optional sugar.
    }

    return true;
  }

  const guildState = ensureGuildState(message.guild.id);
  const conversationConfig = getGuildVoiceConfig(guildState).conversation;

  if (isSilenceRequest(message.content, conversationConfig.wakeWords, morningConfig.acceptedStarts)) {
    const directedAtBot =
      message.mentions.users.has(client.user.id) ||
      isWakeWordMessage(message.content, guildState) ||
      await isReplyToBot(message);

    if (directedAtBot) {
      return true;
    }
  }

  const reply = await getConversationReply(message);



  if (!reply) {

    return false;

  }



  const sent = await safeSend(message.channel, reply);

  if (sent) {
    markConversationReply(message);
  }

  return Boolean(sent);

}



async function reloadMorningConfig() {

  morningConfig = await loadMorningConfig();

  acceptedStarts = normalizeAcceptedStarts(morningConfig.acceptedStarts);

  acceptedPatterns = morningConfig.acceptedPatterns.map((pattern) => new RegExp(pattern, "i"));

  let stateChanged = false;

  for (const guildState of Object.values(store.state.guilds ?? {})) {
    const previousVoicePackKey = guildState.voicePackKey;
    validateGuildVoicePack(guildState);

    if (guildState.voicePackKey !== previousVoicePackKey) {
      stateChanged = true;
    }
  }

  if (stateChanged) {
    await store.save();
  }

}



async function getMorningChannel(guild) {

  const guildState = ensureGuildState(guild.id);



  if (!guildState.morningChannelId) {

    return null;

  }



  try {

    const channel = await guild.channels.fetch(guildState.morningChannelId);



    if (!channel || !isChannelInGuild(channel, guild) || !channel.isTextBased()) {

      return null;

    }



    return channel;

  } catch {

    return null;

  }

}

function isChannelInGuild(channel, guild) {

  return channel?.guildId === guild.id || channel?.guild?.id === guild.id;

}

function getPendingReturnStateForChannel(channel) {
  const guildId = channel?.guildId ?? channel?.guild?.id;

  if (!guildId) {
    return null;
  }

  const guildState = ensureGuildState(guildId);

  return guildState.offlineNotice?.pendingReturn &&
    guildState.offlineNotice.channelId === channel.id
    ? guildState
    : null;
}

async function deliverBotPayload(channel, payload, sendPayload, options = {}) {
  const { prependPendingReturn = true } = options;
  let pendingReturnState = null;
  let didPrependPendingReturn = false;

  const sent = await messageGuard.send(channel, () => {
    pendingReturnState = prependPendingReturn
      ? getPendingReturnStateForChannel(channel)
      : null;
    let preparedPayload = payload;

    if (pendingReturnState && typeof payload.content === "string") {
      const returnLine = pickFromPoolBag("offline:returnLines", OFFLINE_RETURN_LINES);
      const combinedContent = `${returnLine}\n${payload.content}`;

      if (combinedContent.length <= DISCORD_MESSAGE_MAX_LENGTH) {
        preparedPayload = { ...payload, content: combinedContent };
        didPrependPendingReturn = true;
      }
    }

    return sendPayload(preparedPayload);
  });

  if (sent && didPrependPendingReturn && pendingReturnState?.offlineNotice?.pendingReturn) {
    pendingReturnState.offlineNotice.pendingReturn = false;
    pendingReturnState.offlineNotice.channelId = null;
    await store.save();
  }

  return sent;
}

function sendBotPayload(channel, payload, options) {
  return deliverBotPayload(channel, payload, (preparedPayload) => channel.send(preparedPayload), options);
}

function safeReply(message, payload) {
  return deliverBotPayload(
    message.channel,
    payload,
    (preparedPayload) => message.reply(preparedPayload),
  );
}



async function safeSend(channel, content) {

  return sendBotPayload(channel, {

    content,

    allowedMentions: { parse: [] },

  });

}



async function getOfflineNoticeChannel(guild, guildState) {

  const preferredChannelId = guildState.offlineNotice?.channelId;

  if (preferredChannelId) {
    try {
      const preferredChannel = await guild.channels.fetch(preferredChannelId);

      if (preferredChannel && isChannelInGuild(preferredChannel, guild) && preferredChannel.isTextBased()) {
        return preferredChannel;
      }
    } catch {
      // Fall back to the configured morning channel.
    }
  }

  const fallbackChannel = await getMorningChannel(guild);

  if (fallbackChannel && guildState.offlineNotice?.pendingReturn) {
    guildState.offlineNotice.channelId = fallbackChannel.id;
  }

  return fallbackChannel;

}



async function announcePendingReturnMessage(guild) {
  const guildState = ensureGuildState(guild.id);

  if (!guildState.offlineNotice?.pendingReturn) {
    return false;
  }

  const targetChannel = await getOfflineNoticeChannel(guild, guildState);

  if (!targetChannel) {
    return false;
  }

  try {
    const sent = await sendBotPayload(
      targetChannel,
      {
        content: pickFromPoolBag("offline:returnLines", OFFLINE_RETURN_LINES),
        allowedMentions: { parse: [] },
      },
      { prependPendingReturn: false },
    );

    if (!sent) {
      return false;
    }
  } catch (error) {
    console.error("Failed to send return notice:", error);
    return false;
  }

  guildState.offlineNotice.pendingReturn = false;
  guildState.offlineNotice.channelId = null;
  await store.save();
  return true;
}

async function announcePendingReturnMessages() {
  for (const guild of client.guilds.cache.values()) {
    await announcePendingReturnMessage(guild);
  }
}



async function postReminder(guild) {
  const guildState = ensureGuildState(guild.id);
  const timeZone = getGuildTimezone(guildState);
  const dailyState = ensureDailyState(guildState, getZonedParts(new Date(), timeZone).dateKey);
  const voiceConfig = getGuildVoiceConfig(guildState);

  const channel = await getMorningChannel(guild);



  if (!channel) {

    return false;

  }

  const quest = ensureDailyMicroQuest(guildState, dailyState);

  if (quest.changed) {
    await store.save();
  }

  const questLine = formatMicroQuestLine(quest.prompt);
  const reminderLine = pickRandom(voiceConfig.reminderLines);
  const content = questLine ? `${reminderLine}\n${questLine}` : reminderLine;

  return Boolean(await safeSend(channel, content));

}



async function getHumanMemberCount(guild) {

  try {

    await guild.members.fetch();

  } catch {

    return null;

  }



  return guild.members.cache.filter((member) => !member.user.bot).size;

}

async function buildWeeklyTitleWatchLine(guild, guildState) {
  const todayKey = getZonedParts(new Date(), getGuildTimezone(guildState)).dateKey;
  const pointsState = ensurePointsState(guildState, todayKey);
  const leaderUserIds = getTopScoreUserIds(pointsState.periods.week.scores);

  if (leaderUserIds.length === 0) {
    return null;
  }

  const leaderRoster = await formatUserRoster(guild, leaderUserIds, 10);

  const title = pickWeeklyOfficeTitle();
  const verb = leaderUserIds.length === 1 ? "is" : "are";

  return `weekly title watch: ${leaderRoster} ${verb} currently serving as ${title}.`;
}

async function appendWeeklyTitleWatch(guild, guildState, recap) {
  if (
    morningConfig.weeklyTitleWatchChance <= 0 ||
    Math.random() >= morningConfig.weeklyTitleWatchChance
  ) {
    return recap;
  }

  const weeklyTitleLine = await buildWeeklyTitleWatchLine(guild, guildState);
  return weeklyTitleLine ? `${recap}\n${weeklyTitleLine}` : recap;
}



async function buildNoonRecapMessage(guild, dailyState) {
  const guildState = ensureGuildState(guild.id);

  const checkInCount = Object.keys(dailyState.checkIns).length;



  if (checkInCount === 0) {

    return appendWeeklyTitleWatch(guild, guildState, pickFromPoolBag("recap:zero", NOON_RECAP_ZERO_LINES));

  }



  const totalHumans = await getHumanMemberCount(guild);



  if (!totalHumans) {

    return appendWeeklyTitleWatch(
      guild,
      guildState,
      pickFromPoolBag("recap:noTotal", NOON_RECAP_NO_TOTAL_LINES).replace("{count}", String(checkInCount)),
    );

  }



  return appendWeeklyTitleWatch(
    guild,
    guildState,
    pickFromPoolBag("recap:withTotal", NOON_RECAP_LINES)
      .replace("{count}", String(checkInCount))
      .replace("{total}", String(totalHumans)),
  );

}



async function postNoonRecap(guild) {
  const guildState = ensureGuildState(guild.id);
  const timeZone = getGuildTimezone(guildState);
  const dailyState = ensureDailyState(guildState, getZonedParts(new Date(), timeZone).dateKey);
  const channel = await getMorningChannel(guild);

  if (!channel) {
    return false;
  }

  const recapMessage = await buildNoonRecapMessage(guild, dailyState);
  const checkInCount = Object.keys(dailyState.checkIns).length;
  const previousBest = guildState.records?.best;
  const isNewBest = checkInCount > 0 && (!previousBest || checkInCount > previousBest.count);
  const celebration = isNewBest ? buildNewBestCelebration(dailyState) : null;
  const recapSent = celebration
    ? await sendBotPayload(channel, {
        content: `${recapMessage}\n${celebration.content}`,
        allowedMentions: { parse: [], users: celebration.userIds },
      })
    : await safeSend(channel, recapMessage);

  if (!recapSent) {
    return false;
  }

  updateRecords(guildState, dailyState);

  return true;
}

async function getUncheckedHumanMembers(guild, dailyState) {
  try {
    await guild.members.fetch();
  } catch {
    return null;
  }

  return [...guild.members.cache.values()].filter(
    (member) => !member.user.bot && !dailyState.checkIns[member.id],
  );
}

async function postRandomOffenderCallout(guild) {
  const guildState = ensureGuildState(guild.id);
  const timeZone = getGuildTimezone(guildState);
  const dailyState = ensureDailyState(guildState, getZonedParts(new Date(), timeZone).dateKey);
  const channel = await getMorningChannel(guild);

  if (!channel) {
    return { handled: false };
  }

  const uncheckedMembers = await getUncheckedHumanMembers(guild, dailyState);

  if (!uncheckedMembers) {
    return { handled: false };
  }

  if (uncheckedMembers.length === 0) {
    return { handled: true, sent: false };
  }

  const selectedMember = pickRandom(uncheckedMembers);
  const line = pickFromPoolBag("offender:lines", RANDOM_OFFENDER_LINES)
    .replace("{user}", `<@${selectedMember.id}>`);
  const sent = await sendBotPayload(channel, {
    content: line,
    allowedMentions: { parse: [], users: [selectedMember.id] },
  });

  if (!sent) {
    return { handled: false };
  }

  return { handled: true, sent: true };
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

  const contributorRoster = formatMentionRoster(contributors);
  const templates = [
    `new all-time gm record: ${count}. applause for the dawn athletes: ${contributorRoster.text}`,
    `record shattered. ${count} check-ins. the morning goblin salutes ${contributorRoster.text}`,
    `historic sunrise behavior detected. ${count} people checked in. medals to ${contributorRoster.text}`,
    `the books have been rewritten: ${count} check-ins. celebratory paperwork for ${contributorRoster.text}`,
    `brand-new morning record. ${count} legal dawn participants. screaming professionally for ${contributorRoster.text}`,
  ];

  return {
    content: pickFromPoolBag("records:newBestCelebrations", templates),
    userIds: contributorRoster.userIds,
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

  const winnerRoster = formatMentionRoster(entry.winnerUserIds);
  const winners = winnerRoster.text;
  const pointsText = formatPointsWord(entry.points);
  const label = formatPeriodLabel(entry.periodType, entry.periodKey);
  const championWord = entry.winnerUserIds.length === 1 ? "champion" : "co-champions";
  const titleText = entry.officeTitle ? ` official title: ${entry.officeTitle}.` : "";

  let templates = [];

  switch (entry.periodType) {
    case "week":
      templates = [
        `weekly good morning ${championWord} for the ${label}: ${winners} with ${pointsText}.${titleText} the goblin salutes your sustained sunrise paperwork.`,
        `the weekly dawn title for the ${label} goes to ${winners} with ${pointsText}.${titleText} an incredible seven-day display of administrative discipline.`,
        `weekly gm throne claimed for the ${label}: ${winners}, posting ${pointsText}.${titleText} the blankets have filed an appeal.`,
      ];
      break;

    case "month":
      templates = [
        `monthly good morning ${championWord} for ${label}: ${winners} with ${pointsText}. the goblin is filing this under elite long-term sunrise behavior.`,
        `${label} belongs to ${winners}, our monthly dawn ${championWord}, with ${pointsText}. absurdly consistent morning paperwork.`,
        `monthly sunrise crown awarded for ${label}: ${winners} with ${pointsText}. the forms themselves are applauding.`,
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
    userIds: winnerRoster.userIds,
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

    const sent = await sendBotPayload(channel, {
      content: announcement.content,
      allowedMentions: { parse: [], users: announcement.userIds },
    });

    if (!sent) {
      const unsentIndex = pending.indexOf(entry);
      guildState.points.pendingAnnouncements = pending.slice(unsentIndex);
      await store.save();
      return false;
    }
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

function createUserDisplayLabelResolver(guild) {
  const pendingLabels = new Map();

  return (userId) => {
    if (!pendingLabels.has(userId)) {
      pendingLabels.set(userId, getUserDisplayLabel(guild, userId));
    }

    return pendingLabels.get(userId);
  };
}



async function formatScoreboard(guild, scores, limit = 5, resolveLabel = null) {

  const entries = getSortedScoreEntries(scores).slice(0, limit);



  if (entries.length === 0) {

    return "nobody yet";

  }



  const getLabel = resolveLabel ?? createUserDisplayLabelResolver(guild);
  const formatted = await Promise.all(
    entries.map(async ([userId, score]) => `${await getLabel(userId)} (${score})`),
  );

  return formatted.join(", ");

}

function normalizeChannelName(name) {
  return (name ?? "").normalize("NFKC").replace(/\uFE0F/g, "").toLowerCase();
}

function isRankCheckChannel(channel) {
  if (!channel) {
    return false;
  }

  if (RANK_CHECK_CHANNEL_ID && channel.id === RANK_CHECK_CHANNEL_ID) {
    return true;
  }

  return normalizeChannelName(channel.name) === normalizeChannelName(RANK_CHECK_CHANNEL_NAME);
}

function findRankCheckChannel(guild) {
  if (RANK_CHECK_CHANNEL_ID) {
    return guild.channels.cache.get(RANK_CHECK_CHANNEL_ID) ?? null;
  }

  return guild.channels.cache.find((channel) => isRankCheckChannel(channel)) ?? null;
}

function getScoreRank(scores, userId) {
  const userScore = scores?.[userId] ?? 0;

  if (userScore <= 0) {
    return null;
  }

  const scoreValues = Object.values(scores ?? {});
  let higherScores = 0;
  let tiedScores = 0;

  for (const score of scoreValues) {
    if (score > userScore) {
      higherScores += 1;
    } else if (score === userScore) {
      tiedScores += 1;
    }
  }

  return {
    rank: higherScores + 1,
    tiedCount: tiedScores,
    totalRanked: scoreValues.length,
    score: userScore,
  };
}

function formatRankLine(label, rankInfo) {
  if (!rankInfo) {
    return `${label}: unranked`;
  }

  const otherTies = rankInfo.tiedCount - 1;
  const tieNote = otherTies > 0
    ? ` (tied with ${otherTies} ${otherTies === 1 ? "other" : "others"})`
    : "";
  return `${label}: #${rankInfo.rank} of ${rankInfo.totalRanked}${tieNote}`;
}

async function postUserStats(message) {
  if (!isRankCheckChannel(message.channel)) {
    const rankChannel = findRankCheckChannel(message.guild);
    const content = rankChannel
      ? `stats paperwork lives in <#${rankChannel.id}>. please take your little leaderboard goblin business over there.`
      : `stats are restricted to #${RANK_CHECK_CHANNEL_NAME}, but i cannot find that channel right now. an admin should create it or check \`RANK_CHECK_CHANNEL_NAME\`.`;

    await safeReply(message, {
      content,
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const todayKey = getZonedParts(new Date(), timeZone).dateKey;
  ensureDailyState(guildState, todayKey);

  const pointsState = ensurePointsState(guildState, todayKey);
  const userId = message.author.id;
  const lifetimePoints = pointsState.lifetime[userId] ?? 0;
  const lifetimeRank = getScoreRank(pointsState.lifetime, userId);
  const weekPoints = pointsState.periods.week.scores[userId] ?? 0;
  const monthPoints = pointsState.periods.month.scores[userId] ?? 0;
  const yearPoints = pointsState.periods.year.scores[userId] ?? 0;
  const displayName = message.member?.displayName || message.author.username;

  await safeReply(message, {
    content: [
      `gm stats for ${displayName}:`,
      `all-time: ${formatPointsWord(lifetimePoints)}`,
      formatRankLine("all-time rank", lifetimeRank),
      `this week: ${formatPointsWord(weekPoints)}`,
      `this month: ${formatPointsWord(monthPoints)}`,
      `this year: ${formatPointsWord(yearPoints)}`,
    ].join("\n"),
    allowedMentions: { repliedUser: false, parse: [] },
  });
}



async function formatChampionSummary(guild, entry, resolveLabel = null) {

  if (!entry || !Array.isArray(entry.winnerUserIds) || entry.winnerUserIds.length === 0) {
    return null;
  }

  const winnerRoster = await formatUserRoster(guild, entry.winnerUserIds, 5, resolveLabel);

  const titleText = entry.officeTitle ? `, ${entry.officeTitle}` : "";

  return `${winnerRoster} with ${formatPointsWord(entry.points)}${titleText} (${formatPeriodLabel(entry.periodType, entry.periodKey)})`;

}



async function postPoints(message) {

  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const todayKey = getZonedParts(new Date(), timeZone).dateKey;
  ensureDailyState(guildState, todayKey);

  const pointsState = ensurePointsState(guildState, todayKey);
  const resolveLabel = createUserDisplayLabelResolver(message.guild);
  const [weekBoard, monthBoard, yearBoard, lifetimeBoard, ...championSummaries] =
    await Promise.all([
      formatScoreboard(message.guild, pointsState.periods.week.scores, 3, resolveLabel),
      formatScoreboard(message.guild, pointsState.periods.month.scores, 3, resolveLabel),
      formatScoreboard(message.guild, pointsState.periods.year.scores, 3, resolveLabel),
      formatScoreboard(message.guild, pointsState.lifetime, 5, resolveLabel),
      ...PERIOD_TYPES.map((periodType) =>
        formatChampionSummary(
          message.guild,
          pointsState.history[periodType]?.[0],
          resolveLabel,
        ),
      ),
    ]);
  const lines = [
    "gm points board:",
    `this week (${formatPeriodLabel("week", pointsState.periods.week.key)}): ${weekBoard}`,
    `this month (${formatPeriodLabel("month", pointsState.periods.month.key)}): ${monthBoard}`,
    `this year (${formatPeriodLabel("year", pointsState.periods.year.key)}): ${yearBoard}`,
    `lifetime: ${lifetimeBoard}`,
  ];

  for (const [index, summary] of championSummaries.entries()) {
    if (summary) {
      const labels = ["weekly", "monthly", "yearly"];
      lines.push(`previous ${labels[index]} champion: ${summary}`);
    }
  }

  await safeReply(message, {
    content: lines.join("\n"),
    allowedMentions: { repliedUser: false, parse: [] },
  });

}



async function postStreamStatus(message) {

  const tracker = ensureStreamTracker();
  const todayKey = getZonedParts(new Date(), DEFAULT_TIMEZONE).dateKey;
  const daysSinceLastStream = getDateKeyDifference(tracker.lastStreamDateKey, todayKey);

  await safeReply(message, {
    content: buildStreamGapMessage(daysSinceLastStream ?? 0, tracker.lastStreamDateKey),
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


    await safeReply(message, {
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

  await safeReply(message, {
    content: lines.join("\n"),
    allowedMentions: { repliedUser: false, parse: [] },
  });
}



function recordCheckIn(guildState, dateKey, userId, entry) {

  const dailyState = ensureDailyState(guildState, dateKey);
  const alreadyCheckedIn = Boolean(dailyState.checkIns[userId]);

  dailyState.checkIns[userId] = entry;
  delete dailyState.nudgedUsers[userId];

  const streakEvent = alreadyCheckedIn ? null : updateUserStreak(guildState, userId, dateKey);

  if (!alreadyCheckedIn) {
    awardPoint(guildState, userId, dateKey);
  }

  return {
    dailyState,
    alreadyCheckedIn,
    totalCheckIns: Object.keys(dailyState.checkIns).length,
    pointsAwarded: alreadyCheckedIn ? 0 : POINTS_PER_CHECK_IN,
    streakEvent,
  };

}



async function maybeCelebrateCheckIn(message, guildState, alreadyCheckedIn, totalCheckIns, options = {}) {
  const { ignoreQuietList = false, bonusLines = [] } = options;

  await reactToCheckInMessage(message);

  if (!ignoreQuietList && guildState.suppressedCheckInReplyUserIds.includes(message.author.id)) {
    return;
  }

  const voiceConfig = getGuildVoiceConfig(guildState);
  const reply = alreadyCheckedIn
    ? pickFromPoolBag(getVoicePoolBagKey(guildState, "checkin:duplicateReplies"), voiceConfig.duplicateReplies)
    : [
        `${pickFromPoolBag(getVoicePoolBagKey(guildState, "checkin:checkInReplies"), voiceConfig.checkInReplies)} (${totalCheckIns} logged today.)`,
        ...bonusLines,
      ].join("\n");

  await safeReply(message, {
    content: reply,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}



async function maybeNudge(message, guildState, dailyState, nowMinutes) {

  const endMinutes = MORNING_WINDOW_END_HOUR * 60 + 59;



  if (nowMinutes < MORNING_REMINDER_MINUTES || nowMinutes > endMinutes) {

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

  const reply = pickRandom(getGuildVoiceConfig(guildState).nudgeReplies).replace("{channel}", channelMention);



  await safeReply(message, {

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

    if (!channel || !isChannelInGuild(channel, guild) || !channel.isTextBased() || !("messages" in channel)) {
      return null;
    }

    return channel.messages.fetch(messageId);
  } catch {
    return null;
  }
}

function buildHistoricalCheckInEntry(sourceMessage, sourceMember, fallbackText) {
  return {
    displayName: sourceMember?.displayName || sourceMessage.author.username,
    timestamp: sourceMessage.createdTimestamp,
    channelId: sourceMessage.channelId,
    message: sourceMessage.content || fallbackText,
  };
}

function parseCatchupHours(input) {
  const trimmed = input.trim();

  if (!trimmed) {
    return CATCHUP_DEFAULT_HOURS;
  }

  const match = trimmed.match(/^(\d+)\s*(h|hr|hrs|hour|hours|d|day|days)?$/i);

  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  const unit = match[2]?.toLowerCase() ?? "h";
  const hours = unit.startsWith("d") ? parsed * 24 : parsed;

  if (Number.isNaN(hours) || hours < CATCHUP_MIN_HOURS || hours > CATCHUP_MAX_HOURS) {
    return null;
  }

  return hours;
}

async function fetchRecentMessagesSince(channel, cutoffTimestamp) {
  if (!("messages" in channel)) {
    return [];
  }

  const collected = [];
  let before = null;

  while (collected.length < CATCHUP_FETCH_MAX_MESSAGES) {
    const page = await channel.messages.fetch({
      limit: Math.min(CATCHUP_FETCH_PAGE_SIZE, CATCHUP_FETCH_MAX_MESSAGES - collected.length),
      ...(before ? { before } : {}),
    });

    if (page.size === 0) {
      break;
    }

    const pageMessages = [...page.values()];
    collected.push(...pageMessages);

    const oldestMessage = pageMessages[pageMessages.length - 1];

    if (!oldestMessage || oldestMessage.createdTimestamp < cutoffTimestamp || page.size < CATCHUP_FETCH_PAGE_SIZE) {
      break;
    }

    before = oldestMessage.id;
  }

  return collected.filter((sourceMessage) => sourceMessage.createdTimestamp >= cutoffTimestamp);
}

function collectBotReplyReferenceIds(messages) {
  const referencedMessageIds = new Set();

  for (const sourceMessage of messages) {
    if (sourceMessage.author.id === client.user.id && sourceMessage.reference?.messageId) {
      referencedMessageIds.add(sourceMessage.reference.messageId);
    }
  }

  return referencedMessageIds;
}

async function hasBotReaction(sourceMessage) {
  if (!client.user || sourceMessage.reactions.cache.size === 0) {
    return false;
  }

  for (const reaction of sourceMessage.reactions.cache.values()) {
    if (reaction.me || reaction.users.cache.has(client.user.id)) {
      return true;
    }

    try {
      const users = await reaction.users.fetch();

      if (users.has(client.user.id)) {
        return true;
      }
    } catch {
      // Missing reaction permissions should not block the rest of the catch-up scan.
    }
  }

  return false;
}

async function wasAlreadyProcessedByBot(sourceMessage, botReplyReferenceIds) {
  return botReplyReferenceIds.has(sourceMessage.id) || (await hasBotReaction(sourceMessage));
}

async function reactToCheckInMessage(sourceMessage) {
  try {
    await sourceMessage.react(pickFromPoolBag("checkin:reactionEmojis", MORNING_REACTION_EMOJIS));
    return true;
  } catch {
    return false;
  }
}

async function handleCatchupScan(message, body) {
  const guildState = ensureGuildState(message.guild.id);
  const channel = await getMorningChannel(message.guild);

  if (!channel || !("messages" in channel)) {
    await safeReply(message, {
      content: "i do not have a valid morning channel to scan. set one first with `" + COMMAND_PREFIX + " here`.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const input = body.slice("catchup".length).trim();
  const hours = parseCatchupHours(input);

  if (hours === null) {
    await safeReply(message, {
      content: "use `" + COMMAND_PREFIX + " catchup 72` or `" + COMMAND_PREFIX + " catchup 3d`. max window is 168 hours.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const timeZone = getGuildTimezone(guildState);
  const activeDateKey = getZonedParts(new Date(), timeZone).dateKey;
  const cutoffTimestamp = Date.now() - (hours * 60 * 60 * 1000);
  const recentMessages = await fetchRecentMessagesSince(channel, cutoffTimestamp).catch(() => null);

  if (!recentMessages) {
    await safeReply(message, {
      content: "i could not read recent history from the morning channel. this usually means my channel permissions are being theatrical.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const orderedMessages = recentMessages.sort((left, right) => left.createdTimestamp - right.createdTimestamp);
  const botReplyReferenceIds = collectBotReplyReferenceIds(orderedMessages);

  const stats = {
    scanned: orderedMessages.length,
    validMorningMessages: 0,
    logged: 0,
    alreadyLogged: 0,
    outsideUsMorning: 0,
    dates: new Set(),
    inactivePeriodPoints: 0,
    failures: 0,
  };

  for (const sourceMessage of orderedMessages) {
    if (sourceMessage.author.bot || !isGoodMorningMessage(sourceMessage.content)) {
      continue;
    }

    stats.validMorningMessages += 1;

    const sourceDate = new Date(sourceMessage.createdTimestamp);
    const sourceDateKey = getZonedParts(sourceDate, timeZone).dateKey;

    if (!isMorningSomewhereInUnitedStates(sourceDate)) {
      stats.outsideUsMorning += 1;
      continue;
    }

    const targetUserId = sourceMessage.author.id;

    const dailyState = sourceDateKey === activeDateKey ? ensureDailyState(guildState, activeDateKey) : null;
    const alreadyInDailyState = Boolean(dailyState?.checkIns[targetUserId]);
    const alreadyInCatchupState = wasCatchupLogged(guildState, sourceDateKey, targetUserId);
    const alreadyProcessedByBot = await wasAlreadyProcessedByBot(sourceMessage, botReplyReferenceIds);

    if (alreadyInDailyState || alreadyInCatchupState || alreadyProcessedByBot) {
      stats.alreadyLogged += 1;
      continue;
    }

    const sourceMember = sourceMessage.member ?? (await message.guild.members.fetch(targetUserId).catch(() => null));

    if (sourceDateKey === activeDateKey) {
      recordCheckIn(
        guildState,
        activeDateKey,
        targetUserId,
        buildHistoricalCheckInEntry(sourceMessage, sourceMember, "[automatic catch-up log from attachment-only message]"),
      );

      if (!await reactToCheckInMessage(sourceMessage)) {
        stats.failures += 1;
      }
    } else {
      awardHistoricalCatchupPoint(guildState, targetUserId, sourceDateKey, activeDateKey);
      markCatchupLogged(guildState, sourceDateKey, targetUserId, sourceMessage);

      if (getPeriodKeys(sourceDateKey).week !== guildState.points.periods.week.key) {
        stats.inactivePeriodPoints += 1;
      }

      if (!await reactToCheckInMessage(sourceMessage)) {
        stats.failures += 1;
      }
    }

    stats.logged += 1;
    stats.dates.add(sourceDateKey);
  }

  await store.save();

  const summary = [
    `catch-up sweep complete for the last ${hours} hour${hours === 1 ? "" : "s"} in <#${channel.id}>.`,
    `${stats.logged} new gm${stats.logged === 1 ? "" : "s"} logged.`,
  ];

  if (stats.alreadyLogged > 0) {
    summary.push(`${stats.alreadyLogged} skipped because they were already logged or already processed by the bot.`);
  }

  if (stats.outsideUsMorning > 0) {
    summary.push(`${stats.outsideUsMorning} skipped because they were outside legal U.S. morning.`);
  }

  if (stats.dates.size > 0) {
    summary.push(`dates backfilled: ${[...stats.dates].join(", ")}.`);
  }

  if (stats.validMorningMessages === 0) {
    summary.push("i did not find any valid-looking morning messages in that scan window.");
  } else {
    summary.push(`${stats.validMorningMessages} valid-looking gm message${stats.validMorningMessages === 1 ? "" : "s"} inspected out of ${stats.scanned} recent messages.`);
  }

  if (stats.failures > 0) {
    const verb = stats.failures === 1 ? "was" : "were";
    summary.push(`${stats.failures} log${stats.failures === 1 ? "" : "s"} ${verb} saved, but the retro reaction failed.`);
  }

  if (stats.inactivePeriodPoints > 0) {
    const verb = stats.inactivePeriodPoints === 1 ? "was" : "were";
    summary.push(`${stats.inactivePeriodPoints} older log${stats.inactivePeriodPoints === 1 ? "" : "s"} ${verb} added to lifetime totals but could not safely rewrite an already-closed weekly board.`);
  }

  await safeReply(message, {
    content: summary.join("\n"),
    allowedMentions: { repliedUser: false, parse: [] },
  });
}

async function handleManualLogAdd(message, body) {
  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const todayKey = getZonedParts(new Date(), timeZone).dateKey;
  const input = body.slice("logadd".length).trim();
  const tokens = input.match(/\S+/g) ?? [];

  if (tokens.length === 0) {
    await safeReply(message, {
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
    await safeReply(message, {
      content: "i still need the message id or message link so i know which goblin document to file.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (tokens.length > index + 1) {
    await safeReply(message, {
      content: "too many tokens. keep it to a user, an optional channel, and one message id or message link.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  let messageId = null;
  const linkedMessage = parseMessageLink(referenceToken);

  if (linkedMessage) {
    if (linkedMessage.guildId !== message.guild.id) {
      await safeReply(message, {
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
    await safeReply(message, {
      content: "that does not look like a Discord message id or link. the goblin cannot notarize vibes alone.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const sourceMessage = await fetchReferencedMessage(message.guild, targetChannelId, messageId);

  if (!sourceMessage) {
    await safeReply(message, {
      content: "could not fetch that message. either the id is wrong or the goblin does not have channel access.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (sourceMessage.author.bot) {
    await safeReply(message, {
      content: "i am not manually logging another bot. the paperwork stops here.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const sourceDateKey = getZonedParts(new Date(sourceMessage.createdTimestamp), timeZone).dateKey;

  if (sourceDateKey !== todayKey) {
    await safeReply(message, {
      content: "that message is not from today in this server's timezone, so i am not filing it under today's sunrise crimes.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const inferredUserId = sourceMessage.author.id;

  if (targetUserId && targetUserId !== inferredUserId) {
    await safeReply(message, {
      content: "the user you gave me does not match the author of that message. suspicious paperwork. fix one of them and try again.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  targetUserId ??= inferredUserId;

  const sourceMember = sourceMessage.member ?? (await message.guild.members.fetch(targetUserId).catch(() => null));

  const { alreadyCheckedIn, totalCheckIns, pointsAwarded } = recordCheckIn(
    guildState,
    todayKey,
    targetUserId,
    buildHistoricalCheckInEntry(sourceMessage, sourceMember, "[manual log from attachment-only message]"),
  );

  await store.save();

  const action = alreadyCheckedIn ? "updated" : "added";
  const pointNote = pointsAwarded > 0 ? ` +${pointsAwarded} dawn point awarded.` : "";

  await safeReply(message, {
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
    await safeReply(message, {
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
    await safeReply(message, {
      content: "i still need the message id or message link so i know where to do the dramatic retroactive paperwork.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (tokens.length > index + 1) {
    await safeReply(message, {
      content: "too many tokens. keep it to an optional channel plus one message id or message link.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  let messageId = null;
  const linkedMessage = parseMessageLink(referenceToken);

  if (linkedMessage) {
    if (linkedMessage.guildId !== message.guild.id) {
      await safeReply(message, {
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
    await safeReply(message, {
      content: "that does not look like a Discord message id or link. the goblin cannot react to a concept.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const sourceMessage = await fetchReferencedMessage(message.guild, targetChannelId, messageId);

  if (!sourceMessage) {
    await safeReply(message, {
      content: "could not fetch that message. either the id is wrong or i do not have channel access.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (sourceMessage.author.bot) {
    await safeReply(message, {
      content: "i am not doing a fake retro-gm for another bot. that is spiritually embarrassing.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const sourceDateKey = getZonedParts(new Date(sourceMessage.createdTimestamp), timeZone).dateKey;

  if (sourceDateKey !== todayKey) {
    await safeReply(message, {
      content: "that message is not from today in this server's timezone, so i am not filing it into today's dawn ledger.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const targetUserId = sourceMessage.author.id;
  const sourceMember = sourceMessage.member ?? (await message.guild.members.fetch(targetUserId).catch(() => null));

  const { alreadyCheckedIn, totalCheckIns } = recordCheckIn(
    guildState,
    todayKey,
    targetUserId,
    buildHistoricalCheckInEntry(sourceMessage, sourceMember, "[manual retro-reply log from attachment-only message]"),
  );

  await store.save();

  try {
    await maybeCelebrateCheckIn(sourceMessage, guildState, alreadyCheckedIn, totalCheckIns, {
      ignoreQuietList: true,
    });
  } catch {
    await safeReply(message, {
      content: "i logged the gm for <@" + targetUserId + ">, but the reaction/reply part failed. probably channel permissions being dramatic.",
      allowedMentions: { repliedUser: false, parse: ["users"] },
    });
    return;
  }

  await safeReply(message, {
    content: "retro gm filed for <@" + targetUserId + "> from " + sourceMessage.url + ". reaction and reply attempted.",
    allowedMentions: { repliedUser: false, parse: ["users"] },
  });
}
async function handleCheckIn(message) {
  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const zonedNow = getZonedParts(new Date(), timeZone);

  const { dailyState, alreadyCheckedIn, totalCheckIns, streakEvent } = recordCheckIn(guildState, zonedNow.dateKey, message.author.id, {
    displayName: message.member?.displayName || message.author.username,
    timestamp: Date.now(),
    channelId: message.channelId,
    message: message.content,
  });

  const suppressTextReply = guildState.suppressedCheckInReplyUserIds.includes(message.author.id);
  const bonusLines = alreadyCheckedIn || suppressTextReply
    ? []
    : buildCheckInBonusLines(message, guildState, dailyState, streakEvent);

  await store.save();
  await maybeCelebrateCheckIn(message, guildState, alreadyCheckedIn, totalCheckIns, { bonusLines });
}

async function handleRejectedCheckIn(message) {
  const guildState = ensureGuildState(message.guild.id);
  const voiceConfig = getGuildVoiceConfig(guildState);
  const reply = formatBotText(
    pickFromPoolBag(getVoicePoolBagKey(guildState, "checkin:invalidCheckInReplies"), voiceConfig.invalidCheckInReplies),
    message,
  );

  await safeReply(message, {
    content: reply,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}


async function handleOwnerSpeech(message, commandName, body) {

  if (!isBotOwner(message.author.id)) {

    await safeReply(message, {

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

  if (commandName === "catchup") {
    await handleCatchupScan(message, body);
    return;
  }

  if (commandName === "streamed") {

    const input = body.slice(commandName.length).trim();

    if (!input) {
      await safeReply(message, {
        content: "use it like `" + COMMAND_PREFIX + " streamed 2026-03-19` or `" + COMMAND_PREFIX + " streamed today`.",
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }

    const normalizedDateKey = parseStreamDateInput(input);

    if (!normalizedDateKey) {
      await safeReply(message, {
        content: "that date format is cursed. use `YYYY-MM-DD`, `M/D/YYYY`, or `today`.",
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }

    const todayKey = getZonedParts(new Date(), DEFAULT_TIMEZONE).dateKey;

    if (getDateKeyDifference(normalizedDateKey, todayKey) === null || normalizedDateKey > todayKey) {
      await safeReply(message, {
        content: "i am not logging a future stream. the goblin is strange, not prophetic.",
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }

    const tracker = ensureStreamTracker();
    tracker.lastStreamDateKey = normalizedDateKey;
    await store.save();

    await safeReply(message, {
      content: `stream tracker updated. the official last-stream date is now ${normalizedDateKey}. drought clock reset.`,
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;

  }

  if (commandName === "resetpoints") {

    const guildState = ensureGuildState(message.guild.id);
    const todayKey = getZonedParts(new Date(), getGuildTimezone(guildState)).dateKey;

    guildState.points = createPointsState(todayKey);
    await store.save();

    await safeReply(message, {
      content: "gm points and champion history reset for this server. fresh season, clean clipboard, no survivors.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;

  }

  if (commandName === "offline") {

    const guildState = ensureGuildState(message.guild.id);
    const targetChannel = (await getMorningChannel(message.guild)) ?? (message.channel.isTextBased() ? message.channel : null);

    if (!targetChannel) {
      await safeReply(message, {
        content: "i do not have a valid channel for the dramatic departure speech yet. set a morning channel first with `" + COMMAND_PREFIX + " here`.",
        allowedMentions: { repliedUser: false, parse: [] },
      });

      return;
    }

    const sent = await safeSend(targetChannel, pickFromPoolBag("offline:awayLines", OFFLINE_AWAY_LINES));

    if (!sent) {
      return;
    }

    guildState.offlineNotice.pendingReturn = true;
    guildState.offlineNotice.channelId = targetChannel.id;
    await store.save();
    return;

  }



  if (commandName === "say") {

    const text = body.slice(commandName.length).trim();



    if (!text) {

      await safeReply(message, {

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

      await safeReply(message, {

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

      await safeReply(message, {

        content: "presence reset. the goblin is back on auto-rotation and currently " + describePresence(currentAutoPresence) + ".",

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }



    const [rawType, ...nameParts] = input.split(/\s+/);

    const activityType = parsePresenceType(rawType);

    const name = nameParts.join(" ").trim();



    if (activityType === null || !name) {

      await safeReply(message, {

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

    await safeReply(message, {

      content: "presence updated: " + describePresence({ type: rawType.toLowerCase(), name }) + ".",

      allowedMentions: { repliedUser: false, parse: [] },

    });

    return;

  }



  const sayToInput = body.slice(commandName.length).trim();
  const targetToken = sayToInput.match(/^\S+/)?.[0] ?? "";
  const targetChannel = await resolveSayToChannel(message, targetToken);



  if (!targetChannel || !targetChannel.isTextBased()) {

    await safeReply(message, {

      content: "use it like `" + COMMAND_PREFIX + " sayto #general hello goblins`.",

      allowedMentions: { repliedUser: false, parse: [] },

    });

    return;

  }



  const text = body

    .slice(commandName.length)

    .trim()

    .slice(targetToken.length)

    .trim();



  if (!text) {

    await safeReply(message, {

      content: "give me a message too, like `" + COMMAND_PREFIX + " sayto #general hello goblins`.",

      allowedMentions: { repliedUser: false, parse: [] },

    });

    return;

  }



  await safeSend(targetChannel, text);

}

async function resolveSayToChannel(message, targetToken) {
  if (!targetToken) {
    return null;
  }

  const mentionMatch = targetToken.match(/^<#([0-9]+)>$/);

  if (mentionMatch) {
    return message.guild.channels.fetch(mentionMatch[1]).catch(() => null);
  }

  if (!targetToken.startsWith("#")) {
    return null;
  }

  const requestedName = normalizeChannelName(targetToken.slice(1));

  if (!requestedName) {
    return null;
  }

  const cachedChannel = message.guild.channels.cache.find(
    (channel) => channel.isTextBased() && normalizeChannelName(channel.name) === requestedName,
  );

  if (cachedChannel) {
    return cachedChannel;
  }

  const fetchedChannels = await message.guild.channels.fetch().catch(() => null);

  return fetchedChannels?.find(
    (channel) => channel?.isTextBased() && normalizeChannelName(channel.name) === requestedName,
  ) ?? null;
}

function formatVoicePackList(guildState) {
  return getAvailableVoicePackKeys()
    .map((key) => {
      const pack = morningConfig.voicePacks[key];
      const currentMark = key === getGuildVoicePackKey(guildState) ? " (current)" : "";
      const description = pack.description ? ` - ${pack.description}` : "";
      return `- \`${key}\`${currentMark}${description}`;
    })
    .join("\n");
}

async function handleVoiceCommand(message, args) {
  const guildState = ensureGuildState(message.guild.id);
  const requestedPackInput = args[0]?.toLowerCase();

  if (!requestedPackInput) {
    await safeReply(message, {
      content: `current voice pack: \`${getGuildVoicePackKey(guildState)}\`\navailable voice packs:\n${formatVoicePackList(guildState)}`,
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  const isReset = ["reset", "default"].includes(requestedPackInput);
  const requestedPack = isReset ? DEFAULT_VOICE_PACK_KEY : requestedPackInput;

  if (!hasManageGuild(message.member)) {
    await safeReply(message, {
      content: "you need `Manage Server` to change the goblin voice season.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (!morningConfig.voicePacks[requestedPack]) {
    await safeReply(message, {
      content: `unknown voice pack \`${requestedPack}\`. available packs: ${getAvailableVoicePackKeys().map((key) => `\`${key}\``).join(", ")}.`,
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  guildState.voicePackKey = requestedPack;
  conversationState.poolBags.clear();
  await store.save();

  await safeReply(message, {
    content: isReset
      ? `voice pack reset to \`${requestedPack}\`. the default goblin costume has been restored.`
      : `voice pack set to \`${requestedPack}\`. the goblin has changed costumes without consulting HR.`,
    allowedMentions: { repliedUser: false, parse: [] },
  });
}

async function handleQuestCommand(message, args) {
  const guildState = ensureGuildState(message.guild.id);
  const timeZone = getGuildTimezone(guildState);
  const dailyState = ensureDailyState(guildState, getZonedParts(new Date(), timeZone).dateKey);
  const subcommand = args[0]?.toLowerCase();

  if (!subcommand) {
    if (!getMicroQuestsEnabled(guildState)) {
      await safeReply(message, {
        content: "micro-quests are disabled. the side paperwork is asleep.",
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }

    const { prompt } = ensureDailyMicroQuest(guildState, dailyState);
    await store.save();
    await safeReply(message, {
      content: formatMicroQuestLine(prompt) ?? "no micro-quest prompt is configured right now.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (!hasManageGuild(message.member)) {
    await safeReply(message, {
      content: "you need `Manage Server` to adjust the daily micro-quest.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (subcommand === "on") {
    guildState.microQuestsEnabled = true;
    const { prompt } = ensureDailyMicroQuest(guildState, dailyState);
    await store.save();
    await safeReply(message, {
      content: `micro-quests enabled. ${formatMicroQuestLine(prompt) ?? "no prompt is configured right now."}`,
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (subcommand === "off") {
    guildState.microQuestsEnabled = false;
    dailyState.microQuestPrompt = null;
    await store.save();
    await safeReply(message, {
      content: "micro-quests disabled. the optional side quest has been gently returned to its drawer.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (subcommand === "reset") {
    guildState.microQuestsEnabled = null;
    const { prompt } = ensureDailyMicroQuest(guildState, dailyState, { reroll: true });
    await store.save();
    await safeReply(message, {
      content: getMicroQuestsEnabled(guildState)
        ? `micro-quest setting reset to config default. ${formatMicroQuestLine(prompt) ?? "no prompt is configured right now."}`
        : "micro-quest setting reset to config default, which is currently disabled.",
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  if (subcommand === "reroll") {
    if (!getMicroQuestsEnabled(guildState)) {
      await safeReply(message, {
        content: "micro-quests are disabled right now. use `" + COMMAND_PREFIX + " quest on` before rerolling.",
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }

    const { prompt } = ensureDailyMicroQuest(guildState, dailyState, { reroll: true });
    await store.save();
    await safeReply(message, {
      content: `micro-quest rerolled. ${formatMicroQuestLine(prompt) ?? "no prompt is configured right now."}`,
      allowedMentions: { repliedUser: false, parse: [] },
    });
    return;
  }

  await safeReply(message, {
    content: "use `" + COMMAND_PREFIX + " quest`, `" + COMMAND_PREFIX + " quest reroll`, `" + COMMAND_PREFIX + " quest on`, `" + COMMAND_PREFIX + " quest off`, or `" + COMMAND_PREFIX + " quest reset`.",
    allowedMentions: { repliedUser: false, parse: [] },
  });
}



async function handleCommand(message) {

  const body = message.content.slice(COMMAND_PREFIX.length).trim();

  const [command = "help", ...args] = body.split(/\s+/);

  const guildState = ensureGuildState(message.guild.id);



  switch (command.toLowerCase()) {

    case "":

    case "help": {

      const lines = [
        "Morning Goblin commands",
        "everyone:",
        `- \`${COMMAND_PREFIX} status\` — today's gm roster`,
        `- \`${COMMAND_PREFIX} points\` — scoreboards and recent champions`,
        `- \`${COMMAND_PREFIX} stats\` — your stats (use in #${RANK_CHECK_CHANNEL_NAME})`,
        `- \`${COMMAND_PREFIX} stream\` — time since the last recorded stream`,
        `- \`${COMMAND_PREFIX} fact\` — a random verified morning fact`,
        `- \`${COMMAND_PREFIX} phrases\` — accepted morning openings`,
        `- \`${COMMAND_PREFIX} voice\` — current voice pack and available choices`,
        `- \`${COMMAND_PREFIX} quest\` — today's optional micro-quest`,
        "- mention me, reply to me, or say `morning goblin` to chat",
      ];

      if (hasManageGuild(message.member)) {
        lines.push(
          "Manage Server:",
          `- \`${COMMAND_PREFIX} here\` / \`${COMMAND_PREFIX} off\` — set or stop scheduled morning posts`,
          `- \`${COMMAND_PREFIX} timezone America/Phoenix\` — set the server timezone`,
          `- \`${COMMAND_PREFIX} test\` — try the scheduled reminder now`,
          `- \`${COMMAND_PREFIX} quiet @user\` / \`${COMMAND_PREFIX} unquiet @user\` / \`${COMMAND_PREFIX} quietlist\` — manage check-in text replies`,
          `- \`${COMMAND_PREFIX} voice fresh|chaos|classic|reset\` — change the voice pack`,
          `- \`${COMMAND_PREFIX} quest on|off|reroll|reset\` — manage micro-quests`,
          `- \`${COMMAND_PREFIX} reload\` — reload config/morning-config.json`,
        );
      }

      if (isBotOwner(message.author.id)) {
        lines.push(
          "owner:",
          `- \`${COMMAND_PREFIX} say ...\` / \`${COMMAND_PREFIX} sayto #channel ...\` — speak as the bot`,
          `- \`${COMMAND_PREFIX} presence watching for Mong Plorps\` / \`${COMMAND_PREFIX} presence reset\` — set or reset the bot status`,
          `- \`${COMMAND_PREFIX} offline\` — announce an outage and later return`,
          `- \`${COMMAND_PREFIX} streamed today\` — update the last-stream date`,
          `- \`${COMMAND_PREFIX} resetpoints\` — wipe scoreboards and champions`,
          `- \`${COMMAND_PREFIX} logadd ...\` / \`${COMMAND_PREFIX} logreply ...\` — repair a missed gm`,
          `- \`${COMMAND_PREFIX} catchup 72\` — scan recent morning-channel history`,
        );
      }

      await safeReply(message, {

        content: lines.join("\n"),

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

    case "stats": {

      await postUserStats(message);

      return;

    }

    case "stream":
    case "laststream": {

      await postStreamStatus(message);

      return;

    }

    case "phrases": {
      await safeReply(message, {
        content: `accepted morning starts: ${morningConfig.acceptedStarts.join(", ")}. special filing: two-word M… P… greetings such as \`Mong Plorps\` also count.`,
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }
    case "voice": {
      await handleVoiceCommand(message, args);
      return;
    }
    case "quest":
    case "microquest": {
      await handleQuestCommand(message, args);
      return;
    }
    case "quietlist": {
      if (!hasManageGuild(message.member)) {
        await safeReply(message, {
          content: "you need `Manage Server` for that one, chief.",
          allowedMentions: { repliedUser: false },
        });
        return;
      }

      await safeReply(message, {
        content: formatSuppressedReplyList(message.guild),
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }
    case "quiet":
    case "unquiet": {
      if (!hasManageGuild(message.member)) {
        await safeReply(message, {
          content: "you need `Manage Server` for that one, chief.",
          allowedMentions: { repliedUser: false },
        });
        return;
      }

      const targetUserId = parseTargetUserId(message);

      if (!targetUserId) {
        await safeReply(message, {
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

        await safeReply(message, {
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
        await safeReply(message, {
          content: `<@${targetUserId}> has been removed from the no-reply check-in list. the goblin may resume yapping at them.`,
          allowedMentions: { repliedUser: false, parse: ["users"] },
        });
        return;
      }

      await safeReply(message, {
        content: `<@${targetUserId}> was not on the no-reply check-in list in the first place.`,
        allowedMentions: { repliedUser: false, parse: ["users"] },
      });
      return;
    }
    case "fact":
    case "morningfact": {
      const voiceConfig = getGuildVoiceConfig(guildState);
      const fact = pickFromPoolBag(getVoicePoolBagKey(guildState, "facts:morningFacts"), voiceConfig.morningFacts);
      await safeReply(message, {
        content: `morning fact: ${fact}`,
        allowedMentions: { repliedUser: false, parse: [] },
      });
      return;
    }
    case "reload": {

      if (!hasManageGuild(message.member)) {

        await safeReply(message, {

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      await reloadMorningConfig();

      await safeReply(message, {

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

    case "catchup":

    case "streamed":

    case "resetpoints":

    case "offline": {

      await handleOwnerSpeech(message, command.toLowerCase(), body);

      return;

    }

    case "here": {

      if (!hasManageGuild(message.member)) {

        await safeReply(message, {

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      if (!message.channel.isTextBased()) {

        await safeReply(message, {

          content: "pick a text-based channel for the morning nonsense.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      guildState.morningChannelId = message.channelId;

      await store.save();

      await safeReply(message, {

        content: `scheduled morning posts will now use this channel. timezone: \`${getGuildTimezone(guildState)}\`. the tiny desk has been relocated.`,

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }

    case "off": {

      if (!hasManageGuild(message.member)) {

        await safeReply(message, {

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      guildState.morningChannelId = null;

      guildState.daily = null;

      await store.save();

      await safeReply(message, {

        content: "scheduled reminders, recaps, and callouts are disabled. commands and greetings still work; the clipboard is merely off duty.",

        allowedMentions: { repliedUser: false },

      });

      return;

    }

    case "timezone": {

      if (!hasManageGuild(message.member)) {

        await safeReply(message, {

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      const candidate = args.join(" ").trim();



      if (!candidate || !isValidTimeZoneName(candidate)) {

        await safeReply(message, {

          content: "i could not recognize that timezone. use an IANA name like `America/Phoenix`.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      guildState.timezone = candidate;

      await store.save();

      await safeReply(message, {

        content: `timezone set to \`${candidate}\`. the rooster will now scream on local time.`,

        allowedMentions: { repliedUser: false, parse: [] },

      });

      return;

    }

    case "test": {

      if (!hasManageGuild(message.member)) {

        await safeReply(message, {

          content: "you need `Manage Server` for that one, chief.",

          allowedMentions: { repliedUser: false },

        });

        return;

      }



      if (!guildState.morningChannelId) {

        await safeReply(message, {

          content: `set a channel first with \`${COMMAND_PREFIX} here\`.`,

          allowedMentions: { repliedUser: false, parse: [] },

        });

        return;

      }



      const sent = await postReminder(message.guild);

      await safeReply(message, {

        content: sent

          ? "test reminder deployed. the goblin horn has sounded."

          : "i did not post the test reminder. the channel may already end with a goblin message, or it may be missing or inaccessible.",

        allowedMentions: { repliedUser: false },

      });

      return;

    }

    default: {

      await safeReply(message, {

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



  const now = new Date();
  const recapNow = getZonedParts(now, NOON_RECAP_TIMEZONE);
  const recapMinutesNow = recapNow.hour * 60 + recapNow.minute;
  const offenderNow = getZonedParts(now, RANDOM_OFFENDER_TIMEZONE);
  const offenderMinutesNow = offenderNow.hour * 60 + offenderNow.minute;

  for (const guild of client.guilds.cache.values()) {

    const guildState = ensureGuildState(guild.id);



    if (!guildState.morningChannelId) {

      continue;

    }

    const zonedNow = getZonedParts(now, getGuildTimezone(guildState));

    const dailyState = ensureDailyState(guildState, zonedNow.dateKey);

    const nowMinutes = zonedNow.hour * 60 + zonedNow.minute;

    if (

      ENABLE_MORNING_REMINDER &&

      !dailyState.reminderSent &&

      nowMinutes >= MORNING_REMINDER_MINUTES &&

      nowMinutes <= MORNING_REMINDER_MINUTES + REMINDER_GRACE_MINUTES

    ) {

      const sent = await postReminder(guild);



      if (sent) {

        dailyState.reminderSent = true;

        await store.save();

        await maybePostPendingChampionAnnouncements(guild, guildState);

      }



      continue;

    }



    if (

      ENABLE_RANDOM_OFFENDER &&

      !dailyState.randomOffenderSent &&

      offenderMinutesNow >= RANDOM_OFFENDER_MINUTES &&

      offenderMinutesNow <= RANDOM_OFFENDER_MINUTES + REMINDER_GRACE_MINUTES

    ) {

      const result = await postRandomOffenderCallout(guild);



      if (result.handled) {

        dailyState.randomOffenderSent = true;

        await store.save();

      }

    }



    if (nowMinutes >= MORNING_REMINDER_MINUTES) {

      await maybePostPendingChampionAnnouncements(guild, guildState);

    }



    if (


      ENABLE_NOON_RECAP &&

      !dailyState.recapSent &&

      recapMinutesNow >= NOON_RECAP_MINUTES &&

      recapMinutesNow <= NOON_RECAP_MINUTES + FOLLOWUP_GRACE_MINUTES

    ) {

      const sent = await postNoonRecap(guild);



      if (sent) {

        dailyState.recapSent = true;

        await store.save();

      }

    }

  }

}

function runSchedulerTick() {
  if (!schedulerTickPromise) {
    schedulerTickPromise = schedulerTick().finally(() => {
      schedulerTickPromise = null;
    });
  }

  return schedulerTickPromise;
}



client.once("clientReady", async () => {

  initializeAutoPresenceRotation();

  await applyBotPresence();



  console.log(`Logged in as ${client.user.tag}`);

  console.log(`Loaded ${morningConfig.conversation.mentionReplies.length} mention replies.`);

  console.log(`Loaded ${AUTO_PRESENCE_OPTIONS.length} rotating statuses.`);

  await announcePendingReturnMessages();

  await runSchedulerTick();



  setInterval(() => {

    runSchedulerTick().catch((error) => {

      console.error("Scheduler tick failed:", error);

    });

  }, 30000);

});



client.on("messageCreate", async (message) => {

  if (!message.inGuild()) {

    return;

  }

  messageGuard.observeMessage(message);

  if (message.author.bot) {
    return;

  }



  const guildState = ensureGuildState(message.guild.id);

  const timeZone = getGuildTimezone(guildState);

  const zonedNow = getZonedParts(new Date(), timeZone);

  const dailyState = ensureDailyState(guildState, zonedNow.dateKey);

  const nowMinutes = zonedNow.hour * 60 + zonedNow.minute;
  const shouldDeferPendingReturn = isSilenceRequest(
    message.content,
    getGuildVoiceConfig(guildState).conversation.wakeWords,
    morningConfig.acceptedStarts,
  );



  try {

    if (guildState.offlineNotice?.pendingReturn) {
      await getOfflineNoticeChannel(message.guild, guildState);
    }

    if (message.content.startsWith(COMMAND_PREFIX)) {

      await handleCommand(message);

      return;

    }

    const explicitlyInvokesBot =
      message.mentions.users.has(client.user.id) ||
      isWakeWordMessage(message.content, guildState);

    if (
      shouldDeferPendingReturn &&
      (explicitlyInvokesBot || await isReplyToBot(message))
    ) {
      return;
    }

    const looksLikeGoodMorning = isGoodMorningMessage(message.content);
    const conversationRemainder = normalizeConversationText(
      message.content,
      getGuildVoiceConfig(guildState).conversation.wakeWords,
    );
    const hasConversationRemainder =
      /[\p{L}\p{N}]/u.test(conversationRemainder) &&
      !isGoodMorningMessage(conversationRemainder);

    if (
      explicitlyInvokesBot &&
      (!looksLikeGoodMorning || hasConversationRemainder) &&
      await maybeHandleConversation(message)
    ) {
      return;
    }



    if (looksLikeGoodMorning) {
      if (!isMorningSomewhereInUnitedStates(new Date(message.createdTimestamp))) {
        await handleRejectedCheckIn(message);
        return;
      }

      await handleCheckIn(message);
      return;
    }

    if (!explicitlyInvokesBot) {
      if (await maybeHandleConversation(message)) {
        return;
      }
    }

    await maybeNudge(message, guildState, dailyState, nowMinutes);

  } catch (error) {

    console.error("Message handler failed:", error);

  } finally {

    if (!shouldDeferPendingReturn) {
      await announcePendingReturnMessage(message.guild).catch((error) => {
        console.error("Pending return retry failed:", error);
      });
    }

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
