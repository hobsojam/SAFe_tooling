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
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/ || exit 1

# Strip any trailing slash from API_UPSTREAM_URL, substitute into the nginx
# template, then start nginx. Using explicit envsubst avoids relying on the
# base image's entrypoint template-processing scripts.
CMD ["/bin/sh", "-c", "API_UPSTREAM_URL=\"${API_UPSTREAM_URL%/}\" && envsubst '${API_UPSTREAM_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
