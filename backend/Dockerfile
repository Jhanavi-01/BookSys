# Stage 1: Build
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json nest-cli.json ./
COPY src ./src/
RUN npm run build && ls dist/main.js

# Stage 2: Production
FROM node:20-alpine AS production

RUN apk add --no-cache openssl dumb-init

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma/
COPY src ./src/
COPY tsconfig.json ./

# Re-generate prisma client for production node_modules
RUN npx prisma generate

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health/ping || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx ts-node prisma/seed.ts; node dist/main.js"]
