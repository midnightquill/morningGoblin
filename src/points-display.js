import { escapeMarkdown } from "discord.js";
import { fitMessage } from "./message-format.js";

function label(text, limit = 32) {
  const clean = String(text).replace(/\s+/g, " ").replace(/[<>]/g, "").replace(/@/g, "@\u200b").trim();
  return escapeMarkdown(fitMessage(clean || "Unknown goblin", limit));
}

function pointsWord(score) {
  return `${new Intl.NumberFormat("en-US").format(score)} ${score === 1 ? "point" : "points"}`;
}

async function scoreboard(scores, limit, resolveLabel, sortEntries) {
  const entries = sortEntries(scores).filter(([, score]) => score > 0);
  if (!entries.length) return "*No points yet. The dawn paperwork awaits.*";
  let previousScore;
  let rank;
  const ranked = entries.slice(0, limit).map(([userId, score], index) => {
    if (score !== previousScore) rank = index + 1;
    previousScore = score;
    return { userId, score, rank };
  });
  return (await Promise.all(ranked.map(async ({ userId, score, rank }) => {
    const badge = ["🥇", "🥈", "🥉"][rank - 1] ?? `**${rank}.**`;
    return `${badge} **${label(await resolveLabel(userId))}** — **${pointsWord(score)}**`;
  }))).join("\n");
}

async function champion(entry, resolveLabel, formatPeriodLabel) {
  const ids = entry?.winnerUserIds;
  if (!Array.isArray(ids) || !ids.length) return null;
  const winners = await Promise.all(ids.slice(0, 5).map(async (id) => label(await resolveLabel(id))));
  const overflow = ids.length > winners.length ? ` +${ids.length - winners.length} more` : "";
  return [
    `**${winners.join(", ")}${overflow}** — **${pointsWord(entry.points)}**`,
    formatPeriodLabel(entry.periodType, entry.periodKey),
    entry.officeTitle ? `*${label(entry.officeTitle, 100)}*` : null,
  ].filter(Boolean).join("\n");
}

export async function createPointsPayload({ points, resolveLabel, sortEntries, formatPeriodLabel, timeZone, useEmbeds = true }) {
  const periods = [["week", "☀️ This week", "Weekly"], ["month", "🗓️ This month", "Monthly"], ["year", "🎆 This year", "Yearly"]];
  const fields = await Promise.all(periods.map(async ([type, title]) => ({
    name: `${title} · ${formatPeriodLabel(type, points.periods[type].key)}`,
    value: await scoreboard(points.periods[type].scores, 3, resolveLabel, sortEntries),
    inline: false,
  })));
  fields.push({ name: "🏆 All time", value: await scoreboard(points.lifetime, 5, resolveLabel, sortEntries), inline: false });
  for (const [type, , title] of periods) {
    const value = await champion(points.history[type]?.[0], resolveLabel, formatPeriodLabel);
    if (value) fields.push({ name: `👑 Previous ${title.toLowerCase()} champion`, value, inline: false });
  }
  const footer = `Top 3 per period · Top 5 all time · Ties share a rank · ${timeZone}`;
  const allowedMentions = { repliedUser: false, parse: [] };
  if (useEmbeds) {
    return {
      content: "## 🏆 GM points",
      embeds: [{ color: 0x7cb342, fields, footer: { text: footer } }],
      allowedMentions,
    };
  }

  // Keep every section visible within Discord's 2,000-character text limit.
  const heading = "## 🏆 GM points";
  const headers = fields.map(({ name }) => `### ${name}\n`);
  const available = 2000 - heading.length - footer.length - headers.reduce((sum, text) => sum + text.length, 0) - 2 * (fields.length + 1);
  const valueLength = fields.reduce((sum, field) => sum + field.value.length, 0);
  const scale = Math.min(1, available / valueLength);
  const sections = fields.map((field, index) => headers[index] + fitMessage(field.value, Math.floor(field.value.length * scale)));
  return { content: [heading, ...sections, footer].join("\n\n"), allowedMentions };
}
