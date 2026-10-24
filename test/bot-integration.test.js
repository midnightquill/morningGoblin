import assert from "node:assert/strict";
import test from "node:test";
import { client, store, messageGuard, reloadMorningConfig, handleGuildMessage, schedulerTick, postNoonRecap } from "../src/index.js";
import { getZonedParts, getPreviousDateKey } from "../src/dates.js";
import { loadMorningConfig } from "../src/config.js";

test("offline bot workflows: check-ins, commands, send gating and rollover", async (t) => {
  // Real handlers and config with in-memory persistence and a fake Discord channel.
  // Importing the bot never logs in; no messages or runtime files are touched.
  store.state = { guilds: {} };
  store.save = async () => {};
  client.user = { id: "bot" };
  await reloadMorningConfig();
  let fetches = 0;
  let id = 100;
  const sent = [];
  const ballotReactions = [];
  const channel = { id: "channel", guildId: "guild", name: "rank-check🏆", isTextBased: () => true,
    messages: { fetch: async () => new Map() }, send: async (payload) => { sent.push(payload); return { id: String(++id), react: async emoji => { ballotReactions.push(emoji); } }; } };
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
  const originalPoints = structuredClone(state.points);
  await dispatch("!gm dilemma");
  assert.match(sent.at(-1).content, /Break-room Referendum/);
  assert.deepEqual(ballotReactions, ["🅰️", "🅱️"]);
  const ballotId = state.daily.dilemma.messageId;
  await dispatch("!gm dilemma");
  assert.ok(sent.at(-1).content.endsWith(`/guild/channel/${ballotId}`));
  assert.deepEqual(state.points, originalPoints);
  await dispatch("!gm off");
  assert.equal(state.daily, originalDaily);
  // Silence checks, topic matching and reply routing share one history lookup,
  // including when Discord cannot return the referenced message.
  for (const referencedAuthor of ["human", "bot", null]) {
    let lookups = 0;
    const input = message("please be quiet");
    input.reference = { messageId: "original" };
    input.fetchReference = async () => {
      lookups++;
      if (!referencedAuthor) throw new Error("message unavailable");
      return { author: { id: referencedAuthor } };
    };
    const before = sent.length;
    messageGuard.observeMessage(input);
    await handleGuildMessage(input);
    assert.equal(lookups, 1);
    assert.equal(sent.length, before);
  }
  const freshConfig = await loadMorningConfig();
  const random = t.mock.method(Math, "random", () => 0);
  state.lastSurrealReplyAt = null;
  const beforeHelp = sent.length;
  await dispatch("goblin help");
  assert.equal(sent.length, beforeHelp + 1);
  assert.match(sent.at(-1).content, /!gm help/);
  assert.equal(state.lastSurrealReplyAt, null);
  const beforeSilence = sent.length;
  await dispatch("goblin please be quiet");
  assert.equal(sent.length, beforeSilence);
  // Quiet first GMs still file, but cannot trigger a surreal reply or its cooldown.
  state.userPreferences.quietUser = { quiet: true };
  const quietGm = message("gm", Date.parse(`${today}T15:00:00Z`));
  quietGm.author.id = "quietUser";
  messageGuard.observeMessage(quietGm);
  await handleGuildMessage(quietGm);
  assert.equal(sent.length, beforeSilence);
  assert.equal(state.points.lifetime.quietUser, 1);
  assert.equal(state.lastSurrealReplyAt, null);
  for (const [userId, expectSurreal] of [["surrealUser", true], ["cooldownUser", false]]) {
    const input = message("gm", Date.parse(`${today}T15:00:00Z`));
    input.author.id = userId;
    messageGuard.observeMessage(input);
    await handleGuildMessage(input);
    assert.equal(freshConfig.surrealReplies.lines.some(line => sent.at(-1).content.startsWith(line)), expectSurreal);
    assert.ok(Number.isFinite(state.lastSurrealReplyAt));
  }
  // A queued GM may find a newer bot message in its channel; no cooldown is spent.
  state.lastSurrealReplyAt = null;
  const blockedGm = message("gm", Date.parse(`${today}T15:00:00Z`));
  blockedGm.author.id = "blockedUser";
  messageGuard.observeMessage({ id: String(++id), channelId: channel.id, author: { id: "bot" } });
  const beforeBlocked = sent.length;
  await handleGuildMessage(blockedGm);
  assert.equal(sent.length, beforeBlocked);
  assert.equal(state.lastSurrealReplyAt, null);
  random.mock.restore();
  // A scheduled ballot shares the recap message and preserves attendance points.
  state.morningChannelId = channel.id;
  state.daily.dilemma = null;
  state.daily.dilemmaInRecap = true;
  messageGuard.observeMessage(message("what's for lunch?"));
  const beforeRecap = sent.length;
  const beforeRecapReactions = ballotReactions.length;
  const beforeRecapPoints = structuredClone(state.points);
  assert.equal(await postNoonRecap(guild), true);
  assert.equal(sent.length, beforeRecap + 1);
  assert.match(sent.at(-1).content, /Break-room Referendum/);
  assert.ok(sent.at(-1).content.length <= 2000);
  assert.deepEqual(ballotReactions.slice(beforeRecapReactions), ["🅰️", "🅱️"]);
  assert.ok(state.daily.dilemma.messageId);
  assert.deepEqual(state.points, beforeRecapPoints);
  assert.equal(await postNoonRecap(guild), false);
  assert.equal(sent.length, beforeRecap + 1);
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
