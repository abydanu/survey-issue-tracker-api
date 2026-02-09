FROM node:22-alpine

# install bun
RUN npm install -g bun

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["bun", "run", "prod"]
