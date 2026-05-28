# Multi-stage build for the adaptive service. Built from the monorepo root so
# the @biomusic/core workspace dependency is available:
#   docker build -f services/adaptive/Dockerfile -t biomusic-adaptive .
FROM node:22-slim AS build
WORKDIR /app
ENV CI=true

# Install workspace deps (root + packages/core + services/adaptive).
COPY package.json package-lock.json* ./
COPY packages/core/package.json packages/core/package.json
COPY services/adaptive/package.json services/adaptive/package.json
RUN npm install --workspace @biomusic/adaptive --include-workspace-root --no-audit --no-fund

COPY packages/core packages/core
COPY services/adaptive services/adaptive
RUN npm run build --workspace @biomusic/adaptive

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# tsup bundles core + deps into a single ESM file, so only the artifact ships.
COPY --from=build /app/services/adaptive/dist ./dist
USER node
EXPOSE 8787
CMD ["node", "dist/index.js"]
