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
    "^m[a-z'-]*\\s+p[a-z'-]*[!?.,;:]*$",
  ],
  reminderLines: [
    "good morning, assorted goblins. this is your daily reminder to place one (1) `good morning` into the chat so i can mark you down as legally alive.",
  ],
  checkInReplies: ["gm logged. clipboard stamped. sun appeased."],
  duplicateReplies: ["double gm detected. enthusiasm noted."],
  invalidCheckInReplies: [
    "absolutely not. it is not morning anywhere in the united states right now, so this gm has been rejected on clerical grounds. please try again tomorrow. are you jak or just doing a very committed jak impression?",
  ],
  nudgeReplies: [
    "tiny paperwork issue: you started talking before saying good morning. please report to {channel} and submit a quick gm.",
  ],
  morningFacts: [
    "Morning sunlight helps signal to your brain that it is time to be awake.",
  ],
  rareShinyReplyChance: 0.02,
  rareShinyPointReward: 7,
  rareShinyReplies: [
    "shiny gm detected. extremely rare paperwork coloration. {points} bonus points have fallen out of the drawer.",
  ],
  microQuests: {
    enabled: true,
    prompts: [
      "include your breakfast status with your gm.",
      "include your current battery percentage with your gm.",
    ],
  },
  streakCelebrations: {
    threeDay: [
      "three-day streak. the habit committee is trying not to look too impressed.",
    ],
    sevenDay: [
      "seven-day streak. full week of dawn compliance. absolutely unreasonable discipline.",
    ],
    comeback: [
      "comeback filing accepted. the streak counter dusted off its little chair.",
    ],
  },
  officeTitles: {
    weekly: [
      "Assistant Regional Dawn Manager",
      "Senior Clipboard Operator",
    ],
  },
  weeklyTitleWatchChance: 0.25,
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
        replies: ["try `{prefix} help` for commands, settings, and the complete dawn paperwork menu."],
      },
    ],
  },
  voicePacks: {
    chaos: {
      label: "chaos",
      description: "Louder, weirder lines for when the sunrise needs novelty and a tiny incident report.",
      reminderLines: [
        "the morning machine is making a noise. insert `gm` before it invents a policy.",
      ],
      checkInReplies: [
        "gm accepted. the receipt came out hot and morally confusing.",
      ],
      duplicateReplies: [
        "duplicate gm. the second one is wearing sunglasses indoors.",
      ],
      invalidCheckInReplies: [
        "too late. the legal morning window has left in a tiny rental car. try again tomorrow.",
      ],
      nudgeReplies: [
        "pre-gm sentence detected. please deposit one sunrise token in {channel}.",
      ],
      morningFacts: [
        "Morning sunlight helps signal to your brain that it is time to be awake.",
      ],
      conversation: {
        enabled: true,
        wakeWords: ["morning goblin", "goblin"],
        channelCooldownSeconds: 20,
        userCooldownSeconds: 45,
        mentionReplies: [
          "chaos desk speaking. please hold while i misplace the hold music.",
        ],
        genericReplies: [
          "this has been routed through the tiny nonsense chute.",
        ],
        keywordRules: [
          {
            triggers: ["help"],
            replies: ["try `{prefix} help` for commands, settings, and the louder dawn paperwork menu."],
          },
        ],
      },
    },
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

function cleanProbability(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 0), 1);
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

function cloneMessagePools(source) {
  return {
    reminderLines: [...source.reminderLines],
    checkInReplies: [...source.checkInReplies],
    duplicateReplies: [...source.duplicateReplies],
    invalidCheckInReplies: [...source.invalidCheckInReplies],
    nudgeReplies: [...source.nudgeReplies],
    morningFacts: [...source.morningFacts],
    conversation: cleanConversationConfig(source.conversation, source.conversation),
  };
}

function cleanMessagePoolConfig(value, fallback) {
  const source = value && typeof value === "object" ? value : {};

  return {
    reminderLines: cleanStringArray(source.reminderLines, fallback.reminderLines),
    checkInReplies: cleanStringArray(source.checkInReplies, fallback.checkInReplies),
    duplicateReplies: cleanStringArray(source.duplicateReplies, fallback.duplicateReplies),
    invalidCheckInReplies: cleanStringArray(source.invalidCheckInReplies, fallback.invalidCheckInReplies),
    nudgeReplies: cleanStringArray(source.nudgeReplies, fallback.nudgeReplies),
    morningFacts: cleanStringArray(source.morningFacts, fallback.morningFacts),
    conversation: cleanConversationConfig(source.conversation, fallback.conversation),
  };
}

function cleanVoicePackConfig(value, fallback, key) {
  const source = value && typeof value === "object" ? value : {};

  return {
    key,
    label: typeof source.label === "string" && source.label.trim() ? source.label.trim() : key,
    description: typeof source.description === "string" ? source.description.trim() : "",
    ...cleanMessagePoolConfig(source, fallback),
  };
}

function cleanVoicePacks(value, retiredMessagePools, baseConfig, fallbackVoicePacks) {
  const packs = {
    fresh: {
      key: "fresh",
      label: "fresh",
      description: "Current active Morning Goblin voice.",
      ...cloneMessagePools(baseConfig),
    },
  };
  const source = value && typeof value === "object" ? value : {};
  const fallbackSource = fallbackVoicePacks && typeof fallbackVoicePacks === "object" ? fallbackVoicePacks : {};
  const keys = new Set([...Object.keys(fallbackSource), ...Object.keys(source)]);

  for (const key of keys) {
    if (!/^[a-z0-9_-]+$/i.test(key) || key === "fresh") {
      continue;
    }

    const packSource = source[key] ?? fallbackSource[key];
    packs[key] = cleanVoicePackConfig(packSource, baseConfig, key);
  }

  const retiredPools = retiredMessagePools?.pools;

  if (retiredPools && typeof retiredPools === "object") {
    packs.classic = {
      key: "classic",
      label: "classic",
      description: "The retired pre-refresh lines, available as a nostalgia season.",
      ...cleanMessagePoolConfig(retiredPools, baseConfig),
    };
  }

  return packs;
}

function cleanMicroQuests(value, fallback) {
  const source = value && typeof value === "object" ? value : {};

  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback.enabled,
    prompts: cleanStringArray(source.prompts, fallback.prompts),
  };
}

function cleanStreakCelebrations(value, fallback) {
  const source = value && typeof value === "object" ? value : {};

  return {
    threeDay: cleanStringArray(source.threeDay, fallback.threeDay),
    sevenDay: cleanStringArray(source.sevenDay, fallback.sevenDay),
    comeback: cleanStringArray(source.comeback, fallback.comeback),
  };
}

function cleanOfficeTitles(value, fallback) {
  const source = value && typeof value === "object" ? value : {};

  return {
    weekly: cleanStringArray(source.weekly, fallback.weekly),
  };
}

function cleanMorningConfig(parsed) {
  const source = parsed && typeof parsed === "object" ? parsed : {};
  const baseConfig = {
    acceptedStarts: cleanStringArray(source.acceptedStarts, FALLBACK_CONFIG.acceptedStarts),
    acceptedPatterns: cleanAcceptedPatterns(source.acceptedPatterns, FALLBACK_CONFIG.acceptedPatterns),
    reminderLines: cleanStringArray(source.reminderLines, FALLBACK_CONFIG.reminderLines),
    checkInReplies: cleanStringArray(source.checkInReplies, FALLBACK_CONFIG.checkInReplies),
    duplicateReplies: cleanStringArray(source.duplicateReplies, FALLBACK_CONFIG.duplicateReplies),
    invalidCheckInReplies: cleanStringArray(
      source.invalidCheckInReplies,
      FALLBACK_CONFIG.invalidCheckInReplies,
    ),
    nudgeReplies: cleanStringArray(source.nudgeReplies, FALLBACK_CONFIG.nudgeReplies),
    morningFacts: cleanStringArray(source.morningFacts, FALLBACK_CONFIG.morningFacts),
    rareShinyReplyChance: cleanProbability(
      source.rareShinyReplyChance,
      FALLBACK_CONFIG.rareShinyReplyChance,
    ),
    rareShinyPointReward: cleanNumber(
      source.rareShinyPointReward,
      FALLBACK_CONFIG.rareShinyPointReward,
      0,
    ),
    rareShinyReplies: cleanStringArray(source.rareShinyReplies, FALLBACK_CONFIG.rareShinyReplies),
    microQuests: cleanMicroQuests(source.microQuests, FALLBACK_CONFIG.microQuests),
    streakCelebrations: cleanStreakCelebrations(
      source.streakCelebrations,
      FALLBACK_CONFIG.streakCelebrations,
    ),
    officeTitles: cleanOfficeTitles(source.officeTitles, FALLBACK_CONFIG.officeTitles),
    weeklyTitleWatchChance: cleanProbability(
      source.weeklyTitleWatchChance,
      FALLBACK_CONFIG.weeklyTitleWatchChance,
    ),
    conversation: cleanConversationConfig(source.conversation, FALLBACK_CONFIG.conversation),
  };

  return {
    ...baseConfig,
    voicePacks: cleanVoicePacks(
      source.voicePacks,
      source.retiredMessagePools,
      baseConfig,
      FALLBACK_CONFIG.voicePacks,
    ),
  };
}

export async function loadMorningConfig({ configPath = CONFIG_PATH, allowFallback = false } = {}) {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Morning config must be a JSON object.");
    }
    validateConfigShape(parsed);

    return cleanMorningConfig(parsed);
  } catch (error) {
    if (!allowFallback) throw error;
    console.warn("Using fallback morning config:", error.message);
    return cleanMorningConfig(FALLBACK_CONFIG);
  }
}

function validateConfigShape(source, location = "config") {
  const pools = ["acceptedStarts", "acceptedPatterns", "reminderLines", "checkInReplies", "duplicateReplies",
    "invalidCheckInReplies", "nudgeReplies", "morningFacts", "rareShinyReplies", "wakeWords", "mentionReplies",
    "genericReplies", "prompts", "threeDay", "sevenDay", "comeback", "weekly", "triggers", "replies"];
  for (const key of pools) {
    if (key in source && (!Array.isArray(source[key]) || source[key].some((item) => typeof item !== "string" || !item.trim()))) {
      throw new Error(`${location}.${key} must be an array of nonempty strings.`);
    }
  }
  for (const pattern of source.acceptedPatterns ?? []) new RegExp(pattern, "i");
  for (const key of ["rareShinyReplyChance", "weeklyTitleWatchChance"]) {
    if (key in source && (!Number.isFinite(source[key]) || source[key] < 0 || source[key] > 1)) throw new Error(`${location}.${key} must be between 0 and 1.`);
  }
  for (const key of ["rareShinyPointReward", "channelCooldownSeconds", "userCooldownSeconds"]) {
    if (key in source && (!Number.isFinite(source[key]) || source[key] < 0)) throw new Error(`${location}.${key} must be a nonnegative number.`);
  }
  if ("enabled" in source && typeof source.enabled !== "boolean") throw new Error(`${location}.enabled must be true or false.`);
  for (const key of ["conversation", "microQuests", "streakCelebrations", "officeTitles"]) {
    if (key in source) {
      if (!source[key] || typeof source[key] !== "object" || Array.isArray(source[key])) throw new Error(`${location}.${key} must be an object.`);
      validateConfigShape(source[key], `${location}.${key}`);
    }
  }
  if ("keywordRules" in source) {
    if (!Array.isArray(source.keywordRules)) throw new Error(`${location}.keywordRules must be an array.`);
    source.keywordRules.forEach((rule, i) => {
      if (!rule || typeof rule !== "object") throw new Error(`${location}.keywordRules[${i}] must be an object.`);
      validateConfigShape(rule, `${location}.keywordRules[${i}]`);
    });
  }
  if ("voicePacks" in source) {
    if (!source.voicePacks || typeof source.voicePacks !== "object" || Array.isArray(source.voicePacks)) throw new Error(`${location}.voicePacks must be an object.`);
    for (const [key, pack] of Object.entries(source.voicePacks)) {
      if (!pack || typeof pack !== "object" || Array.isArray(pack)) throw new Error(`voicePacks.${key} must be an object.`);
      validateConfigShape(pack, `voicePacks.${key}`);
    }
  }
}

export function normalizeAcceptedStarts(items) {
  return items.map((item) => item.toLowerCase());
}
