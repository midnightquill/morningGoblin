export function createCommandHandler({ getMorningConfig,
  COMMAND_PREFIX,
  RANK_CHECK_CHANNEL_NAME,
  ensureGuildState,
  hasManageGuild,
  isBotOwner,
  safeReply,
  getUserPreferences,
  updatePreference,
  suppressCheckInReply,
  getGuildTimezone,
  getZonedParts,
  getCheckInStats,
  isGoodMorningMessage,
  isMorningSomewhereInUnitedStates,
  store,
  health,
  client,
  postStatus,
  postPoints,
  postUserStats,
  postStreamStatus,
  handleVoiceCommand,
  handleQuestCommand,
  formatSuppressedReplyList,
  parseTargetUserId,
  getGuildVoiceConfig,
  pickFromPoolBag,
  getVoicePoolBagKey,
  reloadMorningConfig,
  conversationState,
  handleOwnerSpeech,
  isValidTimeZoneName,
  postReminder }) {
  async function handleCommand(message) {

    const morningConfig = getMorningConfig();
    const body = message.content.slice(COMMAND_PREFIX.length).trim();

    const [command = "help", ...args] = body.split(/\s+/);

    const guildState = ensureGuildState(message.guild.id);

    switch (command.toLowerCase()) {

      case "":

      case "help": {

        const lines = [
          "Morning Goblin commands",
          "everyone:",
          `- \`${COMMAND_PREFIX} why [greeting]\` — explain a GM filing`,
          `- \`${COMMAND_PREFIX} prefs\` — quiet replies, callouts, vacation`,
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
            `- \`${COMMAND_PREFIX} health\` — connection, saves and recovery diagnostics`,
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

      case "preferences":
      case "prefs": {
        const [key, value] = args.map((arg) => arg.toLowerCase());
        if (key && !updatePreference(guildState, message.author.id, key, value)) {
          await safeReply(message, { content: "Use `" + COMMAND_PREFIX + " prefs quiet on|off`, `" + COMMAND_PREFIX + " prefs callouts on|off`, or `" + COMMAND_PREFIX + " prefs vacation 7d|off` (1–30 days).", allowedMentions: { parse: [], repliedUser: false } });
          return;
        }
        if (key) await store.save();
        const preferences = getUserPreferences(guildState, message.author.id);
        await safeReply(message, { content: "**Your goblin preferences**\nQuiet replies: " + (suppressCheckInReply(guildState, message.author.id) ? "on" : "off") + "\nCallouts: " + (preferences.callouts ? "on" : "off") + "\nVacation: " + (Date.parse(preferences.vacationUntil) > Date.now() ? "until " + preferences.vacationUntil.slice(0, 10) : "off") + "\nVacation pauses nudges and callouts; your GMs still count.", allowedMentions: { parse: [], repliedUser: false } });
        return;
      }
      case "why": {
        const timezone = getGuildTimezone(guildState);
        const today = getZonedParts(new Date(), timezone).dateKey;
        const attendance = getCheckInStats(guildState, message.author.id, today);
        const todayEntry = guildState.checkInLedger.entries[today]?.[message.author.id];
        let sample = args.join(" ");
        let timestamp = Date.now();
        if (!sample && message.reference?.messageId) {
          const referenced = await message.fetchReference().catch(() => null);
          if (referenced) { sample = referenced.content; timestamp = referenced.createdTimestamp; }
        }
        const lines = ["**📋 GM filing check**", "Server date: " + today + " (" + timezone + ").",
          todayEntry ? "Your GM is saved for today." : "No GM is saved for you today.",
          "U.S. morning window: " + (isMorningSomewhereInUnitedStates(new Date()) ? "open" : "closed") + "."];
        if (sample) lines.push("That greeting: " + (!isGoodMorningMessage(sample) ? "does not match an accepted opening." : !isMorningSomewhereInUnitedStates(new Date(timestamp)) ? "was outside the U.S. morning window." : "matches the greeting and morning-window rules.") + " Message date: " + getZonedParts(new Date(timestamp), timezone).dateKey + ".");
        if (attendance.lastEntry?.timestamp) lines.push("Your last saved GM: <t:" + Math.floor(attendance.lastEntry.timestamp / 1000) + ":f>.");
        await safeReply(message, { content: lines.join("\n"), allowedMentions: { parse: [], repliedUser: false } });
        return;
      }
      case "health": {
        if (!hasManageGuild(message.member) && !isBotOwner(message.author.id)) return;
        const lines = ["**🛠️ Goblin health**", "Discord: " + (client.isReady() ? "ready" : "reconnecting"),
          "Last scheduler tick: " + (health.lastSchedulerAt ?? "starting"),
          "Last saved state: " + (store.lastSuccessfulSaveAt ?? "none this run"),
          "Storage error: " + (store.lastError ?? "none"),
          "Last catch-up: " + JSON.stringify(guildState.lastCatchup ?? null),
          "Automatic recovery: " + (guildState.recovery?.before ? "continuing through older history" : "caught up / waiting for next check"),
          guildState.recovery?.clipped ? "Recovery was limited to the latest 168 hours; earlier downtime needs manual review." : "",
          "Scheduled results: " + JSON.stringify(health.scheduled)];
        await safeReply(message, { content: lines.join("\n"), allowedMentions: { parse: [], repliedUser: false } });
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

        try {
          await reloadMorningConfig();
          conversationState.poolBags.clear();
        } catch (error) {
          health.error("Config reload failed", error);
          await safeReply(message, { content: "Config reload failed. The previous working configuration is still active; check the JSON file and logs.", allowedMentions: { parse: [], repliedUser: false } });
          return;
        }

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

        // Disabling scheduled posts must preserve today's check-ins.

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
  return handleCommand;
}
