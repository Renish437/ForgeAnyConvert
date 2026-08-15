# ForgeAnyConvert backend — includes every system tool the converters shell
# out to. This is the single most important fix for "works on my machine
# but not in Docker": npm install alone does NOT get you LibreOffice,
# Pandoc, poppler-utils, Ghostscript, qpdf, ImageMagick, or Calibre — those
# have to be installed at the OS level, which is what this file does.
FROM node:20-bookworm-slim

# --- System dependencies ---------------------------------------------------
# libreoffice   Word/Excel/PowerPoint/ODF/RTF/TXT/HTML conversions
# pandoc        Markdown conversions
# poppler-utils PDF -> text/images (pdftotext, pdftoppm)
# ghostscript   PDF compression
# qpdf          PDF password protection
# imagemagick   legacy image format fallback (BMP/GIF)
# calibre       e-book conversions (EPUB/MOBI/PDF) — large, but there is no
#               lighter-weight tool that does this job correctly
# ffmpeg        audio/video (also bundled per-platform via the npm
#               ffmpeg-static package, but a system copy is a reliable
#               fallback and is what ffprobe-static pairs best with)
# fonts-*       LibreOffice/Calibre need real fonts installed to render
#               documents correctly — without these, text can render as
#               boxes or with wrong metrics
RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice \
        pandoc \
        poppler-utils \
        ghostscript \
        qpdf \
        imagemagick \
        calibre \
        ffmpeg \
        fonts-liberation \
        fonts-dejavu-core \
        fonts-noto-core \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Calibre's PDF-output path renders through Qt WebEngine (Chromium-based),
# which refuses to run as root at all without this explicit override — and
# this image runs as root by default, like most Docker base images. The
# app code (converters/ebookConverter.js) also sets this for the
# ebook-convert subprocess specifically; declaring it here too is a
# harmless safety net in case anything else in this image ever shells out
# to a Qt WebEngine-based tool directly.
ENV QTWEBENGINE_DISABLE_SANDBOX=1
ENV NODE_ENV=production

WORKDIR /app

# Install dependencies first, separately from the app source, so Docker's
# layer cache only re-runs npm install when package.json actually changes —
# not on every source-code edit.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Every temp workspace lives under here — created fresh per request and
# deleted immediately after (see utils/workspace.js) — but the directories
# themselves need to exist and be writable at container start.
RUN mkdir -p tmp/uploads tmp/outputs

EXPOSE 3000

# A simple TCP-level healthcheck; Docker/orchestrators can use this to know
# when the container is actually ready to accept traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
