FROM mcr.microsoft.com/playwright:v1.64.0-noble
WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci
COPY playwright.config.mjs ./
COPY e2e ./e2e
USER pwuser
CMD ["npm", "run", "test:e2e"]
