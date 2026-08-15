// NOTE — Vercel-compatible build:
// LibreOffice, Pandoc, Calibre, poppler (pdftotext/pdftoppm), Ghostscript,
// qpdf, and ImageMagick are all system binaries with no equivalent on
// Vercel's serverless runtime (no apt-get, no OS-level installs). Every
// converter/operation that depends on them has been removed from this
// registry so the app never advertises or attempts a conversion it can't
// actually perform in that environment. The original converter files
// (libreofficeConverter.js, markdownConverter.js, ebookConverter.js, the
// poppler/Ghostscript/qpdf paths in pdfConverter.js, and the ImageMagick
// fallback in imageConverter.js) are left untouched on disk — deploying to
// Docker/Render/Railway/a VPS instead, they can be wired back in here.
const { convertImage, convertSvgToPdf } = require("./imageConverter");
const { mergePdfs, watermarkPdf } = require("./pdfConverter");
const { convertMedia } = require("./mediaConverter");
const { convertSpreadsheet } = require("./spreadsheetConverter");
const { downloadGithubContent } = require("./githubConverter");
const { zipCompress, reduceImageSize, reduceVideoSize } = require("./compressConverter");

// Every category the UI exposes, in display order, with the exact from/to
// pairs the product spec asked for. `key` is how the pair is looked up at
// convert-time: normal pairs are "from->to"; special same-file-type PDF
// operations use a dedicated operation id instead (see routes/convert.js).
const CATEGORIES = [
  {
    id: "images",
    label: "Images",
    pairs: [
      { from: "jpg", to: "png" },
      { from: "png", to: "jpg" },
      { from: "webp", to: "jpg" },
      { from: "webp", to: "png" },
      { from: "tiff", to: "jpg" },
      { from: "svg", to: "png" },
      { from: "svg", to: "pdf" },
    ],
  },
  {
    id: "pdf-tools",
    label: "PDF Tools",
    pairs: [
      { operation: "merge", from: "pdf", to: "pdf", label: "Multiple PDFs \u2192 Single PDF" },
      { operation: "watermark", from: "pdf", to: "pdf", label: "PDF \u2192 Watermarked PDF" },
    ],
  },
  {
    id: "audio",
    label: "Audio",
    pairs: [
      { from: "mp3", to: "wav" },
      { from: "wav", to: "mp3" },
      { from: "aac", to: "mp3" },
      { from: "ogg", to: "mp3" },
      { from: "flac", to: "mp3" },
      { from: "m4a", to: "mp3" },
    ],
  },
  {
    id: "video",
    label: "Video",
    pairs: [
      { from: "mp4", to: "avi" },
      { from: "mp4", to: "mkv" },
      { from: "mkv", to: "mp4" },
      { from: "mov", to: "mp4" },
      { from: "webm", to: "mp4" },
      { from: "avi", to: "mp4" },
    ],
  },
  {
    id: "spreadsheet",
    label: "Spreadsheet",
    pairs: [
      { from: "csv", to: "xlsx" },
      { from: "xlsx", to: "csv" },
    ],
  },
  {
    id: "github",
    label: "GitHub Grabber",
    pairs: [
      {
        operation: "github-download",
        from: "url",
        to: "file",
        label: "File or repo link \u2192 exact file, or ZIP if it's a whole repo",
        inputType: "url",
        urlPlaceholder: "https://github.com/owner/repo/blob/main/path/to/file.js",
      },
    ],
  },
  {
    id: "compress",
    label: "Compress & Shrink",
    pairs: [
      {
        operation: "zip-compress",
        from: "any",
        to: "zip",
        label: "Any files \u2192 ZIP archive",
        multiple: true,
      },
      {
        operation: "reduce-image",
        from: "image",
        to: "image",
        label: "Shrink an image's file size",
        accept: ".jpg,.jpeg,.png,.webp,.bmp,.tiff",
      },
      {
        operation: "reduce-video",
        from: "video",
        to: "mp4",
        label: "Shrink a video's file size",
        accept: ".mp4,.mov,.mkv,.avi,.webm",
      },
    ],
  },
];

// --- Handlers -------------------------------------------------------------
// Every handler has the signature (inputPath, outDir, options) and resolves
// to either a string output path, or { path, isZip } for multi-file results.

const HANDLERS = {
  // Images (sharp bundles its own linux-x64 binary via npm — no system
  // install needed; gif/bmp are intentionally omitted since those routed
  // through ImageMagick in the original registry)
  "jpg->png": (input, outDir) => convertImage(input, "png", outDir),
  "png->jpg": (input, outDir) => convertImage(input, "jpg", outDir),
  "webp->jpg": (input, outDir) => convertImage(input, "jpg", outDir),
  "webp->png": (input, outDir) => convertImage(input, "png", outDir),
  "tiff->jpg": (input, outDir) => convertImage(input, "jpg", outDir),
  "svg->png": (input, outDir) => convertImage(input, "png", outDir),
  "svg->pdf": (input, outDir) => convertSvgToPdf(input, outDir),

  // Audio (ffmpeg-static — bundled binary, no system install needed)
  "mp3->wav": (input, outDir) => convertMedia(input, "wav", outDir),
  "wav->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),
  "aac->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),
  "ogg->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),
  "flac->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),
  "m4a->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),

  // Video (ffmpeg-static — same caveat: Vercel's max function duration
  // will cut off anything but very short/small clips)
  "mp4->avi": (input, outDir) => convertMedia(input, "avi", outDir),
  "mp4->mkv": (input, outDir) => convertMedia(input, "mkv", outDir),
  "mkv->mp4": (input, outDir) => convertMedia(input, "mp4", outDir),
  "mov->mp4": (input, outDir) => convertMedia(input, "mp4", outDir),
  "webm->mp4": (input, outDir) => convertMedia(input, "mp4", outDir),
  "avi->mp4": (input, outDir) => convertMedia(input, "mp4", outDir),

  // Spreadsheet (exceljs — pure JS, no binary at all)
  "csv->xlsx": (input, outDir) => convertSpreadsheet(input, "xlsx", outDir),
  "xlsx->csv": (input, outDir) => convertSpreadsheet(input, "csv", outDir),
};

// Special operations that don't fit the plain from->to model.
const OPERATIONS = {
  merge: async (inputPaths, outDir) => mergePdfs(inputPaths, outDir),
  watermark: async (inputPath, outDir, options) => watermarkPdf(inputPath, outDir, options.watermarkText),
  "github-download": async (url, outDir) => downloadGithubContent(url, outDir),
  "zip-compress": async (inputPaths, outDir, options) => zipCompress(inputPaths, outDir, options),
  "reduce-image": async (inputPath, outDir, options) => reduceImageSize(inputPath, outDir, options),
  "reduce-video": async (inputPath, outDir, options) => reduceVideoSize(inputPath, outDir, options),
};

function getHandler(from, to) {
  return HANDLERS[`${from}->${to}`] || null;
}

function getOperation(name) {
  return OPERATIONS[name] || null;
}

module.exports = { CATEGORIES, getHandler, getOperation };
