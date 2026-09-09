FROM node:24-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/videogpt-ui ./packages/videogpt-ui
COPY packages/videogpt-catalog ./packages/videogpt-catalog
COPY assets ./assets
COPY apps/dashboard ./apps/dashboard
RUN pnpm install --frozen-lockfile
RUN pnpm --filter self-hosted-dashboard build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV CORE_URL=http://core:8000
WORKDIR /repo/apps/dashboard
COPY --from=build /repo /repo
EXPOSE 3000
CMD ["./node_modules/.bin/react-router-serve", "./build/server/index.js"]
