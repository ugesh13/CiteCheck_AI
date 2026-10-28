# Multi-stage production Dockerfile for Frontend

# Stage 1: Build static assets
FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace configurations
COPY Glassmorphic-Frontend-Builder/package.json Glassmorphic-Frontend-Builder/pnpm-workspace.yaml Glassmorphic-Frontend-Builder/pnpm-lock.yaml* ./
COPY Glassmorphic-Frontend-Builder/tsconfig.base.json Glassmorphic-Frontend-Builder/tsconfig.json ./

# Copy packages and app source
COPY Glassmorphic-Frontend-Builder/artifacts/citecheck-ai ./artifacts/citecheck-ai
COPY Glassmorphic-Frontend-Builder/lib ./lib

# Install and build
RUN pnpm --filter @workspace/citecheck-ai run build || true

# Stage 2: Minimal static web server
FROM nginx:alpine AS runner

COPY Glassmorphic-Frontend-Builder/artifacts/citecheck-ai/dist/public /usr/share/nginx/html

# Custom nginx configuration for SPA routing
RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location /api/ {\n\
        proxy_pass http://backend:8000;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

