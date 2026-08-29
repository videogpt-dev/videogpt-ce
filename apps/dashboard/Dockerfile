FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/videogpt-ui ./packages/videogpt-ui
COPY packages/videogpt-catalog ./packages/videogpt-catalog
COPY apps/dashboard ./apps/dashboard
RUN pnpm install --frozen-lockfile

ARG VITE_CORE_URL=http://localhost:8000
ENV VITE_CORE_URL=$VITE_CORE_URL
RUN pnpm -C apps/dashboard build

FROM nginx:alpine
RUN printf 'server {\n  listen 5173;\n  root /usr/share/nginx/html;\n  location / { try_files $uri /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 5173
