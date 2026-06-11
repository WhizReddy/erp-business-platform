# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies for build step)
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build the CAP project (generates /gen folder)
RUN npx cds build --production

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built output from builder
COPY --from=builder /app/gen ./gen

# Copy static dashboard app
COPY app/erp_dashboard ./app/erp_dashboard

# Expose the CAP server port
EXPOSE 4004

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4004/ || exit 1

# Start the server
CMD ["node", "gen/srv/server.js"]
