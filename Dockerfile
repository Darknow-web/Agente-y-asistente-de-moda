# SASTRA — imagen única (cliente + servidor) para Cloud Run
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/src/config ./server/src/config
COPY --from=build /app/server/src/agents ./server/src/agents
EXPOSE 8080
CMD ["node", "server/dist/server/src/index.js"]
