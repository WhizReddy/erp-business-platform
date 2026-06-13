# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for build step)
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy from builder
COPY --from=builder /app /app

# Expose the CAP server port
EXPOSE 4004

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4004/ || exit 1

# Start the server using the standard npm start command
CMD ["npm", "start"]
