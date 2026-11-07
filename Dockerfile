FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Run as non-root user
USER node

CMD ["node", "dist/index.js"]
