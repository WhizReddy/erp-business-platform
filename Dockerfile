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

# Ensure it binds to 0.0.0.0 and runs in production mode
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Start the server using the standard npm start command
CMD ["npm", "start"]
