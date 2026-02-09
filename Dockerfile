FROM oven/bun:1.1.29

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .

ENV NODE_ENV=production

EXPOSE 5000

CMD ["bun", "run", "prod"]
