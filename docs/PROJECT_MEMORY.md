# Project Memory

Last updated: 2026-03-12

## Purpose

Morning Goblin is a Discord.js bot for a specific friend server. Its main job is to:

- post a daily good-morning reminder in one configured channel
- log who checked in each day
- nudge people who talk before saying good morning
- act like a funny, casual, slightly dumb bureaucratic goblin
- provide a small amount of owner/admin control for jokes and maintenance

The personality direction is intentional: funny, casual, sarcastic, and a little stupid, but not mean-spirited.

## Repo Map

- `src/index.js`: main bot logic, commands, scheduling, conversation behavior, record tracking
- `src/config.js`: config loading, cleaning, fallback defaults
- `src/storage.js`: JSON file persistence layer for `data/state.json`
- `config/morning-config.json`: phrase lists, reply pools, conversation content, facts
- `data/state.json`: runtime state and per-guild persisted settings
- `assets/`: bot icon assets
- `README.md`: user-facing setup/customization docs
- `.env.example`: required env vars

## Core Behavior

### Morning check-ins

A message counts as a valid morning check-in when all of these are true:

- it matches an accepted opening in `acceptedStarts` or a regex in `acceptedPatterns`
- it is still morning somewhere in the United States
- it is sent in a guild channel, not a DM

Current notable acceptance rules:

- normal starts like `gm`, `good morning`, `mornin`, etc.
- the inside-joke regex for `M... P...` greetings such as `Mong Plorps`

Important rule:

- "Morning somewhere in the USA" currently means `5:00 AM` through `11:59 AM` local time in at least one of these zones: Eastern, Central, Mountain, Arizona, Pacific, Alaska, Hawaii.

If a message looks like a good-morning but it is no longer morning anywhere in the U.S., the bot rejects it with a sarcastic reply from `invalidCheckInReplies` and tells the user to try again tomorrow. Those replies also joke about Jak / pretending to be Jak.

### Check-in responses

On a valid check-in:

- the user is logged for the day
- the bot attempts to react with `☀️`
- the bot may send a text reply from `checkInReplies` or `duplicateReplies`

Quiet-list exception:

- users on the per-guild quiet list still get logged and reacted to
- they do not get the extra text reply

### Scheduler

Per guild, using that guild's configured timezone:

- reminder: `8:00 AM`
- follow-up/census: `10:30 AM`
- nudge window: through `12:59 PM`

The scheduler runs every 30 seconds.

### Nudge behavior

Between reminder time and end-of-window:

- if a user talks before checking in
- and they have not already been nudged that day
- the bot replies once with a nudge toward the configured morning channel

### Conversation mode

Current intended behavior:

- direct mentions always reply
- replies to one of the bot's messages may reply
- configured wake words like `morning goblin` / `goblin` may reply
- plain unrelated conversation should not trigger replies just because it contains a keyword

Keyword rules should only matter after one of the real trigger paths above.

Conversation pools:

- `mentionReplies`
- `genericReplies`
- `keywordRules`

Anti-repeat behavior:

- mention/generic replies use pool-bag rotation instead of pure random choice
- direct mentions bypass cooldowns so they feel responsive
- wake-word / reply-based chatter still respects cooldowns

## Records and Facts

These were added after the earlier README versions.

### Daily records

Per guild, the bot tracks:

- `best`: highest completed day count
- `worst`: lowest completed day count

The records live in guild state under `records`.

Important detail:

- records are updated when the scheduled follow-up runs, not instantly on each check-in
- a new best day triggers a celebration post that tags the contributors who set the record

`!gm status` should include current-day roster plus saved best/worst record summary.

### Morning facts

The bot has a rotating bank of morning facts in `morningFacts`.

Command:

- `!gm fact`
- alias: `!gm morningfact`

Behavior:

- should rotate through facts without immediate back-to-back repeats
- current config contains 36 facts

## Commands

### Admin/server commands

Require `Manage Server`:

- `!gm here`
- `!gm off`
- `!gm status`
- `!gm fact`
- `!gm phrases`
- `!gm reload`
- `!gm quiet @user`
- `!gm unquiet @user`
- `!gm quietlist`
- `!gm test`
- `!gm timezone America/New_York`
- `!gm help`

### Owner-only commands

Require `BOT_OWNER_ID` match:

- `!gm say ...`
- `!gm sayto #channel ...`
- `!gm presence watching ...`
- `!gm presence reset`
- `!gm offline`

Presence behavior:

- manual owner-set presence persists in state
- when reset, the bot falls back to a rotating built-in pool of 60+ short funny statuses
- the auto-rotation timer picks a new status every 6-12 hours
- auto statuses are worded to read naturally in the Discord sidebar even when Discord hides the activity type label

## Per-Guild State Schema

Stored in `data/state.json` under `guilds.<guildId>`.

Current important fields:

- `morningChannelId`
- `timezone`
- `daily`
- `suppressedCheckInReplyUserIds`
- `records`
- `offlineNotice`

`daily` includes:

- `dateKey`
- `reminderSent`
- `followupSent`
- `checkIns`
- `nudgedUsers`

`records` includes:

- `best`
- `worst`

`offlineNotice` includes:

- `pendingReturn`
- `channelId`

Top-level state also includes:

- `botPresence`

Important presence note:

- `botPresence` is only the saved manual owner override
- auto-rotating statuses are generated in-memory and become active whenever `botPresence` is `null`

## Config Schema Highlights

In `config/morning-config.json`:

- `acceptedStarts`
- `acceptedPatterns`
- `reminderLines`
- `checkInReplies`
- `duplicateReplies`
- `invalidCheckInReplies`
- `nudgeReplies`
- `noCheckInsFollowups`
- `morningFacts`
- `conversation`

`conversation` contains:

- `enabled`
- `wakeWords`
- `channelCooldownSeconds`
- `userCooldownSeconds`
- `mentionReplies`
- `genericReplies`
- `keywordRules`

## Operational Notes

### Runtime / restart

Typical Windows restart:

```powershell
cd "C:\Dev\Codex\Discord Morning Bot"
Ctrl+C
npm.cmd start
```

### Duplicate-process protection

The bot creates `data/bot.lock` while running.

If a second process starts, it should fail fast instead of double-posting. This was added after the user accidentally ran two copies at once and saw duplicated command output.

### Git / GitHub

- repo remote is GitHub over SSH
- pushes from this environment now work
- stray local files like SSH key material should never be committed

### Security

- `.env` must stay out of git
- bot token should be regenerated immediately if exposed
- `BOT_OWNER_ID` is not sensitive

## Important Thread Decisions

These are user-driven product decisions that should be preserved.

- Do not use `@everyone` in normal bot messaging.
- Tone should stay funny, casual, sarcastic, and dumb.
- Owner `say` command should not post a noisy success confirmation.
- Owner should be able to run `sayto` from a hidden channel and have the bot post in a public channel.
- The bot should accept `Mong Plorps`-style greetings.
- Good mornings only count if it is still morning somewhere in the U.S.
- Rejected late good-mornings should joke about Jak / pretending to be Jak.
- Some users may want check-ins logged without getting a text reply, hence the quiet list.
- The bot should have a visible Discord presence and owner control over that presence.
- The bot should not chatter in unrelated conversation anymore.

## Current Known Caveats

- The bot ignores DMs entirely because the main message handler exits unless `message.inGuild()` is true.
- DMing other users as the bot is not implemented.
- There are no automated tests in the repo yet.
- `src/index.js` is large and has accumulated many feature edits; future refactors should probably split it into modules.

## Good Future Refactors

High-value cleanup ideas:

- split `src/index.js` into commands, scheduler, conversation, check-ins, and records modules
- add a tiny test harness for command parsing and greeting acceptance
- formalize state migration helpers in `src/storage.js`
- consider moving records/facts/command docs into smaller structured modules or docs
- add a hosted deployment guide for Raspberry Pi / systemd if that becomes the chosen permanent host
