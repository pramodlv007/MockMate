# Multi-arch (amd64/arm64): both base images publish both architectures.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty API URL = same origin: the Ingress routes API paths to the api Service, so one image works on any domain.
ARG VITE_API_URL=""
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_API_URL=$VITE_API_URL VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Unprivileged variant listens on 8080 and runs as uid 101, so the pod can run as non-root.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
