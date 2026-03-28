# Discord Morning Bot

A very unserious Discord bot that enforces the sacred act of saying good morning, keeps a roster of who checked in, nudges people who talk before greeting the dawn, and occasionally answers like a tiny caffeinated office goblin.

## What it does

- Posts a daily morning reminder in one configured channel without using `@everyone`
- Tracks each person's first accepted good-morning message of the day
- Accepts both normal openings like `gm`, `good morning gamers`, and inside-joke patterns like `Mong Plorps`
- Only counts a good-morning message when it is still morning somewhere in the United States
- Gives silly replies for check-ins, duplicate check-ins, nudges, and follow-up census posts
- Nudges people once per day if they start chatting before saying good morning
- Posts a later morning census with current check-in totals
- Talks back when people mention it, reply to it, or use configured wake words like `morning goblin`
- Tracks best and worst completed good-morning days per server
- Celebrates brand-new best-day records by tagging the people who helped set them
- Awards one point for each person's first successful GM of the day and keeps weekly/monthly/yearly scoreboards
- Declares weekly, monthly, and yearly good-morning champions automatically in the morning channel
- Can serve a rotating bank of morning facts with `!gm fact`
- Can report how many days it has been since the last stream with `!gm stream`
- Lets the bot owner make it speak in any channel without exposing the command publicly
- Auto-rotates through a big pool of funny Discord statuses every 6-12 hours when no manual owner override is set
- Lets the bot owner change the bot's Discord presence from Discord itself
- Lets the bot owner announce a temporary goblin outage and automatically post a comeback message on the next startup
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

## Stream tracker

The bot also keeps a simple last-stream date and can tell the server how many days it has been since the most recent stream.

Defaults:

- last-stream date starts at `2025-04-26`
- `!gm stream` reports the current drought length
- owner-only `!gm streamed YYYY-MM-DD` or `!gm streamed today` updates the stored date

## Points and champions

Per guild, the bot now awards `1` point for each person's first successful good morning of the day.

It keeps four scoreboards:

- current week
- current month
- current year
- lifetime total

When a week, month, or year rolls over, the bot automatically declares the champion in the configured morning channel. Ties become co-champions instead of arbitrary tiebreakers.

Use `!gm points` to see the live board and the most recent champions.

## Commands

### Server/admin commands

These require `Manage Server`:

- `!gm here`
  Sets the current channel as the morning check-in channel.
- `!gm off`
  Disables the bot in the current server.
- `!gm status`
  Shows today's check-in count and roster, plus saved best/worst day records when available.
- `!gm points`
  Shows the current weekly/monthly/yearly GM scoreboards, lifetime leaders, and the most recent champions.
- `!gm stream`
  Shows how many days it has been since the last stream date on file.
- `!gm fact`
  Posts a random morning fact from the configured fact bank without repeating back to back.
- `!gm phrases`
  Shows the configured accepted morning openings.
- `!gm reload`
  Reloads `config/morning-config.json` without restarting.
- `!gm quiet @user`
  Keeps logging that user's check-ins and reacting with emoji, but suppresses the bot's text reply for them.
- `!gm unquiet @user`
  Removes that user from the no-reply check-in list.
- `!gm quietlist`
  Shows which users currently have check-in text replies suppressed.
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
  Changes the bot's Discord presence and saves it as a manual override for future restarts.
- `!gm presence reset`
  Clears the manual override and returns the goblin to automatic status rotation.
- `!gm offline`
  Announces that the goblin is going offline for a bit and queues a one-time comeback announcement for the next startup.
- `!gm resetpoints`
  Resets this server's weekly/monthly/yearly/lifetime GM scoreboards and champion history back to a fresh season.
- `!gm logadd @user #channel 123456789012345678`
  Manually files a same-day good-morning check-in from an existing message or Discord message link.
- `!gm logreply #channel 123456789012345678`
  Logs a same-day check-in from an existing message and then force-reacts and force-replies on that message like the goblin just processed it live.
- `!gm catchup 6`
  Scans the configured morning channel for the last `X` hours, backfills today's missed valid GMs, and retro-processes those messages with the normal reaction/reply behavior.

Supported presence types:

When no manual presence override is set, the bot rotates through 60+ short funny statuses every 6-12 hours.

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
!gm offline
!gm resetpoints
!gm logadd @Somebody #general 123456789012345678
!gm logreply #general 123456789012345678
!gm catchup 6
!gm streamed today
!gm stream
!gm points
!gm points
```

Catch-up note:

- `!gm catchup X` is owner-only and currently accepts whole-hour windows from `1` to `24`
- it only scans the configured morning channel
- it only backfills messages that are from today in the server timezone
- it still enforces the "morning somewhere in the U.S." rule using the message timestamp

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
  "^m[a-z'-]*\\s+p[a-z'-]*[!?.,;:]*$"
]
```

That means two-word greetings shaped like `M... P...` count too, such as:

- `Mong Plorps`
- `Morning People`
- `Murple Plangles`
- `Mission Progress?`
- `moldy pizza!`

A good morning only counts if it is still morning somewhere in the United States. The bot checks several U.S. time zones, including East Coast, Central, Mountain, Arizona, Pacific, Alaska, and Hawaii. In practice, that means the legal morning window stays open until Hawaii finishes morning.

If someone sends a valid-looking morning greeting after that window closes, the bot rejects it, tells them it does not count, tells them to try again tomorrow, and accuses them of possibly being Jak. Those rejection lines come from `invalidCheckInReplies` in the config.

## Configuring The Goblin Personality

Most of the bot's personality lives in [config/morning-config.json](C:/Dev/Codex/Discord Morning Bot/config/morning-config.json).

Main message pools:

- `reminderLines`
- `checkInReplies`
- `duplicateReplies`
- `nudgeReplies`
- `noCheckInsFollowups`
- `invalidCheckInReplies`
- `morningFacts`

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
- Plain unrelated messages no longer trigger replies just because they accidentally matched a keyword.
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
