# Maintainer Runbook

Last updated: 2026-04-02

## First Places To Look

If you need context fast, read these in order:

1. `docs/PROJECT_MEMORY.md`
2. `README.md`
3. `src/index.js`
4. `config/morning-config.json`
5. `data/state.json`

## Common Tasks

### Restart the bot on Windows

```powershell
cd "C:\Dev\Codex\Discord Morning Bot"
Ctrl+C
npm.cmd start
```

### Install dependencies

```powershell
cd "C:\Dev\Codex\Discord Morning Bot"
npm.cmd install
```

### Syntax-check the main code

```powershell
& 'C:\Program Files\nodejs\node.exe' --check 'C:\Dev\Codex\Discord Morning Bot\src\index.js'
& 'C:\Program Files\nodejs\node.exe' --check 'C:\Dev\Codex\Discord Morning Bot\src\config.js'
```

### Reload config without restarting

In Discord:

```text
!gm reload
```

### Push to GitHub

```powershell
cd "C:\Dev\Codex\Discord Morning Bot"
git status --short
git add .
git commit -m "Your message"
git push
```

## Troubleshooting

### Bot seems to reply twice

Likely cause:

- two bot processes are running at once

Check:

```powershell
Get-Process node
```

The bot has a lock-file safeguard, but if behavior ever looks duplicated, check for multiple Node processes anyway.

### `npm` not recognized

Node.js is not installed or PowerShell was not reopened after install.

### `npm.ps1 cannot be loaded because running scripts is disabled`

Use:

```powershell
npm.cmd install
npm.cmd start
```

Optional permanent fix:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Bot ignores messages

Check:

- `MESSAGE CONTENT INTENT`
- `SERVER MEMBERS INTENT`
- bot token in `.env`
- bot permissions in the target channel
- whether the message was actually in a guild channel

### Bot repeats the same replies too often

Check:

- that config actually loaded
- whether the conversation pool in config is large enough
- whether the running bot was restarted or reloaded after edits

### Config JSON fails to load

Windows BOM/encoding issues previously caused fallback config behavior. `src/config.js` was hardened for this, but if it happens again, re-save `config/morning-config.json` as UTF-8 without weird editor transformations and restart/reload.

## Deployment Notes

### Local Windows machine

Works, but only while the machine stays awake and the process remains running.

### Raspberry Pi

A Raspberry Pi 3 should be able to run this bot. It is lightweight enough for a Pi-class host. Long-term best practice would be a `systemd` service.

### Cloud hosting

Earlier discussion concluded:

- Railway is the easiest paid option
- Oracle Cloud Always Free is a possible free option with more setup pain
- GitHub Actions is not suitable for a 24/7 Discord bot

## Discord App Portal Notes

Required intents:

- `MESSAGE CONTENT INTENT`
- `SERVER MEMBERS INTENT`

Recommended permissions:

- View Channels
- Send Messages
- Read Message History
- Add Reactions

## Owner / Admin Notes

### Owner-only features

Controlled by `BOT_OWNER_ID`.

- `say`
- `sayto`
- `presence`
- `offline`
- `resetpoints`
- `logadd`
- `logreply`
- `catchup`

Presence note:

- manual `presence` changes override the automatic status rotation
- `presence reset` puts the bot back on the built-in 6-12 hour rotation pool

### Quiet list

Stored per guild in `data/state.json` under `suppressedCheckInReplyUserIds`.

Commands:

- `!gm quiet @user`
- `!gm unquiet @user`
- `!gm quietlist`

### Offline notice

Stored per guild in `data/state.json` under `offlineNotice`.

Behavior:

- `!gm offline` posts a temporary outage notice in the configured morning channel when possible
- on the next startup, the bot posts one comeback message and clears the flag

### Manual log add

Owner-only `!gm logadd` can backfill a same-day check-in from an existing message id or message link. It validates that the message is from this guild, is from today in the guild timezone, and matches the named user if one was provided.

Owner-only `!gm logreply` uses that same-day message reference flow too, but also force-reacts and force-replies on the target message so it looks like the goblin processed it live later.

Owner-only `!gm catchup 6` scans the configured morning channel for recent messages from the last `X` hours, finds today's valid missed GMs, and retro-processes them in timestamp order. It only backfills the current day; older days are not reconstructible with the current state model.

### Records and points

Stored per guild in `data/state.json` under `records`.

Intended behavior:

- new best days should get a celebration post during the noon recap
- worst day is the lowest completed-day count seen so far
- each user's first successful GM of the day awards 1 point
- owner-only `!gm resetpoints` should wipe the current guild's points state back to a fresh season starting today
- week/month/year champions are finalized on rollover and announced later in the morning channel
- `!gm points` should show the live scoreboards plus recent champions

## Security Checklist

- never commit `.env`
- never commit ad-hoc token dump files
- if a Discord bot token is exposed, regenerate it in the Discord Developer Portal and update `.env`
- Discord user IDs are fine to store; they are identifiers, not secrets

## Documentation Habit

When making meaningful feature changes, update at least these if relevant:

- `README.md` for user/admin-facing behavior
- `docs/PROJECT_MEMORY.md` for architecture and decisions
- `docs/MAINTAINER_RUNBOOK.md` for operational gotchas

If a change affects persisted state, also add a note in `docs/PROJECT_MEMORY.md` under state/schema or caveats.
