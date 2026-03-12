# Maintainer Runbook

Last updated: 2026-03-12

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

### Quiet list

Stored per guild in `data/state.json` under `suppressedCheckInReplyUserIds`.

Commands:

- `!gm quiet @user`
- `!gm unquiet @user`
- `!gm quietlist`

### Records

Stored per guild in `data/state.json` under `records`.

Intended behavior:

- new best days should get a celebration post during follow-up
- worst day is the lowest completed-day count seen so far

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
