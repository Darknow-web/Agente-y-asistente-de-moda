# SASTRA — imagen única (cliente + servidor) para Cloud Run
# Base Debian (no Alpine): ONNX Runtime, el motor del recorte de fotos, necesita glibc.
FROM node:22-slim AS build
WORKDIR /app
# onnxruntime-node intentaría bajar binarios de CUDA en la instalación; no hacen falta en Cloud Run.
ENV ONNXRUNTIME_NODE_INSTALL=skip
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY . .
RUN npm run build
# Modelo de recorte de fondo (U2Net, 176 MB): queda dentro de la imagen para no descargarlo en cada arranque.
RUN node server/scripts/descargar-modelo.mjs

FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV ONNXRUNTIME_NODE_INSTALL=skip
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi
# Configuración pública de Firebase escrita por AI Studio (si existe)
COPY --from=build /app/package.json /app/firebase-applet-config.json* ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/src/config ./server/src/config
COPY --from=build /app/server/src/agents ./server/src/agents
COPY --from=build /app/modelos ./modelos
EXPOSE 8080
CMD ["node", "server/dist/server/src/index.js"]
