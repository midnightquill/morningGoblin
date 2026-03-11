import { readFile } from "node:fs/promises";
import path from "node:path";

const CONFIG_PATH = path.resolve(process.cwd(), "config", "morning-config.json");

const FALLBACK_CONFIG = {
  acceptedStarts: [
    "gm",
    "good morning",
    "g'morning",
    "gud morning",
    "morning",
    "mornin",
    "top of the morning",
  ],
  acceptedPatterns: [
    "^m[a-z'-]*\\s+p[a-z'-]*$",
  ],
  reminderLines: [
    "good morning, assorted goblins. this is your daily reminder to place one (1) `good morning` into the chat so i can mark you down as legally alive.",
  ],
  checkInReplies: ["gm logged. clipboard kissed. sun appeased."],
  duplicateReplies: ["double gm detected. enthusiasm noted."],
  nudgeReplies: [
    "tiny paperwork issue: you started talking before saying good morning. please report to {channel} and submit a quick gm.",
  ],
  noCheckInsFollowups: [
    "morning census update: absolutely nobody has checked in yet. grim scenes. devastating for the rooster economy.",
  ],
  conversation: {
    enabled: true,
    wakeWords: ["morning goblin", "goblin"],
    channelCooldownSeconds: 20,
    userCooldownSeconds: 45,
    mentionReplies: [
      "you rang? the goblin is here and lightly caffeinated.",
    ],
    genericReplies: ["i am listening with the full power of one haunted clipboard."],
    keywordRules: [
      {
        triggers: ["help"],
        replies: ["i enforce the sacred gm ritual and provide occasional goblin commentary when summoned."],
      },
    ],
  },
};

function cleanStringArray(value, fallback) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const cleaned = value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return cleaned.length > 0 ? cleaned : [...fallback];
}

function cleanNumber(value, fallback, min = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(value, min);
}

function cleanAcceptedPatterns(value, fallback) {
  const candidates = cleanStringArray(value, fallback);
  const valid = [];

  for (const pattern of candidates) {
    try {
      new RegExp(pattern, "i");
      valid.push(pattern);
    } catch {
      // Ignore invalid regex strings and fall back below if needed.
    }
  }

  return valid.length > 0 ? valid : [...fallback];
}

function cleanKeywordRules(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback.map((rule) => ({
      triggers: [...rule.triggers],
      replies: [...rule.replies],
    }));
  }

  const cleaned = value
    .map((rule) => ({
      triggers: cleanStringArray(rule?.triggers, []),
      replies: cleanStringArray(rule?.replies, []),
    }))
    .filter((rule) => rule.triggers.length > 0 && rule.replies.length > 0);

  if (cleaned.length > 0) {
    return cleaned;
  }

  return fallback.map((rule) => ({
    triggers: [...rule.triggers],
    replies: [...rule.replies],
  }));
}

function cleanConversationConfig(value, fallback) {
  const source = value && typeof value === "object" ? value : {};

  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback.enabled,
    wakeWords: cleanStringArray(source.wakeWords, fallback.wakeWords),
    channelCooldownSeconds: cleanNumber(
      source.channelCooldownSeconds,
      fallback.channelCooldownSeconds,
      0,
    ),
    userCooldownSeconds: cleanNumber(source.userCooldownSeconds, fallback.userCooldownSeconds, 0),
    mentionReplies: cleanStringArray(source.mentionReplies, fallback.mentionReplies),
    genericReplies: cleanStringArray(source.genericReplies, fallback.genericReplies),
    keywordRules: cleanKeywordRules(source.keywordRules, fallback.keywordRules),
  };
}

export async function loadMorningConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);

    return {
      acceptedStarts: cleanStringArray(parsed.acceptedStarts, FALLBACK_CONFIG.acceptedStarts),
      acceptedPatterns: cleanAcceptedPatterns(parsed.acceptedPatterns, FALLBACK_CONFIG.acceptedPatterns),
      reminderLines: cleanStringArray(parsed.reminderLines, FALLBACK_CONFIG.reminderLines),
      checkInReplies: cleanStringArray(parsed.checkInReplies, FALLBACK_CONFIG.checkInReplies),
      duplicateReplies: cleanStringArray(parsed.duplicateReplies, FALLBACK_CONFIG.duplicateReplies),
      nudgeReplies: cleanStringArray(parsed.nudgeReplies, FALLBACK_CONFIG.nudgeReplies),
      noCheckInsFollowups: cleanStringArray(
        parsed.noCheckInsFollowups,
        FALLBACK_CONFIG.noCheckInsFollowups,
      ),
      conversation: cleanConversationConfig(parsed.conversation, FALLBACK_CONFIG.conversation),
    };
  } catch (error) {
    console.warn("Using fallback morning config:", error.message);
    return {
      ...FALLBACK_CONFIG,
      acceptedStarts: [...FALLBACK_CONFIG.acceptedStarts],
      acceptedPatterns: [...FALLBACK_CONFIG.acceptedPatterns],
      reminderLines: [...FALLBACK_CONFIG.reminderLines],
      checkInReplies: [...FALLBACK_CONFIG.checkInReplies],
      duplicateReplies: [...FALLBACK_CONFIG.duplicateReplies],
      nudgeReplies: [...FALLBACK_CONFIG.nudgeReplies],
      noCheckInsFollowups: [...FALLBACK_CONFIG.noCheckInsFollowups],
      conversation: cleanConversationConfig(FALLBACK_CONFIG.conversation, FALLBACK_CONFIG.conversation),
    };
  }
}

export function normalizeAcceptedStarts(items) {
  return items.map((item) => item.toLowerCase());
}
