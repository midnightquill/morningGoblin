import assert from "node:assert/strict";
import test from "node:test";

import { ChannelMessageGuard } from "../src/message-guard.js";

function createChannel(getLatestAuthorId) {
  return {
    id: "channel-1",
    messages: {
      async fetch() {
        const authorId = getLatestAuthorId();
        const latest = authorId ? { author: { id: authorId } } : null;
        return { first: () => latest };
      },
    },
  };
}

test("blocks a send when the bot authored the latest message", async () => {
  const guard = new ChannelMessageGuard(() => "bot-1");
  const channel = createChannel(() => "bot-1");
  let sends = 0;

  const result = await guard.send(channel, async () => {
    sends += 1;
    return { id: "sent-1" };
  });

  assert.equal(result, null);
  assert.equal(sends, 0);
});

test("allows a send after another sender has posted", async () => {
  const guard = new ChannelMessageGuard(() => "bot-1");
  const channel = createChannel(() => "user-1");

  const result = await guard.send(channel, async () => ({ id: "sent-1" }));

  assert.deepEqual(result, { id: "sent-1" });
});

test("serializes concurrent attempts so only the first message is sent", async () => {
  const guard = new ChannelMessageGuard(() => "bot-1");
  let latestAuthorId = "user-1";
  const channel = createChannel(() => latestAuthorId);
  let sends = 0;

  const send = () =>
    guard.send(channel, async () => {
      sends += 1;
      latestAuthorId = "bot-1";
      return { id: `sent-${sends}` };
    });

  const [first, second] = await Promise.all([send(), send()]);

  assert.deepEqual(first, { id: "sent-1" });
  assert.equal(second, null);
  assert.equal(sends, 1);
});

test("does not trust a stale history fetch after the bot has just sent", async () => {
  const guard = new ChannelMessageGuard(() => "bot-1");
  const channel = createChannel(() => "user-1");
  let sends = 0;

  const send = () =>
    guard.send(channel, async () => {
      sends += 1;
      return { id: `sent-${sends}` };
    });

  assert.deepEqual(await send(), { id: "sent-1" });
  assert.equal(await send(), null);
  assert.equal(sends, 1);
});

test("allows another send only after observing a non-bot message", async () => {
  const guard = new ChannelMessageGuard(() => "bot-1");
  const channel = createChannel(() => "user-1");

  assert.deepEqual(
    await guard.send(channel, async () => ({ id: "sent-1" })),
    { id: "sent-1" },
  );

  guard.observeMessage({ channelId: channel.id, author: { id: "user-2" } });

  assert.deepEqual(
    await guard.send(channel, async () => ({ id: "sent-2" })),
    { id: "sent-2" },
  );
});

test("blocks when the latest message cannot be determined", async () => {
  const guard = new ChannelMessageGuard(() => "bot-1");
  const channel = {
    id: "channel-1",
    messages: { fetch: async () => Promise.reject(new Error("missing access")) },
  };

  assert.equal(await guard.send(channel, async () => ({ id: "sent-1" })), null);
});

test("uses observed gateway messages when history lookup fails", async () => {
  const guard = new ChannelMessageGuard(() => "bot-1");
  const channel = {
    id: "channel-1",
    messages: { fetch: async () => Promise.reject(new Error("missing access")) },
  };
  guard.observeMessage({ channelId: channel.id, author: { id: "user-1" } });

  assert.deepEqual(
    await guard.send(channel, async () => ({ id: "sent-1" })),
    { id: "sent-1" },
  );
});

test("still blocks from observed bot state when history lookup fails", async () => {
  const guard = new ChannelMessageGuard(() => "bot-1");
  const channel = {
    id: "channel-1",
    messages: { fetch: async () => Promise.reject(new Error("missing access")) },
  };
  guard.observeMessage({ channelId: channel.id, author: { id: "bot-1" } });

  assert.equal(await guard.send(channel, async () => ({ id: "sent-1" })), null);
});
