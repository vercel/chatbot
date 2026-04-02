FROM node:22.13.0-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/agent-api/package.json ./apps/agent-api/package.json

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 8080

ENV NODE_ENV=production
ENV MASTRA_SERVER_HOST=0.0.0.0
ENV MASTRA_SERVER_PORT=8080

CMD ["pnpm", "--filter", "@app/agent-api", "start"]
