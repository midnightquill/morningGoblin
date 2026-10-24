# Move Morning Goblin to Northflank

Status: deployment files prepared alongside the audit and personality refresh. The bot still runs on the Windows PC. No cloud deployment or transfer has happened yet.

This guide is a checklist for the assisted migration. Complete account/project setup first; keep the cloud bot in setup mode until the final transfer.

## 1. Account and project

1. Create an account at https://app.northflank.com. GitHub sign-in is convenient.
2. Select **Sandbox** or **Developer Sandbox**, the free plan. Use Northflank's own cloud. A “bring your own cloud” option would require a separate cloud account.
3. Click **Create project**. Name it `morning-goblin`. Choose an available US region (US West is a reasonable choice) and leave advanced settings at their defaults.
4. Confirm the dashboard shows the free plan. The pricing page currently advertises free always-on resources, but the billing documentation differs on whether card verification is required. If the dashboard requires a paid upgrade, review the exact screen before proceeding.

Source: [project setup](https://northflank.com/docs/v1/application/getting-started/create-a-project), [current pricing](https://northflank.com/pricing), [billing documentation](https://northflank.com/docs/v1/application/billing/pricing-on-northflank).

## 2. Publish and connect the code

The repository is `midnightquill/morningGoblin`; use its `main` branch for deployment. Confirm the repository contains the root `Dockerfile` before creating the service. The deployment update includes the audit, refreshed personality, and Northflank preparation. Publishing the code does not transfer saved scores: those move privately at cutover. Never publish `.env`, runtime state, backups, or `morningGoblinBotInfo.txt`.

Connect GitHub in Northflank's Git integrations. If GitHub asks which repositories Northflank can access, select only `morningGoblin`.

Create a **Combined service** (builds the code and runs it) named `morning-goblin`. Select the repository and the branch containing the prepared Dockerfile. Choose **Dockerfile**, with `Dockerfile` at the repository root and build context `.`. Use **one instance** and the free compute option. This bot needs no public port or domain; leave public networking empty. Leave the image's entrypoint in place.

Source: [build and deploy](https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code).

## 3. Storage and setup mode

Add a persistent volume named `goblin-data`, mounted at **`/app/data`**, using **Single Read/Write** access. Pick the smallest size allowed within the free plan, and confirm any displayed cost before creating it. A volume is a disk that retains scores and history when the app restarts. If this account cannot attach one on the free plan, stop at setup mode and reassess storage before switching the live bot.

Keep `BOT_MIGRATION_HOLD=true` in runtime variables. The Dockerfile defaults to that value too. Setup logs should say `Morning Goblin setup mode: not connected to Discord`. This is expected, and it prevents two live copies during migration. No HTTP health check is needed for this background process.

Later, copy the existing `.env` settings into Northflank's **runtime variables/secrets**. They configure the token, owner, command prefix, timezones, and schedules. Copy actual existing values, not the placeholders in `.env.example`. The token belongs in Northflank's secret settings, never a Git commit, Docker build argument, or chat message.

The container runs as the `node` user. Northflank should mount the volume writable by the image's group; verify that during setup. `BOT_LOCK_PATH=/tmp/morning-goblin.lock` is supplied by the image so a stale PID from an older container cannot block a new deployment. The volume's Single Read/Write mode and one-instance setting prevent overlapping cloud writers. The PID lock alone cannot prevent another copy running on the PC.

Source: [persistent volumes](https://northflank.com/docs/v1/application/databases-and-persistence/add-a-volume).

## 4. Assisted final switch

Once the cloud build, free storage, and settings are ready, perform the switch together:

1. Send the requested Discord downtime notice.
2. Disable the Windows scheduled task **Morning Goblin Watchdog**, then stop the verified local bot. Leave the local files in place for recovery.
3. Take fresh copies of `data/state.json` and `data/state.backup.json` after the local bot has stopped. Transfer them privately into `/app/data/` on the held cloud service. Do not transfer `bot.lock`, heartbeat files, or logs. Do not use an old snapshot while new attendance is still being recorded locally.
4. Validate the uploaded JSON and compare guilds, ledger entries, scores, and preferences with the stopped local copy. The current upload method will be chosen from Northflank's container access/file-transfer tools once the account is ready; it must not publish the files on the open web.
5. Set `BOT_MIGRATION_HOLD=false` and redeploy. The entrypoint refuses to start when both state files are missing/empty; the application's existing storage validation handles corrupt files.
6. Check logs for `Morning Goblin is ready.`, then verify Discord connection, scheduler progress, and saved state. Send the requested return notice.
7. Verify the Windows watchdog remains disabled. The PC can then be switched off without stopping the hosted bot.

For rollback, first stop/pause the cloud service and export its latest state if it accepted any new check-ins. Restore that state locally before re-enabling the PC's watchdog. Never run both copies against independent score files.

## Deployment files and verification

- `Dockerfile`: Node 24 runtime, locked dependencies, non-root user, and setup mode by default.
- `.dockerignore`: an allowlist that excludes tokens, saved scores, local dependencies, and private files from the build context.
- `scripts/container-entrypoint.sh`: waits during setup, requires existing state at activation, and uses `exec` so the bot receives shutdown signals.
- `.gitattributes`: preserves Unix line endings for the shell entrypoint.

All 58 offline tests and JavaScript syntax checks pass. Git's shell validated the entrypoint syntax and confirmed activation refuses missing saved state. Docker is not installed in the current Windows shell, so the image build and setup-mode runtime will be verified by Northflank before cutover. This guide does not claim a completed migration.
