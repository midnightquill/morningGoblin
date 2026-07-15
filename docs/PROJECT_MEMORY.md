# Project Memory

Last updated: 2026-07-13

## Purpose

Morning Goblin is a Discord.js bot for a specific friend server. Its main job is to:

- optionally post a daily good-morning reminder in one configured channel
- log who checked in each day
- nudge people who talk before saying good morning
- post a short noon recap of current-day check-ins
- playfully call out one random non-checker-inner each morning
- act like a funny, casual, slightly dumb bureaucratic goblin
- provide a small amount of owner/admin control for jokes and maintenance
- rotate between voice packs to keep the bit from going stale
- add light daily novelty through micro-quests, rare shiny bonus rewards, streak celebrations, and weekly office titles

The personality direction is intentional: funny, casual, sarcastic, and a little stupid, but not mean-spirited.

## Repo Map

- `src/index.js`: main bot logic, commands, scheduling, conversation behavior, record tracking
- `src/config.js`: config loading, cleaning, fallback defaults
- `src/message-guard.js`: serialized last-author checks for every outbound Discord message
- `src/storage.js`: coalescing JSON persistence layer for `data/state.json`
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

- "Morning somewhere in the USA" currently means `12:00 AM` through `11:59 AM` local time in at least one of these zones: Eastern, Central, Mountain, Arizona, Pacific, Alaska, Hawaii.
- live check-ins and catch-up scans both judge that rule against the message timestamp, not the bot's current clock at processing time

If a message looks like a good-morning but it is no longer morning anywhere in the U.S., the bot rejects it with a sarcastic reply from `invalidCheckInReplies` and tells the user to try again tomorrow. Those replies also joke about Jak / pretending to be Jak.

### Check-in responses

On a valid check-in:

- the user is logged for the day
- the bot attempts to react with a random morning-themed emoji
- the bot sends a text reply from `checkInReplies` or `duplicateReplies` unless the user is on the quiet list; those pools use shuffle-bag rotation to reduce repeats
- first check-ins can append a micro-quest prompt, a rare shiny bonus reward, and/or a streak celebration
- streak celebrations currently fire at 3 days, 7 days, and comeback check-ins after a missed day

Quiet-list exception:

- users on the per-guild quiet list still get logged and reacted to
- they do not get the extra text reply
- quiet users also do not receive streak, shiny, or micro-quest text because those are part of the suppressed reply

### Scheduler

Current scheduled behavior:

- reminder logic still exists, but scheduled reminder posting is disabled by default
- random offender callout: `8:00 AM` in `America/Phoenix`
- noon recap: `12:00 PM` in `America/Los_Angeles`
- nudge window: through `12:59 PM` in the guild timezone
- noon recaps occasionally include a non-pinging weekly office-title watch when the current weekly board has a leader

The scheduler runs every 30 seconds.

### Nudge behavior

Between reminder time and end-of-window:

- if a user talks before checking in
- and they have not already been nudged that day
- the bot replies once with a nudge toward the configured morning channel

### Conversation mode

Current intended behavior:

- direct mentions usually reply
- direct mentions with evening greetings like `good evening` / `good night` get a moon reaction instead of a text reply
- replies to one of the bot's messages may reply
- configured wake words like `morning goblin` / `goblin` may reply
- plain unrelated conversation should not trigger replies just because it contains a keyword
- wake words are removed before keyword matching, and keywords match complete words or phrases instead of arbitrary substrings
- direct requests for silence are consumed without a reply

Keyword rules should only matter after one of the real trigger paths above.

Conversation pools:

- `mentionReplies`
- `genericReplies`
- `keywordRules`

Anti-repeat behavior:

- mention/generic/keyword replies use pool-bag rotation instead of pure random choice
- direct mentions bypass cooldowns so they feel responsive
- wake-word / reply-based chatter still respects cooldowns
- every outbound message checks the channel's newest message; if the bot wrote it, nothing else is sent until another sender posts

## Records, Points, and Facts

These were added after the earlier README versions.

### Daily records

Per guild, the bot tracks:

- `best`: highest completed day count
- `worst`: lowest completed day count

The records live in guild state under `records`.

Important detail:

- records are finalized on day rollover and also refreshed during the scheduled noon recap
- a new best day triggers a celebration post during the scheduled noon recap that tags the contributors who set the record

`!gm status` should include current-day roster plus saved best/worst record summary.

### Points and champions

Per guild, the bot now awards `1` point for each person's first successful GM of the day.

Tracked scoreboards:

- current week
- current month
- current year
- lifetime total

Behavior:

- points are only awarded on the first successful check-in of the day
- manual `logadd` and `logreply` award a point if they create a new same-day check-in
- owner-only `!gm resetpoints` wipes that guild's scoreboards, champion history, and pending champion announcements back to a fresh season starting today
- weeks run Monday through Sunday in the guild timezone
- weekly champions are finalized and announced only near the end of Sunday; monthly champions only near the end of the last calendar day; yearly champions only near the end of December 31
- champion results due on the same boundary are combined into one post, and a missed boundary announcement is never posted late
- ties become co-champions

`!gm points` shows the live scoreboards plus the most recent saved champions.

`!gm stats` is a regular user command for the `rank-check🏆` channel. It shows the caller's lifetime GM count, all-time rank, and current week/month/year points.


### Stream tracker

The bot keeps a simple top-level `streamTracker.lastStreamDateKey`.

Behavior:

- default date is `2025-04-26`
- `!gm stream` reports how many days it has been since that date using the default timezone
- owner-only `!gm streamed YYYY-MM-DD` or `today` updates the saved date

### Morning facts

The bot has a rotating bank of morning facts in `morningFacts`.

Command:

- `!gm fact`
- alias: `!gm morningfact`

Behavior:

- should rotate through facts without immediate back-to-back repeats
- current config contains 20 vetted facts; the checked-in voice packs currently inherit that shared bank

## Freshness Features

### Voice packs

Per guild, `voicePackKey` selects the active voice pack.

- `fresh`: top-level active pools in `config/morning-config.json`
- `classic`: generated from `retiredMessagePools.pools` when that archive exists
- `chaos`: configured under `voicePacks.chaos`

`!gm voice` shows the current pack and available packs. `!gm voice <pack>` requires `Manage Server` and clears the in-memory shuffle bags so old lines do not leak after a season switch.

### Micro-quests

Micro-quests are optional daily prompts from `microQuests.prompts`.

- enabled by default through `microQuests.enabled`
- per-guild override lives in `microQuestsEnabled`
- today's selected prompt lives in `daily.microQuestPrompt`
- `!gm quest` shows today's prompt
- `!gm quest reroll|on|off|reset` requires `Manage Server`

### Rare shiny replies

First visible check-in replies can append one rare line from `rareShinyReplies` and award bonus points. Probability is controlled by `rareShinyReplyChance`; current config uses `0.02`. The point bonus is controlled by `rareShinyPointReward`; current config uses `7`.

Quiet-list users do not roll for shiny replies because they would not see the discovery line.

### Streaks

Per-user streak state lives under `streaks.users.<userId>`.

Fields:

- `current`
- `best`
- `lastDateKey`

Milestone lines come from `streakCelebrations.threeDay`, `streakCelebrations.sevenDay`, and `streakCelebrations.comeback`.

### Weekly office titles

Weekly point-period finalization saves `officeTitle` on the champion history entry. Titles come from `officeTitles.weekly` and appear in weekly champion announcements plus `!gm points`. Noon recap previews are controlled by `weeklyTitleWatchChance`, currently `0.25`, so the title watch only shows up occasionally before the weekly title is won.

## Commands

### User commands

- `!gm status`
- `!gm points`
- `!gm stats`
- `!gm stream`
- `!gm fact`
- `!gm phrases`
- `!gm voice`
- `!gm quest`
- `!gm help`

### Admin/server commands

Require `Manage Server`:

- `!gm here`
- `!gm off`
- `!gm voice <pack>`
- `!gm quest reroll|on|off|reset`
- `!gm reload`
- `!gm quiet @user`
- `!gm unquiet @user`
- `!gm quietlist`
- `!gm test`
- `!gm timezone America/New_York`

### Owner-only commands

Require `BOT_OWNER_ID` match:

- `!gm say ...`
- `!gm sayto #channel ...`
- `!gm presence watching ...`
- `!gm presence reset`
- `!gm offline`
- `!gm streamed <date>`
- `!gm resetpoints`
- `!gm logadd @user #channel <messageId>`
- `!gm logreply #channel <messageId>`
- `!gm catchup <hours>`

Presence behavior:

- manual owner-set presence persists in state
- when reset, the bot falls back to a rotating built-in pool of 60+ short funny statuses
- the auto-rotation timer picks a new status every 6-12 hours
- activity names are normalized before being sent so Discord does not render doubled verbs such as `Watching watching ...`
- an offline return flag is only armed when the departure notice sends; a blocked comeback remains pending until the target channel has a newer message from another sender
- `logadd` lets the owner manually file a same-day check-in from an existing message without triggering public check-in chatter
- `logreply` uses an existing same-day message to file the check-in and attempt the normal goblin reaction/reply on that message
- `catchup` scans the configured morning channel for up to 168 hours of recent history, finds missed valid GMs, skips messages already logged/processed, reacts to each new filing, and reserves the single text response for its aggregate summary; it accepts hour input like `72` and day shorthand like `3d`

## Per-Guild State Schema

Stored in `data/state.json` under `guilds.<guildId>`.

Current important fields:

- `morningChannelId`
- `timezone`
- `voicePackKey`
- `microQuestsEnabled`
- `daily`
- `catchupLoggedCheckIns`
- `suppressedCheckInReplyUserIds`
- `records`
- `points`
- `offlineNotice`
- `streaks`

`daily` includes:

- `dateKey`
- `reminderSent`
- `recapSent`
- `randomOffenderSent`
- `microQuestPrompt`
- `checkIns`
- `nudgedUsers`

`records` includes:

- `best`
- `worst`


`points` includes:

- `lifetime`
- `periods.week`
- `periods.month`
- `periods.year`
- `history.week`
- `history.month`
- `history.year`
- `pendingAnnouncements`
`offlineNotice` includes:

- `pendingReturn`
- `channelId`

`streaks.users.<userId>` includes:

- `current`
- `best`
- `lastDateKey`

Top-level state also includes:

- `botPresence`
- `streamTracker`

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
- `morningFacts`
- `conversation`
- `retiredMessagePools`
- `rareShinyReplyChance`
- `rareShinyPointReward`
- `rareShinyReplies`
- `microQuests`
- `streakCelebrations`
- `officeTitles`
- `weeklyTitleWatchChance`
- `voicePacks`

`retiredMessagePools` is not loaded into the default active pools. When present, `src/config.js` exposes it as the generated `classic` voice pack so old active lines can be preserved and temporarily restored without moving them back into the top-level pools.

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
cd "C:\Dev\morningGoblin"
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
- Automated coverage currently focuses on configuration, outbound-message guarding, and persistence; Discord integration paths still need manual verification.
- `src/index.js` is large and has accumulated many feature edits; future refactors should probably split it into modules.

## Good Future Refactors

High-value cleanup ideas:

- split `src/index.js` into commands, scheduler, conversation, check-ins, and records modules
- add a tiny test harness for command parsing and greeting acceptance
- formalize state migration helpers in `src/storage.js`
- consider moving records/facts/command docs into smaller structured modules or docs
- add a hosted deployment guide for Raspberry Pi / systemd if that becomes the chosen permanent host
