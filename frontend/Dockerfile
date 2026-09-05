FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production. Selected by docker-compose.prod.yml with `target: caddy`, because Caddy
# obtains and renews a real certificate itself — see Caddyfile.
FROM caddy:2-alpine AS caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist/frontend/browser /srv
EXPOSE 80 443

# Local development, and the default target because it is last: nginx with the
# self-signed cert from scripts/make-cert.sh, so `build: ./frontend` in the base
# compose file keeps meaning exactly what it did.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN mkdir -p /etc/nginx/certs
COPY --from=build /src/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80 443
