import assert from "node:assert/strict";
import test from "node:test";

import {
  containsPhrase,
  findMatchingKeywordRule,
  isSilenceRequest,
  normalizeConversationText,
} from "../src/conversation-text.js";

const rules = [
  { triggers: ["tea"], replies: ["tea"] },
  { triggers: ["gm"], replies: ["gm"] },
  { triggers: ["how are you"], replies: ["fine"] },
];

test("matches keyword phrases on word boundaries", () => {
  assert.equal(containsPhrase("tea, please", "tea"), true);
  assert.equal(containsPhrase("the team is here", "tea"), false);
  assert.equal(containsPhrase("fragment", "gm"), false);
});

test("removes mentions and wake words before topic matching", () => {
  assert.equal(
    normalizeConversationText("<@123> Morning Goblin, how are you?", ["morning goblin", "goblin"]),
    "how are you",
  );
  assert.equal(
    normalizeConversationText("Morning Goblin, good morning!", ["morning goblin", "goblin"]),
    "good morning",
  );
  assert.equal(normalizeConversationText("Morning Goblin!", ["morning goblin", "goblin"]), "");
  assert.equal(
    findMatchingKeywordRule(
      "Morning Goblin, how are you?",
      ["morning goblin", "goblin"],
      rules,
    ),
    rules[2],
  );
});

test("prefers the most specific matching topic", () => {
  assert.equal(
    findMatchingKeywordRule("how are you this morning?", [], rules),
    rules[2],
  );
});

test("recognizes direct requests for silence without overmatching", () => {
  const acceptedStarts = ["gm", "good morning", "morning"];

  assert.equal(isSilenceRequest("Goblin, please be quiet", ["goblin"]), true);
  assert.equal(isSilenceRequest("Morning Goblin, stop replying please", ["morning goblin"]), true);
  assert.equal(isSilenceRequest("Goblin, can you be quiet?", ["goblin"]), true);
  assert.equal(isSilenceRequest("Goblin, you're too much", ["goblin"]), true);
  assert.equal(
    isSilenceRequest("Good morning, goblin, please be quiet", ["goblin"], acceptedStarts),
    true,
  );
  assert.equal(isSilenceRequest("gm <@123> stop replying", [], acceptedStarts), true);
  assert.equal(isSilenceRequest("Goblin, don’t reply", ["goblin"]), true);
  assert.equal(isSilenceRequest("Goblin, why is the room quiet?", ["goblin"]), false);
});
