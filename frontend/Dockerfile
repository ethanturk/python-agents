FROM node:22-alpine

# Set environment variables for Node.js optimization
ENV NODE_OPTIONS="--max-old-space-size=1536" \
    NODE_ENV="development" \
    # Reduce npm logs to save disk space
    npm_config_loglevel="error" \
    # Use npm ci for faster, more reliable installs
    npm_config_fund=false \
    npm_config_audit=false \
    npm_config_dedupe=false

WORKDIR /app

# Copy package files with better caching strategy
COPY package.json package-lock.json ./

# Install dependencies with optimized settings
# --production=false to install devDependencies for dev server
# --prefer-offline to use cached packages when available
# --no-audit to skip security audits (saves time)
RUN npm ci --production=false --prefer-offline --no-audit

# Copy application code
# Separate this from npm install for better layer caching
COPY . .

# Create non-root user for security (optional)
# RUN addgroup -g 1001 -S nodejs && \
#     adduser -S nextjs -u 1001 && \
#     chown -R nextjs:nodejs /app && \
#     USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

# Start development server
CMD ["npm", "run", "dev"]
