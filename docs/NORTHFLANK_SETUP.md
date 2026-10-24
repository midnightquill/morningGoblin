# Move Morning Goblin to Northflank

Status: migration completed on 2026-10-24. Morning Goblin runs on Northflank; the PC bot is stopped and its Windows watchdog is disabled.

Current deployment: service `morning-goblin`, region US Central (Council Bluffs), one instance on `nf-compute-10` (0.1 shared vCPU / 256 MB). The `goblin-data` volume is 6 GB NVMe, ReadWriteOnce, mounted at `/app/data`. Runtime variables include the existing bot settings and `BOT_MIGRATION_HOLD=false`.

The steps below document the setup and recovery process. Setup mode is for a new migration, not the normal live setting. The service is on the Free plan; the volume form displayed $0.15/GB/month, or $0.90/month for 6 GB before any applicable allowance. The effective invoice was not verified during migration.

The assisted cutover transferred both state files with SHA-256 read-back verification, preserving 2 guilds and 257 saved check-ins. The user ran the cloud health check and confirmed Discord connection, scheduler progress, no runtime/storage errors, and an unchanged fingerprint of scores, history, streaks, preferences, and settings. Both requested Discord maintenance notices were sent. The PC process count was verified as zero and the scheduled watchdog as Disabled.

Private snapshots, transfer/health-check commands, task configuration, verification receipts, and migration progress are retained under `data/backups/northflank-2026-10-24/`, outside Git. Local `data/state.json` is now an old snapshot; the cloud volume is authoritative. Never start the local copy against stale scores while the cloud bot is live.

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

All 58 offline tests and JavaScript syntax checks passed before publication. Git's shell validated the entrypoint syntax and confirmed activation refuses missing saved state. Northflank successfully built commit `2554975` and ran setup mode. The volume mount and write check passed; after activation, the cloud health and saved-data checks all passed. Docker is not installed in the local Windows shell.

CI and CD are enabled. Documentation-only commits can use `[skip ci]` to avoid an unnecessary deployment. Runtime updates deploy from `main`; preserve the persistent volume, the one-instance setting, and the live `BOT_MIGRATION_HOLD=false` runtime variable. Northflank handles container restarts; the Windows watchdog must remain disabled.
