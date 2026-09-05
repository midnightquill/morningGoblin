# Maintainer Runbook

Last updated: 2026-09-05

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
cd "C:\Dev\morningGoblin"
Ctrl+C
npm.cmd start
```

### Install or run the Windows watchdog

```powershell
cd "C:\Dev\morningGoblin"
npm.cmd run watchdog:install
npm.cmd run watchdog
```

The scheduled task checks every five minutes. It validates the command behind the lock PID plus a fresh heartbeat, Discord readiness, and scheduler progress. Recovery uses backoff. Check `!gm health`, `data/heartbeat.json`, `data/watchdog.log`, and `data/bot.stderr.log` when recovery fails. Run the installer again after updating from the old three-hour schedule.

### Install dependencies

```powershell
cd "C:\Dev\morningGoblin"
npm.cmd install
```

### Check and test the code

```powershell
cd "C:\Dev\morningGoblin"
npm.cmd run check
npm.cmd test
```

### Reload config without restarting

In Discord:

```text
!gm reload
```

### Push to GitHub

```powershell
cd "C:\Dev\morningGoblin"
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

### Champion announcement appears in the wrong server

Likely cause:

- stale state from a test server or old server configuration

The bot now verifies that fetched channels belong to the guild being processed before posting scheduled messages. If a test server is no longer needed, run `!gm off` in that server too so it stops maintaining its own reminders, recaps, and champion state.

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
- `streamed`
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
- on the next startup, the bot attempts one comeback message; if the channel still ends with the outage notice, the flag stays pending until a message from another sender makes the channel eligible

### Manual log add

Owner-only `!gm logadd` can backfill a same-day check-in from an existing message id or message link. It validates that the message is from this guild, is from today in the guild timezone, and matches the named user if one was provided.

Owner-only `!gm logreply` uses that same-day message reference flow too, then attempts the normal reaction/reply behavior on the target message.

Owner-only `!gm catchup 72` or `!gm catchup 3d` scans the configured morning channel for recent messages from the requested window, up to 168 hours. It finds valid missed GMs, skips messages already logged today, already saved by a previous catch-up run, or already processed by the bot in visible Discord history, reacts to each new filing, and posts one aggregate summary. Older backfills update lifetime totals and any still-active period boards; already-closed weekly boards are not rewritten.

### Records and points

Stored per guild in `data/state.json` under `records`.

Intended behavior:

- new best days should get a celebration post during the noon recap
- worst day is the lowest completed-day count seen so far
- each user's first successful GM of the day awards 1 point
- owner-only `!gm resetpoints` should wipe the current guild's points state back to a fresh season starting today
- weeks run Monday through Sunday; week/month/year champions are finalized and announced only near the end of their final local calendar day
- coincident champion results share one message, and missed boundary announcements are not posted late
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

## Reliability upgrade (2026-09-05)

- `src/check-ins.js` owns the durable attendance ledger, first-message preservation, completed-day records, and streak repair. `src/points.js` owns point periods and champion history.
- `src/catch-up.js` saves before reacting and shares the same check-in path as live messages. Automatic recovery scans post-upgrade history in resumable 500-message batches; manual catch-up reports its 5,000-message cap.
- `src/commands.js`, `src/dates.js`, `src/member-cache.js`, `src/message-format.js`, `src/health.js`, and `src/work-queue.js` separate command routing, dates, member snapshots, reply layout, health reporting, and per-guild work ordering.
- `state.backup.json` is the previous committed state. Do not copy a state file over a running bot. Stop the bot first, retain both originals, and validate any restore before restarting. If both files are unusable the bot refuses to start with empty scores.
- `!gm off` now only clears the scheduled channel. It preserves today's ledger.
- Old point totals are preserved. Saved check-in counts are explicitly partial for legacy users; the old state did not retain every historical check-in or shiny award.
- Existing provisional best/worst entries for the active legacy day are recalculated when that day completes. Unknown older incorrect records cannot be reconstructed without older history.
- Keep the existing seven-point shiny reward and strict no-consecutive-post rule unless the server intentionally changes those product rules.
- `!gm prefs quiet on|off`, `!gm prefs callouts on|off`, and `!gm prefs vacation 7d|off` are self-service. Vacation suppresses nagging; it does not freeze streaks or award attendance.
- Follow-ups use blank lines, a bold label, and a quote block inside one message. No extra Discord message or embed permission is required.
- Run `npm.cmd run check` and `npm.cmd test` before deployment. Integration tests use fake Discord channels and in-memory state and never log in.
- For a deliberate watchdog-managed restart after checks, run `powershell.exe -NoProfile -File scripts/watchdog.ps1 -ForceRestart`. This verifies the process command before stopping it.

### Windowless watchdog launch

The watchdog runs every five minutes through `wscript.exe //B //Nologo scripts/watchdog-hidden.vbs`. The wrapper launches PowerShell hidden from process creation, waits for completion, and returns its exit code to Task Scheduler. This avoids the console flash from directly scheduling PowerShell. Re-run `npm.cmd run watchdog:install` to apply this launcher to an existing task. The normal `-ForceRestart` command still works for deliberate manual restarts.
