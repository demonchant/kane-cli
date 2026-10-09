FROM node:24.18.0-bookworm-slim
ENV NODE_ENV=production PATCHLOOP_HOST=0.0.0.0 PATCHLOOP_PORT=4173
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./server.mjs
COPY lib ./lib
COPY public ./public
COPY demo-template ./demo-template
RUN groupadd --system patchloop && useradd --system --gid patchloop --home-dir /app patchloop \
    && mkdir -p /app/.patchloop && chown -R patchloop:patchloop /app
USER patchloop
EXPOSE 4173
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
