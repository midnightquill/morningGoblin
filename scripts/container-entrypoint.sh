#!/bin/sh
set -eu

# A first deployment can build and mount storage while the PC still runs the bot.
# Only the exact value false enables Discord. An omitted or mistyped value waits.
if [ "${BOT_MIGRATION_HOLD:-true}" != "false" ]; then
  echo "Morning Goblin setup mode: not connected to Discord. Transfer saved state before setting BOT_MIGRATION_HOLD=false."
  exec node -e 'setInterval(() => {}, 60000); process.on("SIGTERM", () => process.exit(0)); process.on("SIGINT", () => process.exit(0));'
fi

# This image migrates an existing bot, so an empty mount must never reset scores.
if [ ! -s /app/data/state.json ] && [ ! -s /app/data/state.backup.json ]; then
  echo "No saved state found in /app/data. Refusing to start with empty scores. Keep setup mode enabled and transfer the state files first." >&2
  exit 1
fi

exec node /app/src/index.js
