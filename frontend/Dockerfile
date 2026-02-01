# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build args for Vite env vars
ARG VITE_SHOW_ROLE_SWITCHER=true
ARG VITE_APP_VERSION=dev
ENV VITE_SHOW_ROLE_SWITCHER=$VITE_SHOW_ROLE_SWITCHER
ENV VITE_APP_VERSION=$VITE_APP_VERSION

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
