FROM node:20-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
# Copy ffmpeg core files to public directory — both UMD and ESM variants
RUN mkdir -p public/ffmpeg && \
    cp node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js public/ffmpeg/ && \
    cp node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm public/ffmpeg/ && \
    cp node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js public/ffmpeg/ffmpeg-core.esm.js
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache ffmpeg imagemagick
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev
COPY backend/ ./backend/
COPY --from=builder /app/frontend/dist ./frontend/dist
EXPOSE 3000
CMD ["node", "backend/server.js"]
