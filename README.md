# Forge — Convert Anything

A full-stack file toolkit with five focused products behind one navbar,
each with its own distinct visual theme:

- **Converter** — documents, images, audio, video, spreadsheets, presentations, e-books, and file compression/resizing
- **PDF Studio** — merge, compress, password-protect, watermark, and convert PDFs
- **Image Lab** — convert between image formats, or shrink/enlarge with real quality and dimension controls
- **Media Converter** — re-encode audio and video between formats
- **GitHub Grabber** — paste a link to one file, one folder, or a whole repo, and get back exactly that

```
ForgeAnyConvert/
├── backend/    Express API that does the actual conversion work
└── frontend/   React + Vite + Tailwind v4 UI, three themed pages + Framer Motion
```

## Quick start

### Option A — Docker (recommended)

This is the easiest way to get every system dependency (LibreOffice,
Pandoc, poppler-utils, Ghostscript, qpdf, ImageMagick, Calibre) correctly
installed without doing it by hand:

```bash
docker compose up --build
```

Backend: `http://localhost:3000`. Frontend: `http://localhost:8080`.

To run just the backend in Docker (e.g. if you're developing the frontend
locally with `npm run dev`):

```bash
cd backend
docker build -t forge-backend .
docker run -p 3000:3000 -e CORS_ORIGINS=http://localhost:5173 forge-backend
```

### Option B — Local install

You need **Node.js 18+** and the command-line converters listed in
[System dependencies](#system-dependencies) below, installed directly on
your machine.

```bash
# 1. backend
cd backend
npm install
npm start                 # listens on http://localhost:3000

# 2. frontend (in a second terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Open `http://localhost:5173`. The frontend talks to the backend at the URL
in `frontend/.env` (`VITE_API_BASE_URL`, defaults to `http://localhost:3000`).

## The five pages, and why they look different

Each product page sets its own `data-theme` on `<html>` on mount
(`src/hooks/usePageTheme.js`), and every theme is defined as a scoped block
of CSS custom-property overrides in `src/index.css` — Tailwind v4 utilities
like `bg-surface` or `text-accent` compile straight to `var(--color-surface)`
/ `var(--color-accent)`, so overriding those variables in a more specific
selector re-themes every component already using them, with zero
per-component theme logic:

```css
[data-theme="pdfstudio"] { --color-accent: #7c3aed; /* ...light values */ }
[data-theme="pdfstudio"].dark { --color-accent: #8b5cf6; /* ...dark values */ }
```

| Theme | Feel | Fonts |
|---|---|---|
| **Workshop** (Landing + Converter) | Forge's home brand — warm paper in light mode, graphite/ember in dark | Space Grotesk, IBM Plex Mono, Inter |
| **PDF Studio** | Premium glassy SaaS product, lavender/violet, heavier Framer Motion | Sora, Inter |
| **Image Lab** | Vibrant creative-studio feel, playful spring animations | Poppins, Inter |
| **Media Converter** | Cinematic DAW/broadcast-console feel, waveform accents | Rajdhani, Inter |
| **GitHub Grabber** | Terminal-native, echoes GitHub's own light/dark palette | JetBrains Mono |

The light/dark toggle (top right, persisted in `localStorage`) is independent
of which page/theme is active — every theme has its own light *and* dark
variant, so switching modes never looks like a generic invert.

## How the backend works

- **`GET /api/formats`** returns the full conversion matrix (categories,
  from/to pairs, and any special "operations"). The frontend fetches this on
  load and builds its UI from it — add a pair to the backend registry and
  it shows up automatically, no frontend changes needed.
- **`POST /api/convert`** is the single endpoint for everything: normal
  `from → to` conversions, PDF operations (merge, compress, protect,
  watermark), image/video shrink-or-enlarge, and link-based tools (GitHub).
  Key fields:

  | Field | Used for |
  |---|---|
  | `files` | one or more uploaded files (multiple only for `merge`/`zip-compress`) |
  | `to` | target extension, for plain conversions |
  | `operation` | `merge` \| `compress` \| `protect` \| `watermark` \| `pptx-images` \| `github-download` \| `zip-compress` \| `reduce-image` \| `reduce-video` |
  | `url` | for `github-download` — a GitHub file or repo link, no upload involved |
  | `password` / `watermarkText` | required for `protect` / `watermark` |
  | `quality` | `compress`: `screen` \| `ebook` \| `printer` |
  | `level` | `reduce-image` / `reduce-video` preset: `high` \| `medium` \| `low` |
  | `mode` | `reduce-image`: `shrink` \| `enlarge` |
  | `customQuality`, `maxWidth`, `maxHeight`, `allowEnlarge` | `reduce-image` fine-grained overrides, on top of `level`'s preset |
  | `appendUuid` | `"true"` to insert a short unique suffix before the extension |

  The response is the converted file as a binary stream (a `.zip` when a
  conversion produces multiple files), with `X-Original-Size` /
  `X-Result-Size` headers so the UI can show how much space was saved.

  **Filenames:** every download keeps the original filename by default
  (`report.pdf` in → `report.pdf` out). Setting `appendUuid=true` inserts a
  short suffix instead — `report-a1b2c3d4.pdf` — useful when converting the
  same file repeatedly without overwriting previous downloads.

### GitHub Grabber specifics

Paste any of these and it does the right thing:

- `https://github.com/owner/repo/blob/branch/path/to/file.ext` → downloads
  **only that file**, under its real name, via `raw.githubusercontent.com`.
- `https://github.com/owner/repo/tree/branch/path/to/folder` → downloads
  **only that folder** (recursively, preserving its internal structure),
  zipped. Uses one Git Trees API call to list the folder's contents, then
  fetches each file from `raw.githubusercontent.com`, which doesn't count
  against the API rate limit.
- `https://github.com/owner/repo` or `.../tree/branch` with no further path
  → downloads the **whole repository** at that branch as a zip, via
  `codeload.github.com`.

Also handles messy pastes gracefully: a markdown-formatted link
(`[text](url)`, e.g. copied out of a rendered chat message or README) is
unwrapped to its actual target URL rather than getting confused by having
two URLs in one string.

Only public repos/files are supported. Unauthenticated GitHub API calls
(used to resolve a repo's default branch, or to list a folder's contents)
are capped at 60/hour per IP — set `GITHUB_TOKEN` (Backend env var, a plain
personal access token, no special scopes needed) to raise that to
5,000/hour if you're running this somewhere with shared traffic.

### What's intentionally *not* here

There's no Facebook/Instagram/TikTok-style social media downloader. Those
platforms' terms of service prohibit third-party scraping/downloading, a lot
of that content isn't owned by whoever's downloading it, and "social media
downloader" is a well-known pattern for mass copyright infringement — so
that's a deliberate omission, not a missing feature.

## Nothing is stored

Every request gets its own temp workspace (`backend/tmp/uploads` and
`backend/tmp/outputs/<job-id>/`), deleted the moment the response finishes —
success, failure, or the client disconnecting mid-conversion. A background
sweep also clears anything older than 15 minutes as a pure safety net in
case a crash somehow skips that per-request cleanup. There's no database
anywhere in this project.

## Supported conversions

| Category | Pairs |
|---|---|
| **Documents** | DOCX→PDF, DOC→PDF, PDF→DOCX, DOCX→TXT, TXT→PDF, TXT→DOCX, DOCX→HTML, HTML→PDF, MD→PDF, MD→DOCX, ODT→PDF, RTF→PDF |
| **Images** | JPG↔PNG, WEBP→JPG/PNG, GIF→PNG, BMP→PNG, TIFF→JPG, SVG→PNG, SVG→PDF |
| **PDF Tools** | PDF→DOCX/TXT/JPG/PNG, merge multiple PDFs, compress, password-protect, watermark |
| **Audio** | MP3↔WAV, AAC/OGG/FLAC/M4A→MP3 |
| **Video** | MP4→AVI/MKV, MKV/MOV/WEBM/AVI→MP4 |
| **Spreadsheet** | XLSX/XLS→PDF, CSV↔XLSX, ODS→XLSX |
| **Presentation** | PPTX/PPT/ODP→PDF, PPTX→images (zip) |
| **E-book** | EPUB→PDF/DOCX, MOBI→EPUB, PDF→EPUB *(needs Calibre — see below)* |
| **GitHub Grabber** | Any file, folder, or repo link → the exact file, a folder ZIP, or a repo ZIP |
| **Compress & Shrink** | Image shrink/enlarge (preset or custom quality + dimensions), video shrink, zip up any files together |

Extending the matrix is one addition to `backend/converters/registry.js`
(a handler function plus one line in the `CATEGORIES` list) — the frontend
picks it up automatically via `/api/formats`.

## System dependencies

Everything below is invoked via `child_process`, resolved cross-platform in
`backend/utils/binaries.js`: it checks an environment-variable override
first, then the plain command on `PATH`, then common install locations for
Windows/macOS/Linux.

| Tool | Used for | Install | Env override |
|---|---|---|---|
| **LibreOffice** | Word/Excel/PowerPoint/ODF/RTF/TXT/HTML conversions | [libreoffice.org](https://www.libreoffice.org/download/) | `LIBREOFFICE_PATH` |
| **Pandoc** | Markdown conversions | [pandoc.org/installing](https://pandoc.org/installing.html) | `PANDOC_PATH` |
| **Poppler utils** (`pdftotext`, `pdftoppm`) | PDF→text, PDF→images | `apt install poppler-utils` / `brew install poppler` / [Windows builds](https://github.com/oschwartz10612/poppler-windows) | `PDFTOTEXT_PATH`, `PDFTOPPM_PATH` |
| **Ghostscript** | PDF compression | `apt install ghostscript` / `brew install ghostscript` | `GHOSTSCRIPT_PATH` |
| **qpdf** | PDF password protection | `apt install qpdf` / `brew install qpdf` | `QPDF_PATH` |
| **ImageMagick** | BMP/GIF image conversion fallback | `apt install imagemagick` / `brew install imagemagick` | `IMAGEMAGICK_PATH` |
| **Calibre** (`ebook-convert`) | E-book conversions | [calibre-ebook.com/download](https://calibre-ebook.com/download) | `EBOOK_CONVERT_PATH` |

**Not required as a system install:** image conversion/resizing (`sharp`),
audio/video conversion (`ffmpeg`, bundled per-platform via `ffmpeg-static`),
PDF merge/watermark (`pdf-lib`), CSV/XLSX conversion (`exceljs`), the GitHub
downloader (plain Node `https`), and zipping (`archiver`) are all pure npm
dependencies — nothing extra to install for those on Linux, macOS, or Windows.

If a tool genuinely isn't installed, the relevant conversions fail with a
clear message telling you what to install — the rest of the matrix keeps
working.

## Error responses

Every error the backend returns uses one consistent shape:

```json
{
  "success": false,
  "error": {
    "code": "PDF_PASSWORD_REQUIRED",
    "message": "This PDF is password-protected. Provide the correct password, or remove the existing protection before processing it."
  }
}
```

`code` is stable and safe to match on programmatically; `message` is
written to be shown directly to the end user. Unexpected internal errors
(a bug, a raw filesystem error, etc.) are always sanitized down to a
generic `INTERNAL_ERROR` with a safe message before reaching the client —
the real error, with full detail, is logged server-side via `console.error`
so it's still debuggable, it just never leaks into the HTTP response.

| Code | Meaning |
|---|---|
| `INVALID_INPUT` | Missing/malformed request field (e.g. no password given to `protect`) |
| `UNSUPPORTED_FORMAT` | That specific from→to pair isn't in the conversion matrix |
| `GITHUB_INVALID_URL` | Doesn't look like a GitHub link at all |
| `GITHUB_NOT_FOUND_OR_PRIVATE` | 404 from GitHub — doesn't exist, wrong branch, or private (GitHub deliberately can't be asked to tell these apart without a token that has access) |
| `GITHUB_RATE_LIMIT` | Hit GitHub's API rate limit (60/hr unauthenticated, 5,000/hr with `GITHUB_TOKEN`) |
| `GITHUB_AUTH_REQUIRED` | `GITHUB_TOKEN` is set but GitHub rejected it |
| `GITHUB_EMPTY_FOLDER` | The requested folder path has no files under it |
| `GITHUB_NETWORK_ERROR` | Couldn't reach GitHub, or it returned something unexpected |
| `PDF_PARSE_FAILED` | The PDF is corrupted/truncated/not actually a PDF |
| `PDF_PASSWORD_REQUIRED` | The input PDF is encrypted and needs its password |
| `PDF_ENCRYPTION_FAILED` | Couldn't add password protection |
| `PDF_OCR_REQUIRED` | No text layer found — it's a scanned/image-only PDF, which needs OCR (not performed by this app) |
| `COMPRESSION_FAILED` | Image/video/PDF compression failed |
| `EBOOK_CONVERSION_FAILED` | Calibre failed or produced no usable output |
| `OUTPUT_VALIDATION_FAILED` | The conversion appeared to succeed but the output failed a sanity check (empty file, wrong content, etc.) — see [Output validation](#output-validation) |
| `DEPENDENCY_NOT_INSTALLED` | A required system tool isn't on `PATH` |
| `INTERNAL_ERROR` | Anything unexpected — sanitized, with full detail logged server-side only |

### Output validation

Several converters don't just trust a tool's exit code — they verify the
actual result before reporting success, since a `0` exit code doesn't
always mean the output is real or correct:

- **Password protection** re-opens the generated PDF twice with `qpdf
  --check` — once *without* the password (must fail) and once *with* it
  (must succeed) — before returning it. It never reports success on exit
  code alone.
- **Text extraction** checks that real text was actually found, not just
  that `pdftotext` exited cleanly — poppler exits `0` even for a
  scanned/image-only PDF with no text layer, producing an empty result
  that looks successful unless you check its content.
- Every file-producing converter checks the output file **exists and is
  non-empty** before returning it.

## Performance notes (video/large-file compression)

Measured on real 1280×720 test footage before changing anything (per-CPU
numbers on the machine used to develop this — will vary with your
hardware):

| Setting | Time | Output size | vs. baseline |
|---|---|---|---|
| `veryfast` (previous default) | 6.18s | 518 KB | baseline |
| `superfast` (current default) | 4.43s | 548 KB | **28% faster**, +6% size |
| `ultrafast` | 2.83s | 893 KB | 54% faster, but +72% size — works against the point of the "smallest file" tier, not used |

`superfast` is used for every quality tier — a clear win with no
meaningful quality/size tradeoff. Also applied: an explicit `-threads`
count (rather than relying on ffmpeg's own auto-detection, which can
misread a container's cgroup CPU quota as the full host's core count) and
real-time progress events from ffmpeg (surfaced through to the `reduce-video`
operation's internals, ready to wire into a future streaming-progress
endpoint).

**Already true before any of this, worth knowing:** conversions never
load a file's bytes into Node's own memory — ffmpeg, LibreOffice, Calibre,
Ghostscript, and qpdf are all invoked as subprocesses that read/write
files directly, so Node just orchestrates them. Every request also gets
its own UUID-named temp directory (see [Nothing is stored](#nothing-is-stored)),
so concurrent conversions can't corrupt each other's files — this was
already the case, not something added for this pass.

**Not done in this pass, and why:** true granular server-push progress
(e.g. "45% compressed" shown live during a multi-minute video job) would
need a bigger architectural change — Server-Sent-Events, WebSockets, or a
submit-job/poll-status pattern — since the current single
request-response HTTP flow can't stream a live percentage back while
also eventually returning the finished file over the same connection. The
UI currently shows honest phase labels (Uploading → Processing →
Finalizing → Completed/Failed) instead of a fabricated percentage during
the server-side processing phase, which doesn't require that
rearchitecture. Hardware-accelerated encoding (NVENC/VAAPI/QuickSync) was
evaluated and intentionally not used as a hard dependency — most
Docker/cloud hosts don't have GPU passthrough configured, so relying on it
would fail unpredictably in the common case; it's a good opt-in addition
for anyone deploying on GPU-equipped hardware.

## Configuration

`backend/config.js` reads these environment variables (all optional):

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Backend listen port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed frontend origins |
| `MAX_UPLOAD_MB` | `200` | Max upload size per file |
| `GITHUB_TOKEN` | none | Raises the GitHub API rate limit from 60/hr to 5,000/hr |

`frontend/.env`:

| Var | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000` | Where the frontend sends conversion requests |

## Known limitations / advisories

- **Calibre** isn't bundled (it's a large, separately-installed desktop
  app) — e-book conversions return a clear error if it's missing rather
  than crashing.
- **PDF→DOCX / PDF→e-book quality** depends on how structured the source
  PDF is. Scanned/image-only PDFs won't produce useful editable text (no
  OCR step is included).
- **GitHub Grabber** only works with public repos/files — there's no
  authentication flow for private ones. Folder downloads on extremely
  large repos (100,000+ tracked files) may hit GitHub's tree-listing
  truncation limit; set `GITHUB_TOKEN` and this is rarely an issue in
  practice.
- **`react-router-dom`**: every currently-published version has at least
  one open advisory. The one affecting the pinned version here (RSC Mode
  CSRF bypass, GHSA-qwww-vcr4-c8h2) is specific to React Server Components
  mode, which this plain client-side SPA never uses.
- **`exceljs`** (used for CSV↔XLSX) has one moderate transitive advisory in
  its `uuid` dependency with no non-breaking fix available upstream yet.

## Notes for deployment

- Run the backend behind a reverse proxy (nginx/Caddy) with HTTPS in
  production, and set `CORS_ORIGINS` to your real frontend domain.
- Conversions shell out to CPU-bound native tools; size your server
  accordingly and consider a job queue if you expect concurrent heavy
  traffic (large video transcodes in particular).
- Set `GITHUB_TOKEN` if you expect meaningful traffic through GitHub
  Grabber, to avoid hitting GitHub's unauthenticated rate limit.

### Deploying the frontend to Vercel

A root-level `vercel.json` is included so you can import this repo into
Vercel as-is — no manual "Root Directory" setting needed. It builds just
the `frontend/` folder (`cd frontend && npm install && npm run build`) and
serves `frontend/dist`, with a SPA rewrite so client-side routes (`/pdf-studio`,
`/image-lab`, etc.) work on a hard refresh, not just in-app navigation.

1. Import the repo in the Vercel dashboard (or run `vercel` from this
   directory with the Vercel CLI) and deploy — it picks up `vercel.json`
   automatically.
2. In the Vercel project's **Settings → Environment Variables**, add
   `VITE_API_BASE_URL` pointing at wherever your backend is hosted (e.g.
   `https://api.yourdomain.com`). Without this it falls back to
   `http://localhost:3000`, which only works on your own machine.
3. Redeploy after adding the env var (Vite bakes `VITE_*` vars in at build
   time, so it needs a fresh build to pick it up).

**The backend does *not* deploy to Vercel.** It shells out to LibreOffice,
Pandoc, Calibre, Ghostscript, qpdf, and ffmpeg (see `backend/Dockerfile`) —
real OS-level binaries that Vercel's serverless functions have no way to
install, plus conversions of large files can run well past the serverless
execution time limit. Host `backend/` as a normal long-running Node process
instead — the included `backend/Dockerfile` runs as-is on Render, Railway,
Fly.io, or any VPS/Docker host. `.vercelignore` excludes `backend/` from the
Vercel upload entirely so it doesn't slow down deploys.
