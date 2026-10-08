# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM docker.io/nginxinc/nginx-unprivileged:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Same-origin AI proxy (/v1/ -> local model server). The entrypoint renders
# this template with envsubst at start; needs STRATA_UPSTREAM + STRATA_API_KEY.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/ai-proxy.conf.template /etc/nginx/templates/default.conf.template
# Export NGINX_LOCAL_RESOLVERS (the container's DNS) for the template's resolver.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
EXPOSE 8080
