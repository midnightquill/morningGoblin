export class MemberSnapshotCache {
  constructor({ ttlMs = 15 * 60_000, retryMs = 60_000, now = Date.now } = {}) {
    this.entries = new Map();
    this.ttlMs = ttlMs;
    this.retryMs = retryMs;
    this.now = now;
  }

  invalidate(guildId) { this.entries.delete(guildId); }

  async get(guild) {
    let entry = this.entries.get(guild.id);
    if (entry?.pending) return entry.pending;
    if (entry && this.now() < entry.expiresAt) return entry.members;
    entry ??= { members: null };
    this.entries.set(guild.id, entry);
    entry.pending = (async () => {
      try {
        const members = await guild.members.fetch();
        entry.members = [...members.values()].filter((member) => !member.user.bot);
        entry.expiresAt = this.now() + this.ttlMs;
      } catch (error) {
        entry.expiresAt = this.now() + this.retryMs;
        console.warn("Member snapshot unavailable:", guild.id, error.message);
      } finally {
        entry.pending = null;
      }
      return entry.members;
    })();
    return entry.pending;
  }
}
