# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- runtime (nginx) ----
FROM nginx:1.27-alpine

# Copy built app
COPY --from=build /app/dist /usr/share/nginx/html

# We will bind-mount nginx.conf and cache.conf from compose, but keep a safe default:
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server { listen 80; server_name _; return 444; }
EOF
