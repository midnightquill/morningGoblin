import assert from "node:assert/strict";
import test from "node:test";
import { ActivityType, Client, GatewayOpcodes } from "discord.js";
import { createBotPresence, formatPresenceText } from "../src/presence.js";
import { AUTO_PRESENCE_OPTIONS } from "../src/system-lines.js";

test("presence includes a complete activity phrase in the custom status", () => {
  for (const [type, name, expected] of [
    ["watching", "the toaster consider its options", "Watching the toaster consider its options"],
    ["listening", "unlicensed breakfast jazz", "Listening to unlicensed breakfast jazz"],
    ["playing", "Kitchen Doorway Simulator", "Playing Kitchen Doorway Simulator"],
    ["competing", "the Dawn Attendance Cup", "Competing in the Dawn Attendance Cup"],
  ]) {
    const presence = createBotPresence({ type, name });
    assert.deepEqual(presence, { activities: [{ name: "Custom Status", type: ActivityType.Custom, state: expected }], status: "online" });
  }
});

test("saved owner statuses keep their wording without duplicating activity prefixes", () => {
  for (const [type, name, expected] of [
    ["watching", "Watching for Mong Plorps", "Watching for Mong Plorps"],
    ["playing", "playing Clipboard Simulator", "Playing Clipboard Simulator"],
    ["listening", "Listening to the kettle", "Listening to the kettle"],
    ["listening", "to the kettle", "Listening to the kettle"],
    ["competing", "Competing in the Pajama Commute", "Competing in the Pajama Commute"],
    ["competing", "in the Pajama Commute", "Competing in the Pajama Commute"],
  ]) {
    const saved = { type, name };
    assert.equal(formatPresenceText(saved), expected);
    assert.deepEqual(saved, { type, name });
  }
});

test("every existing rotating status retains its exact text", () => {
  const original = structuredClone(AUTO_PRESENCE_OPTIONS);
  for (const option of AUTO_PRESENCE_OPTIONS) {
    const state = createBotPresence(option).activities[0].state;
    assert.ok(state.endsWith(option.name), option.name);
    assert.ok(state.length <= 128);
  }
  assert.deepEqual(AUTO_PRESENCE_OPTIONS, original);
});

test("long manual statuses respect the custom-status limit without changing saved text", () => {
  const saved = { type: "playing", name: "🧌".repeat(100) };
  const original = structuredClone(saved);
  const state = createBotPresence(saved).activities[0].state;
  assert.ok(state.length <= 128);
  assert.ok(state.startsWith("Playing "));
  assert.ok(state.endsWith(" …"));
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(state));
  assert.deepEqual(saved, original);
});

test("discord.js sends the complete custom-status state in the gateway packet offline", async () => {
  const client = new Client({ intents: [] });
  const packets = [];
  client.ws.broadcast = (packet) => packets.push(packet);
  try {
    client.presence.set(createBotPresence({ type: "listening", name: "unlicensed breakfast jazz" }));
    assert.equal(packets.length, 1);
    assert.equal(packets[0].op, GatewayOpcodes.PresenceUpdate);
    assert.deepEqual(packets[0].d.activities, [{ type: ActivityType.Custom, name: "Custom Status", state: "Listening to unlicensed breakfast jazz", url: undefined }]);
  } finally {
    await client.destroy();
  }
});
