function isWordCharacter(char) {
  return Boolean(char) && /[\p{L}\p{N}]/u.test(char);
}

function hasPhraseAt(content, phrase, index) {
  return (
    !isWordCharacter(content.charAt(index - 1)) &&
    !isWordCharacter(content.charAt(index + phrase.length))
  );
}

export function containsPhrase(content, phrase) {
  const normalizedContent = content.toLowerCase();
  const normalizedPhrase = phrase.trim().toLowerCase();

  if (!normalizedPhrase) {
    return false;
  }

  let index = normalizedContent.indexOf(normalizedPhrase);

  while (index !== -1) {
    if (hasPhraseAt(normalizedContent, normalizedPhrase, index)) {
      return true;
    }

    index = normalizedContent.indexOf(normalizedPhrase, index + 1);
  }

  return false;
}

function removePhrase(content, phrase) {
  let result = content;
  let searchFrom = 0;
  let index = result.indexOf(phrase, searchFrom);

  while (index !== -1) {
    if (hasPhraseAt(result, phrase, index)) {
      result = `${result.slice(0, index)} ${result.slice(index + phrase.length)}`;
      searchFrom = index + 1;
    } else {
      searchFrom = index + 1;
    }

    index = result.indexOf(phrase, searchFrom);
  }

  return result;
}

export function normalizeConversationText(content, wakeWords = []) {
  let normalized = content.replace(/<@!?\d+>/g, " ").toLowerCase();
  const longestFirst = [...wakeWords]
    .map((wakeWord) => wakeWord.trim().toLowerCase())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const wakeWord of longestFirst) {
    normalized = removePhrase(normalized, wakeWord);
  }

  return normalized
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
}

export function findMatchingKeywordRule(content, wakeWords, rules) {
  const normalized = normalizeConversationText(content, wakeWords);
  let bestMatch = null;
  let bestTriggerLength = -1;

  for (const rule of rules) {
    for (const trigger of rule.triggers) {
      if (trigger.length > bestTriggerLength && containsPhrase(normalized, trigger)) {
        bestMatch = rule;
        bestTriggerLength = trigger.length;
      }
    }
  }

  return bestMatch;
}

export function isSilenceRequest(content, wakeWords = [], acceptedStarts = []) {
  let normalized = normalizeConversationText(content, wakeWords)
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const greetingStarts = [...acceptedStarts]
    .map((start) => start.toLowerCase().replace(/[.!?,;:]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const greetingStart of greetingStarts) {
    if (normalized === greetingStart) {
      normalized = "";
      break;
    }

    if (normalized.startsWith(`${greetingStart} `)) {
      normalized = normalized.slice(greetingStart.length).trim();
      break;
    }
  }

  return /^(?:please )?(?:shut up|go away|be quiet|quiet|leave me alone|(?:you(?:'re| are) )?too much|stop(?: talking| replying| messaging)?|don['’]?t reply|do not reply|(?:can|could|would|will) you (?:please )?(?:be quiet|stop(?: talking| replying| messaging)?))(?: please)?$/.test(
    normalized,
  );
}
