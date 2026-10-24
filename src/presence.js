import { ActivityType } from "discord.js";
import { fitMessage } from "./message-format.js";

const DISPLAY_PREFIXES = {
  playing: "Playing",
  watching: "Watching",
  listening: "Listening to",
  competing: "Competing in",
};

export function formatPresenceText(presence) {
  const removablePrefixes = {
    playing: ["playing "],
    watching: ["watching "],
    listening: ["listening to ", "to "],
    competing: ["competing in ", "in "],
  };
  const normalizedName = presence.name.toLowerCase();
  const prefix = (removablePrefixes[presence.type] ?? []).find((candidate) =>
    normalizedName.startsWith(candidate),
  );
  const name = prefix ? presence.name.slice(prefix.length) : presence.name;
  return `${DISPLAY_PREFIXES[presence.type]} ${name}`;
}

export function createBotPresence(presence) {
  return {
    // Custom status supplies its own complete text in the member list and profile.
    activities: [{ name: "Custom Status", type: ActivityType.Custom, state: fitMessage(formatPresenceText(presence), 128) }],
    status: "online",
  };
}
