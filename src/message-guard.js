function getFirstMessage(messages) {
  if (typeof messages?.first === "function") {
    return messages.first() ?? null;
  }

  return messages?.values?.().next().value ?? null;
}

export class ChannelMessageGuard {
  constructor(getBotUserId) {
    this.getBotUserId = getBotUserId;
    this.lastAuthorByChannel = new Map();
    this.lastMessageIdByChannel = new Map();
    this.sendQueues = new Map();
  }

  observeMessage(message) {
    if (message?.channelId && message.author?.id) {
      const previousId = this.lastMessageIdByChannel.get(message.channelId);
      if (previousId && /^\d+$/.test(previousId) && /^\d+$/.test(message.id ?? "") && BigInt(previousId) > BigInt(message.id)) return;
      this.lastAuthorByChannel.set(message.channelId, message.author.id);
      if (message.id) this.lastMessageIdByChannel.set(message.channelId, message.id);
    }
  }

  invalidate(channelId) {
    if (channelId) {
      this.lastAuthorByChannel.delete(channelId);
      this.lastMessageIdByChannel.delete(channelId);
    } else {
      this.lastAuthorByChannel.clear();
      this.lastMessageIdByChannel.clear();
    }
  }

  async canSend(channel) {
    const botId = this.getBotUserId();
    if (!botId) return false;
    const latest = await this.getLatestAuthor(channel);
    return latest.known && latest.authorId !== botId;
  }

  async getLatestAuthor(channel) {
    if (this.lastAuthorByChannel.has(channel?.id)) {
      return {
        known: true,
        authorId: this.lastAuthorByChannel.get(channel.id),
      };
    }

    if (typeof channel?.messages?.fetch === "function") {
      try {
        const messages = await channel.messages.fetch({ limit: 1 });
        if (this.lastAuthorByChannel.has(channel.id)) {
          return { known: true, authorId: this.lastAuthorByChannel.get(channel.id) };
        }
        const latestMessage = getFirstMessage(messages);
        const authorId = latestMessage?.author?.id ?? null;
        this.lastAuthorByChannel.set(channel.id, authorId);
        if (latestMessage?.id) this.lastMessageIdByChannel.set(channel.id, latestMessage.id);
        return { known: true, authorId };
      } catch {
        // Fall back to gateway observations below. Unknown state stays blocked.
      }
    }

    return { known: false, authorId: null };
  }

  send(channel, sendMessage) {
    const channelId = channel?.id;

    if (!channelId || typeof sendMessage !== "function") {
      throw new TypeError("A channel and send callback are required.");
    }

    const previousSend = this.sendQueues.get(channelId) ?? Promise.resolve();
    let queuedSend;

    queuedSend = previousSend
      .catch(() => {})
      .then(async () => {
        const botUserId = this.getBotUserId();

        if (!botUserId) {
          return null;
        }

        const latest = await this.getLatestAuthor(channel);

        if (!latest.known || latest.authorId === botUserId) {
          return null;
        }

        const sentMessage = await sendMessage();

        if (sentMessage) {
          this.observeMessage({ id: sentMessage.id, channelId, author: { id: botUserId } });
        }

        return sentMessage;
      })
      .finally(() => {
        if (this.sendQueues.get(channelId) === queuedSend) {
          this.sendQueues.delete(channelId);
        }
      });

    this.sendQueues.set(channelId, queuedSend);
    return queuedSend;
  }
}
