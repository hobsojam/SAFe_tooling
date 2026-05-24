FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine

# Default upstream for local docker compose. Override with API_UPSTREAM_URL
# on Render (or any other host) to point at the deployed API service.
ENV API_UPSTREAM_URL=http://api:8000

COPY --from=build /app/dist /usr/share/nginx/html
# nginx docker entrypoint processes *.template files in /etc/nginx/templates/
# and writes the rendered result to /etc/nginx/conf.d/ before nginx starts.
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/ || exit 1
