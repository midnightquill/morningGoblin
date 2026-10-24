FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    BOT_MIGRATION_HOLD=true \
    BOT_LOCK_PATH=/tmp/morning-goblin.lock

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY src/ ./src/
COPY config/ ./config/
COPY scripts/container-entrypoint.sh ./scripts/container-entrypoint.sh
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node:node
STOPSIGNAL SIGTERM
ENTRYPOINT ["sh", "/app/scripts/container-entrypoint.sh"]
