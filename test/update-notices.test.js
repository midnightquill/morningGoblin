import assert from "node:assert/strict";
import test from "node:test";
import { ChannelMessageGuard } from "../src/message-guard.js";
import { announceUpdateNotice, getUpdateNoticeChannel, UPDATE_AWAY_MESSAGE } from "../src/update-notices.js";

function fixture() {
  const sent = [];
  const snapshots = [];
  const channel = { id: "general", guildId: "guild", name: "general", isTextBased: () => true,
    messages: { fetch: async () => new Map([["human", { author: { id: "human" } }]]) },
    send: async (payload) => { sent.push(payload); return { id: "notice" }; } };
  const channels = new Map([[channel.id, channel]]);
  const guild = { id: "guild", channels: { cache: channels, fetch: async (id) => id ? channels.get(id) : channels } };
  const guildState = { offlineNotice: { pendingReturn: false, channelId: null }, points: { lifetime: { jeff: 12 } } };
  const guard = new ChannelMessageGuard(() => "bot");
  const options = { guild, guildState, send: (target, payload) => guard.send(target, () => target.send(payload)),
    save: async () => snapshots.push(structuredClone(guildState)) };
  return { channel, channels, guild, guildState, guard, sent, snapshots, options };
}

test("update notices target general and persist a return only after a guarded send", async () => {
  const f = fixture();
  const points = structuredClone(f.guildState.points);
  assert.equal(await announceUpdateNotice(f.options), true);
  assert.deepEqual(f.sent, [{ content: UPDATE_AWAY_MESSAGE, allowedMentions: { parse: [] } }]);
  assert.deepEqual(f.snapshots[0].offlineNotice, { pendingReturn: true, channelId: "general", reason: "update" });
  assert.deepEqual(f.guildState.points, points);
  assert.equal(await announceUpdateNotice(f.options), false);
  assert.equal(f.sent.length, 1);
});

test("a blocked update notice never arms a false comeback", async () => {
  const f = fixture();
  f.guard.observeMessage({ channelId: f.channel.id, author: { id: "bot" } });
  assert.equal(await announceUpdateNotice(f.options), false);
  assert.equal(f.sent.length, 0);
  assert.equal(f.snapshots.length, 0);
  assert.equal(f.guildState.offlineNotice.pendingReturn, false);
});

test("failed Discord delivery keeps update return state clear", async () => {
  const f = fixture();
  f.channel.send = async () => { throw new Error("missing access"); };
  await assert.rejects(announceUpdateNotice(f.options), /missing access/);
  assert.equal(f.guildState.offlineNotice.pendingReturn, false);
  assert.equal(f.snapshots.length, 0);
});

test("an existing owner outage is preserved during an update", async () => {
  const f = fixture();
  f.guildState.offlineNotice = { pendingReturn: true, channelId: "morning" };
  assert.equal(await announceUpdateNotice(f.options), false);
  assert.deepEqual(f.guildState.offlineNotice, { pendingReturn: true, channelId: "morning" });
  assert.equal(f.sent.length, 0);
});

test("update channel lookup fetches uncached general and accepts an explicit channel ID", async () => {
  const f = fixture();
  f.guild.channels.cache = new Map();
  assert.equal(await getUpdateNoticeChannel(f.guild), f.channel);
  f.channel.name = "lobby";
  assert.equal(await getUpdateNoticeChannel(f.guild), null);
  assert.equal(await getUpdateNoticeChannel(f.guild, { channelId: f.channel.id }), f.channel);
  assert.equal(await getUpdateNoticeChannel(f.guild, { channelName: "lobby" }), f.channel);
});

test("missing, ambiguous, and cross-guild channels never receive update notices", async () => {
  const f = fixture();
  f.channels.set("duplicate", { ...f.channel, id: "duplicate" });
  assert.equal(await getUpdateNoticeChannel(f.guild), null);
  f.channels.delete("duplicate");
  f.channel.guildId = "another-guild";
  assert.equal(await announceUpdateNotice(f.options), false);
  assert.equal(await getUpdateNoticeChannel(f.guild, { channelId: f.channel.id }), null);
  f.channels.clear();
  assert.equal(await announceUpdateNotice(f.options), false);
  assert.equal(f.sent.length, 0);
});
