export function followupBlock(title, text) {
  if (!text?.trim()) return "";
  return `**${title}**\n${text.trim().split(/\r?\n/).map((line) => `> ${line}`).join("\n")}`;
}

export function joinMessageSections(...sections) {
  return sections.flat().filter((section) => typeof section === "string" && section.trim()).join("\n\n");
}

export function fitMessage(content, limit = 2000) {
  if (content.length <= limit) return content;
  return `${content.slice(0, limit - 2).replace(/[\uD800-\uDBFF]$/, "")} …`;
}
