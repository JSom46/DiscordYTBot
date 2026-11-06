FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source
COPY src ./src

# Run as non-root user
USER node

CMD ["node", "src/index.mjs"]
