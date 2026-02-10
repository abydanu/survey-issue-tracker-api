FROM oven/bun:1.3.9-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .

RUN bun x prisma generate --schema=./src/core/prisma/schema.prisma

ENV NODE_ENV=production
EXPOSE 8080

CMD ["bun", "run", "start"]
