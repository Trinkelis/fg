# ── Stage 1: build the React frontend ─────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install

# Copy ffmpeg core files (UMD + ESM) into the public dir so they're served
# from /ffmpeg/ at runtime — ffmpeg.wasm's worker needs both variants to
# handle different load paths (importScripts vs dynamic import).
RUN mkdir -p public/ffmpeg && \
    cp node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js     public/ffmpeg/ && \
    cp node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm   public/ffmpeg/ && \
    cp node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js     public/ffmpeg/ffmpeg-core.esm.js

COPY frontend/ ./
RUN npm run build


# ── Stage 2: runtime with ffmpeg + ffglitch (ffgac + ffedit) ───────────────
# node:20-slim is Debian-based (glibc) — ffglitch's prebuilt Linux binaries
# are glibc-linked and won't run on the Alpine/musl node image.
FROM node:20-slim

ARG FFGLITCH_VERSION=0.10.2
ARG FFGLITCH_URL=https://ffglitch.org/pub/bin/linux64/ffglitch-${FFGLITCH_VERSION}-linux-x86_64.zip

# ffmpeg provides ffprobe (used by the datamosh pipeline). No imagemagick —
# all image ops happen client-side in Canvas.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
        curl \
        unzip && \
    rm -rf /var/lib/apt/lists/*

# Install ffglitch binaries (ffgac + ffedit) and clean up build tooling.
# The zip extracts to a versioned subdir (ffglitch-<ver>-linux-x86_64/) — we
# flatten that into /opt/ffglitch so the binaries sit on PATH directly.
WORKDIR /opt/ffglitch
RUN curl -fsSL "${FFGLITCH_URL}" -o /tmp/ffglitch.zip && \
    unzip -q /tmp/ffglitch.zip -d /tmp/ffglitch-extract && \
    mv /tmp/ffglitch-extract/ffglitch-*/ffgac  /opt/ffglitch/ && \
    mv /tmp/ffglitch-extract/ffglitch-*/ffedit /opt/ffglitch/ && \
    rm -rf /tmp/ffglitch.zip /tmp/ffglitch-extract && \
    chmod +x /opt/ffglitch/ffgac /opt/ffglitch/ffedit && \
    apt-get purge -y curl unzip && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Put ffglitch binaries on PATH so the Node process can exec them by name.
ENV PATH="/opt/ffglitch:${PATH}"

# App layout
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev
COPY backend/        ./backend/
COPY --from=builder  /app/frontend/dist ./frontend/dist

EXPOSE 3000
CMD ["node", "backend/server.js"]