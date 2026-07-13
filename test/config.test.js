import assert from "node:assert/strict";
import test from "node:test";

import { loadMorningConfig, normalizeAcceptedStarts } from "../src/config.js";

test("the checked-in config loads with usable message pools", async () => {
  const config = await loadMorningConfig();

  assert.ok(config.acceptedStarts.length > 0);
  assert.ok(config.acceptedPatterns.length > 0);
  assert.ok(config.reminderLines.length > 0);
  assert.ok(config.checkInReplies.length > 0);
  assert.ok(config.morningFacts.length > 0);
  assert.deepEqual(Object.keys(config.voicePacks).sort(), ["chaos", "classic", "fresh"]);

  for (const pack of Object.values(config.voicePacks)) {
    assert.ok(pack.reminderLines.length > 0);
    assert.ok(pack.checkInReplies.length > 0);
    assert.ok(pack.conversation.mentionReplies.length > 0);
  }
});

test("accepted starts are normalized without mutating the source", () => {
  const source = ["GM", "Good Morning"];

  assert.deepEqual(normalizeAcceptedStarts(source), ["gm", "good morning"]);
  assert.deepEqual(source, ["GM", "Good Morning"]);
});

test("all voice packs honor conversation and fact quality rules", async () => {
  const config = await loadMorningConfig();
  const silenceTriggers = new Set(["shut up", "go away", "quiet", "too much"]);

  for (const pack of Object.values(config.voicePacks)) {
    const triggers = pack.conversation.keywordRules.flatMap((rule) => rule.triggers);
    const helpRule = pack.conversation.keywordRules.find((rule) => rule.triggers.includes("help"));

    assert.equal(triggers.includes("why"), false);
    assert.equal(triggers.some((trigger) => silenceTriggers.has(trigger)), false);
    assert.ok(helpRule);
    assert.ok(helpRule.replies.every((reply) => reply.includes("{prefix}")));
    assert.deepEqual(pack.morningFacts, config.morningFacts);
  }
});
