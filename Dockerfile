FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS production

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache openssl

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/package.json ./

EXPOSE 3000

CMD ["npx", "prisma", "migrate", "deploy", "&&", "node", "dist/main"]