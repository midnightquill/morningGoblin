# Discord Morning Bot

This bot posts a goofy daily good-morning reminder, tracks who has checked in, lightly roasts illegal pre-gm chatter, and now also talks back like a weird little office goblin when people address it.

## What it does

- Posts a daily reminder in a configured channel without using `@everyone`
- Counts each person's first good-morning message of the day
- Accepts multiple morning-opening variations like `gm`, `gm friends`, and `good morning gamers`
- Accepts regex-style inside-joke greetings like the server's `Mong Plorps` format
- Gives silly little replies when people check in
- Nudges people who talk before saying good morning
- Posts a later morning census so the sleepy goblin stats stay current
- Replies when people mention it, reply to one of its messages, or say its wake words

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your bot token.

3. Put your own Discord user ID in `BOT_OWNER_ID` if you want the owner-only speech commands.

4. In the Discord developer portal, enable these privileged intents for the bot:
   - `MESSAGE CONTENT INTENT`
   - `SERVER MEMBERS INTENT`

5. Start the bot:

   ```bash
   npm start
   ```

## Commands

- `!gm here` sets the current channel as the morning check-in channel
- `!gm off` disables the bot for the current server
- `!gm status` shows today's check-in count
- `!gm phrases` shows the accepted morning openings
- `!gm reload` reloads the config file after you edit it
- `!gm say hello goblins` makes the bot speak in the current channel silently (owner only)
- `!gm sayto #general hello goblins` makes the bot speak in another channel silently (owner only)
- `!gm test` posts the reminder immediately
- `!gm timezone America/New_York` overrides the default timezone for this server
- `!gm help` shows the command list

Admins need `Manage Server` permission for setup commands. The `say` and `sayto` commands ignore that and check `BOT_OWNER_ID` instead.

## Customizing What Counts

Edit [config/morning-config.json](C:/Dev/Codex/Discord Morning Bot/config/morning-config.json).

The `acceptedStarts` list controls which message openings count as a check-in. The bot only checks whether a message starts with one of these values, so entries like `gm` automatically allow things like `gm friends`, `gm gang`, and `gm gamers`.

The `acceptedPatterns` list lets you define full regex-style patterns for inside jokes or weird custom greetings. It currently includes the server's `Mong Plorps`-style format, so any two-word message shaped like `M... P...` counts as a morning greeting.

Example:

```json
"acceptedStarts": [
  "gm",
  "good morning",
  "morning nerds",
  "rise and shine"
],
"acceptedPatterns": [
  "^m[a-z'-]*\\s+p[a-z'-]*$"
]
```

After editing the file, either restart the bot or run `!gm reload` in Discord.

## Customizing What The Bot Says

The same config file also controls the bot's message pools:

- `reminderLines`
- `checkInReplies`
- `duplicateReplies`
- `nudgeReplies`
- `noCheckInsFollowups`

The bot picks a random line from each list when it needs one.

If a `nudgeReplies` line includes `{channel}`, the bot replaces that with the configured morning channel mention.

After editing the file, either restart the bot or run `!gm reload`.

## Goblin Conversation Mode

Conversation settings live under `conversation` in [config/morning-config.json](C:/Dev/Codex/Discord Morning Bot/config/morning-config.json).

The goblin replies when any of these are true:

- someone mentions the bot
- someone replies to one of the bot's messages
- someone says one of the configured `wakeWords`, like `morning goblin`

The conversation system uses cooldowns so it does not spam constantly:

- `channelCooldownSeconds` limits how often it can reply in the same channel
- `userCooldownSeconds` limits how often it can reply to the same person

You can customize:

- `wakeWords`
- `mentionReplies`
- `genericReplies`
- `keywordRules`

Each keyword rule has `triggers` and `replies`. If a message contains one of the triggers, the goblin picks a reply from that rule.

Example:

```json
{
  "triggers": ["lunch", "food"],
  "replies": [
    "lunch is just breakfast with different marketing.",
    "food mentioned. goblin interested immediately."
  ]
}
```

## Owner-Only Speak Commands

To use `!gm say` or `!gm sayto`, put your Discord user ID into `.env` like this:

```env
BOT_OWNER_ID=123456789012345678
```

To find your Discord user ID:

1. In Discord, open `User Settings`
2. Go to `Advanced`
3. Turn on `Developer Mode`
4. Right-click your username or profile and click `Copy User ID`

Then restart the bot.

Examples:

```text
!gm say good morning, my beautiful goblin shareholders
!gm sayto #general good morning, my beautiful goblin shareholders
```

These commands do not send a success reply. If you run them from a private mod/admin channel, only that hidden channel sees the command message, while the real bot message appears in the target channel.

Mentions are still suppressed, so the bot will not mass-ping `@everyone` even if you type it.

## Notes

- The bot stores lightweight state in `data/state.json`.
- The default schedule is 8:00 AM for the main reminder and 10:30 AM for the follow-up.
- If the bot is running in a PowerShell window on your PC, it only works while that process is still running.
