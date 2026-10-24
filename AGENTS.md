# Morning Goblin development

Read `docs/PROJECT_MEMORY.md` for product decisions, `README.md` for commands, and `docs/NORTHFLANK_SETUP.md` for the live deployment. For Codex Cloud setup and phone development, read `docs/CODEX_CLOUD_SETUP.md`.

## Install and validate

- Use Node.js 24 LTS and npm. The lockfile is checked in; install with `npm ci`.
- Run `npm run check` and `npm test` for behavior changes. The current baseline is 58 passing tests.
- Tests use fake Discord channels and temporary/in-memory state. Importing `src/index.js` does not log in. No production token, `.env`, saved attendance, or live Discord access is required for development checks.
- `npm start` connects the real Discord bot when supplied with a token. Use the offline checks during normal development; do not start a second production bot in a development environment.
- On Windows, use `npm.cmd` if PowerShell blocks the npm script. In restricted Windows environments, tests may need `TEMP` and `TMP` pointed at a writable folder under `node_modules/.cache/`.

## Live deployment and state

- Production runs on Northflank service `morning-goblin`, one instance, US Central, with the persistent `goblin-data` volume mounted at `/app/data`.
- GitHub `main` is the deployment source. Normal commits pushed to `main` automatically build and deploy. Use `[skip ci]` for documentation-only commits when no deployment is needed. Use the `codex/` prefix when creating new branches.
- The Northflank volume is authoritative for scores and history. Any local `data/state.json` is a stale development/backup copy; never overwrite live state with it. A rollback must first stop the cloud bot and recover its latest state.
- The old Windows bot and its scheduled `Morning Goblin Watchdog` task remain stopped/disabled.
- The Docker image defaults to setup mode. The live Northflank runtime overrides `BOT_MIGRATION_HOLD=false`; preserve that setting and the existing volume when deploying updates.
- Keep `.env`, runtime data, backups, private migration files, and credentials out of Git. Production secrets belong in Northflank. The Docker build context is explicitly allowlisted.

## Preserve product behavior

- Never send two consecutive bot messages in a channel. Keep the shared message guard and per-guild work queue in all new outbound paths.
- Do not use `@everyone` or `@here`. Keep explicit allowed-mention controls.
- First accepted GM per user/day gets one point; the rare shiny reward is seven extra points. Preserve durable ledger deduplication, original timestamps, streaks, and recovery behavior.
- Count greetings only while it is morning somewhere in the U.S. Preserve accepted inside-joke greetings and clear late-rejection replies.
- Quiet and vacation preferences must keep their existing effects. The bot should respond to directed conversation without unsolicited chatter.
- Keep the tone funny, casual, absurd, and friendly. Topic/help replies should remain useful. Preserve the `classic` voice pack and archived lines.
- Update the relevant README, project memory, and runbook when behavior, configuration, persistence, or operations change.
