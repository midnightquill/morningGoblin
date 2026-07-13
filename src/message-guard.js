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
    this.sendQueues = new Map();
  }

  observeMessage(message) {
    if (message?.channelId && message.author?.id) {
      this.lastAuthorByChannel.set(message.channelId, message.author.id);
    }
  }

  async getLatestAuthor(channel) {
    if (typeof channel?.messages?.fetch === "function") {
      try {
        const messages = await channel.messages.fetch({ limit: 1 });
        const latestMessage = getFirstMessage(messages);
        const authorId = latestMessage?.author?.id ?? null;
        this.lastAuthorByChannel.set(channel.id, authorId);
        return { known: true, authorId };
      } catch {
        // Fall back to gateway observations below. Unknown state stays blocked.
      }
    }

    if (this.lastAuthorByChannel.has(channel?.id)) {
      return {
        known: true,
        authorId: this.lastAuthorByChannel.get(channel.id),
      };
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
          this.lastAuthorByChannel.set(channelId, botUserId);
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
