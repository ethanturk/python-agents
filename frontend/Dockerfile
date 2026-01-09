FROM node:22-alpine AS builder

# Set environment variables for Node.js optimization during build
ENV NODE_OPTIONS="--max-old-space-size=1536" \
    NODE_ENV="production" \
    # Reduce npm logs to save disk space
    npm_config_loglevel="error" \
    # Use npm ci for faster, more reliable installs
    npm_config_fund=false \
    npm_config_audit=false \
    npm_config_dedupe=false

WORKDIR /app

# Copy package files with better caching strategy
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --production=false --prefer-offline --no-audit

# Copy application code
COPY . .

# Build production bundle
RUN npm run build

# Production stage: use lightweight HTTP server
FROM node:22-alpine AS production

# Set production environment
ENV NODE_ENV="production" \
    NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

# Install serve package to serve static files
RUN npm install -g serve

# Copy build artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

# Serve production build
CMD ["serve", "-s", "dist", "-l", "3000"]
