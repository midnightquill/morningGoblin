# Discord Morning Bot

A very unserious Discord bot that enforces the sacred act of saying good morning, keeps a roster of who checked in, nudges people who talk before greeting the dawn, and occasionally answers like a tiny caffeinated office goblin.

## What it does

- Posts a daily morning reminder in one configured channel without using `@everyone`
- Tracks each person's first accepted good-morning message of the day
- Accepts both normal openings like `gm`, `good morning gamers`, and inside-joke patterns like `Mong Plorps`
- Gives silly replies for check-ins, duplicate check-ins, nudges, and follow-up census posts
- Nudges people once per day if they start chatting before saying good morning
- Posts a later morning census with current check-in totals
- Talks back when people mention it, reply to it, or use configured wake words like `morning goblin`
- Lets the bot owner make it speak in any channel without exposing the command publicly
- Lets the bot owner change the bot's Discord presence from Discord itself
- Refuses to start a second copy of the bot if one is already running

## Requirements

- Node.js `20.11+`
- A Discord bot application with these intents enabled:
  - `MESSAGE CONTENT INTENT`
  - `SERVER MEMBERS INTENT`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`.

3. Fill in at least your bot token:

   ```env
   DISCORD_TOKEN=your-bot-token-here
   ```

4. If you want owner-only commands, also set:

   ```env
   BOT_OWNER_ID=your-discord-user-id-here
   ```

5. Start the bot:

   ```bash
   npm start
   ```

Windows PowerShell note: if `npm` is blocked by execution-policy weirdness, use `npm.cmd install` and `npm.cmd start` instead.

## Environment Variables

From [.env.example](C:/Dev/Codex/Discord Morning Bot/.env.example):

- `DISCORD_TOKEN`: required bot token
- `BOT_OWNER_ID`: optional Discord user ID for owner-only commands
- `COMMAND_PREFIX`: defaults to `!gm`
- `DEFAULT_TIMEZONE`: defaults to `America/Phoenix`
- `MORNING_REMINDER_HOUR`: defaults to `8`
- `MORNING_REMINDER_MINUTE`: defaults to `0`
- `MORNING_FOLLOWUP_HOUR`: defaults to `10`
- `MORNING_FOLLOWUP_MINUTE`: defaults to `30`
- `MORNING_WINDOW_END_HOUR`: defaults to `12`

## Commands

### Server/admin commands

These require `Manage Server`:

- `!gm here`
  Sets the current channel as the morning check-in channel.
- `!gm off`
  Disables the bot in the current server.
- `!gm status`
  Shows today's check-in count and roster.
- `!gm phrases`
  Shows the configured accepted morning openings.
- `!gm reload`
  Reloads `config/morning-config.json` without restarting.
- `!gm test`
  Posts the morning reminder immediately.
- `!gm timezone America/New_York`
  Sets the server timezone used for reminders and check-ins.
- `!gm help`
  Shows the command list.

### Owner-only commands

These ignore `Manage Server` and instead check `BOT_OWNER_ID`:

- `!gm say hello goblins`
  Makes the bot speak in the current channel without a success reply.
- `!gm sayto #general hello goblins`
  Makes the bot speak in another channel without a success reply.
- `!gm presence watching for Mong Plorps`
  Changes the bot's Discord presence and saves it for future restarts.
- `!gm presence reset`
  Restores the default presence.

Supported presence types:

- `playing`
- `watching`
- `listening`
- `competing`

Examples:

```text
!gm say good morning, my goblin shareholders
!gm sayto #general the goblin has entered the building
!gm presence watching for illegal pre-gm chatter
!gm presence playing clipboard simulator
!gm presence reset
```

## What Counts As Good Morning

The accepted greetings live in [config/morning-config.json](C:/Dev/Codex/Discord Morning Bot/config/morning-config.json).

### `acceptedStarts`

The bot checks whether a message starts with one of these phrases. That means a short entry like `gm` automatically allows variants such as:

- `gm friends`
- `gm gamers`
- `gm gang`
- `good morning people`

### `acceptedPatterns`

You can also define full regex patterns for inside jokes. The current config includes:

```json
"acceptedPatterns": [
  "^m[a-z'-]*\\s+p[a-z'-]*$"
]
```

That means two-word greetings shaped like `M... P...` count too, such as:

- `Mong Plorps`
- `Morning People`
- `Murple Plangles`

## Configuring The Goblin Personality

Most of the bot's personality lives in [config/morning-config.json](C:/Dev/Codex/Discord Morning Bot/config/morning-config.json).

Main message pools:

- `reminderLines`
- `checkInReplies`
- `duplicateReplies`
- `nudgeReplies`
- `noCheckInsFollowups`

If a `nudgeReplies` line contains `{channel}`, the bot replaces that with the configured morning-channel mention.

After editing the config, either restart the bot or run:

```text
!gm reload
```

## Conversation Mode

Conversation settings also live under `conversation` in [config/morning-config.json](C:/Dev/Codex/Discord Morning Bot/config/morning-config.json).

The goblin replies when:

- someone directly mentions the bot
- someone replies to a bot message
- someone says a configured wake word such as `morning goblin` or `goblin`

Behavior notes:

- Direct mentions always reply.
- Wake-word chatter and reply-to-bot chatter still use cooldowns.
- Mention replies and generic replies use shuffled pools so they repeat less often.

Useful config keys:

- `wakeWords`
- `mentionReplies`
- `genericReplies`
- `keywordRules`
- `channelCooldownSeconds`
- `userCooldownSeconds`

Each keyword rule contains:

- `triggers`
- `replies`

So if a message contains something like `coffee`, `sleepy`, `good bot`, `who are you`, or `what do you do`, the goblin can use a more specific response pool.

## Storage

The bot stores lightweight local state in `data/state.json`, including:

- per-server configuration
- daily check-in data
- saved owner-set presence

## Running It Reliably

If you run the bot from a terminal window on your own computer, it only works while that process is alive. If your machine sleeps, reboots, or the terminal closes, the bot goes offline.

The bot now creates a lock file at `data/bot.lock` while running and will refuse to start a second copy. That prevents duplicate reminders and doubled command responses when two processes are launched by accident.

## Security Notes

- Keep `.env` out of git.
- Regenerate the Discord bot token immediately if you ever paste it somewhere unsafe.
- `BOT_OWNER_ID` is just an identifier, not a secret.
