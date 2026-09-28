# Keep the oven/bun tag in sync with "packageManager" in package.json.
FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build && rm -rf node_modules && bun install --frozen-lockfile --production

# Debian, not Alpine: journeys drive the chromium package from the web
# process. app/lib/journey/browser.server.ts finds /usr/bin/chromium and adds
# --no-sandbox, which Chrome needs when running as root in a container.
FROM node:24-bookworm-slim
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-noto-color-emoji ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "node_modules/@react-router/serve/bin.cjs", "build/server/index.js"]
