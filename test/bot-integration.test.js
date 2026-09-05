import assert from "node:assert/strict";
import test from "node:test";
import { client, store, messageGuard, reloadMorningConfig, handleGuildMessage, schedulerTick } from "../src/index.js";
import { getZonedParts, getPreviousDateKey } from "../src/dates.js";

test("offline bot workflows: check-ins, commands, send gating and rollover", async () => {
  // Real handlers and config with in-memory persistence and a fake Discord channel.
  // Importing the bot never logs in; no messages or runtime files are touched.
  store.state = { guilds: {} };
  store.save = async () => {};
  client.user = { id: "bot" };
  await reloadMorningConfig();
  let fetches = 0;
  let id = 100;
  const sent = [];
  const channel = { id: "channel", guildId: "guild", name: "rank-check🏆", isTextBased: () => true,
    messages: { fetch: async () => new Map() }, send: async (payload) => { sent.push(payload); return { id: String(++id) }; } };
  const guild = { id: "guild", channels: { fetch: async () => channel, cache: new Map([[channel.id, channel]]) },
    members: { cache: new Map(), fetch: async () => { fetches++; return new Map(); } } };
  const message = (content, timestamp = Date.now()) => ({ id: String(++id), content, createdTimestamp: timestamp,
    channelId: channel.id, channel, guild, member: { displayName: "Friend", permissions: { has: () => true } },
    author: { id: "user", username: "Friend", bot: false }, inGuild: () => true,
    mentions: { users: new Map() }, react: async () => {}, reply: channel.send });
  const dispatch = async (content) => {
    const input = message(content);
    messageGuard.observeMessage(input);
    await handleGuildMessage(input);
  };
  for (const content of ["!gm here", "!gm help", "!gm prefs", "!gm prefs quiet on", "!gm prefs callouts off", "!gm prefs vacation 7d", "!gm why gm", "!gm health", "!gm stats", "!gm points", "!gm status", "!gm voice", "!gm quest", "!gm reload"]) {
    const before = sent.length;
    await dispatch(content);
    assert.equal(sent.length, before + 1, content + " should respond");
    assert.ok(sent.at(-1).content.length <= 2000);
  }
  const state = store.state.guilds.guild;
  assert.equal(state.userPreferences.user.quiet, true);
  assert.ok(state.daily);
  await dispatch("!gm prefs quiet off");
  const today = getZonedParts(new Date(), state.timezone).dateKey;
  const baseline = { current: 1, best: 1, lastDateKey: getPreviousDateKey(getPreviousDateKey(today)) };
  state.streaks.users.user = baseline;
  state.checkInLedger.streakBaseline.user = { ...baseline };
  const gm = message("gm", Date.parse(`${today}T15:00:00Z`));
  messageGuard.observeMessage(gm);
  await handleGuildMessage(gm);
  assert.match(sent.at(-1).content, /\n\n\*\*↩️ Welcome back\*\*\n> /);
  const originalDaily = state.daily;
  await dispatch("!gm off");
  assert.equal(state.daily, originalDaily);
  // Blocked scheduled jobs do not fetch a member snapshot.
  state.morningChannelId = channel.id;
  messageGuard.observeMessage({ id: String(++id), channelId: channel.id, author: { id: "bot" } });
  client.guilds.cache.set(guild.id, guild);
  client.isReady = () => true;
  state.recovery = { nextAttemptAt: Date.now() + 60_000 };
  const before = fetches;
  await schedulerTick();
  assert.equal(fetches, before);
  client.guilds.cache.clear();
  await client.destroy();
});
