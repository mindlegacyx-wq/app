# Gera o build estático do PWA. O Caddy serve o resultado (ver docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM alpine:3.20
COPY --from=build /app/dist /dist
CMD ["sh", "-c", "cp -r /dist/. /out/ && echo 'frontend copiado'"]
