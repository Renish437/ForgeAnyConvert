const { convertWithLibreOffice } = require("./libreofficeConverter");
const { convertImage, convertSvgToPdf } = require("./imageConverter");
const {
  pdfToText,
  pdfToImages,
  mergePdfs,
  compressPdf,
  protectPdf,
  watermarkPdf,
} = require("./pdfConverter");
const { convertMedia } = require("./mediaConverter");
const { convertSpreadsheet } = require("./spreadsheetConverter");
const { convertMarkdown } = require("./markdownConverter");
const { convertEbook } = require("./ebookConverter");
const { downloadGithubContent } = require("./githubConverter");
const { zipCompress, reduceImageSize, reduceVideoSize } = require("./compressConverter");

const lo = (ext) => (inputPath, outDir) => convertWithLibreOffice(inputPath, ext, outDir);

// Every category the UI exposes, in display order, with the exact from/to
// pairs the product spec asked for. `key` is how the pair is looked up at
// convert-time: normal pairs are "from->to"; special same-file-type PDF
// operations use a dedicated operation id instead (see routes/convert.js).
const CATEGORIES = [
  {
    id: "documents",
    label: "Documents",
    pairs: [
      { from: "docx", to: "pdf" },
      { from: "doc", to: "pdf" },
      { from: "pdf", to: "docx" },
      { from: "docx", to: "txt" },
      { from: "txt", to: "pdf" },
      { from: "txt", to: "docx" },
      { from: "docx", to: "html" },
      { from: "html", to: "pdf" },
      { from: "md", to: "pdf", label: "Markdown (.md)" },
      { from: "md", to: "docx", label: "Markdown (.md)" },
      { from: "odt", to: "pdf" },
      { from: "rtf", to: "pdf" },
    ],
  },
  {
    id: "images",
    label: "Images",
    pairs: [
      { from: "jpg", to: "png" },
      { from: "png", to: "jpg" },
      { from: "webp", to: "jpg" },
      { from: "webp", to: "png" },
      { from: "gif", to: "png" },
      { from: "bmp", to: "png" },
      { from: "tiff", to: "jpg" },
      { from: "svg", to: "png" },
      { from: "svg", to: "pdf" },
    ],
  },
  {
    id: "pdf-tools",
    label: "PDF Tools",
    pairs: [
      { from: "pdf", to: "docx" },
      { from: "pdf", to: "txt" },
      { from: "pdf", to: "jpg" },
      { from: "pdf", to: "png" },
      { operation: "merge", from: "pdf", to: "pdf", label: "Multiple PDFs \u2192 Single PDF" },
      { operation: "compress", from: "pdf", to: "pdf", label: "PDF \u2192 Compressed PDF" },
      { operation: "protect", from: "pdf", to: "pdf", label: "PDF \u2192 Password Protected PDF" },
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
      { from: "xlsx", to: "pdf" },
      { from: "xls", to: "pdf" },
      { from: "csv", to: "xlsx" },
      { from: "xlsx", to: "csv" },
      { from: "ods", to: "xlsx" },
    ],
  },
  {
    id: "presentation",
    label: "Presentation",
    pairs: [
      { from: "pptx", to: "pdf" },
      { from: "ppt", to: "pdf" },
      { from: "odp", to: "pdf" },
      { operation: "pptx-images", from: "pptx", to: "png", label: "PPTX \u2192 Images (PNG/JPG)" },
    ],
  },
  {
    id: "ebook",
    label: "E-book",
    pairs: [
      { from: "epub", to: "pdf" },
      { from: "epub", to: "docx" },
      { from: "mobi", to: "epub" },
      { from: "pdf", to: "epub" },
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
  // Documents (LibreOffice handles almost all office-document plumbing)
  "docx->pdf": lo("pdf"),
  "doc->pdf": lo("pdf"),
  "pdf->docx": lo("docx"),
  "docx->txt": lo("txt"),
  "txt->pdf": lo("pdf"),
  "txt->docx": lo("docx"),
  "docx->html": lo("html"),
  "html->pdf": lo("pdf"),
  "odt->pdf": lo("pdf"),
  "rtf->pdf": lo("pdf"),
  "md->pdf": (input, outDir) => convertMarkdown(input, "pdf", outDir),
  "md->docx": (input, outDir) => convertMarkdown(input, "docx", outDir),

  // Images
  "jpg->png": (input, outDir) => convertImage(input, "png", outDir),
  "png->jpg": (input, outDir) => convertImage(input, "jpg", outDir),
  "webp->jpg": (input, outDir) => convertImage(input, "jpg", outDir),
  "webp->png": (input, outDir) => convertImage(input, "png", outDir),
  "gif->png": (input, outDir) => convertImage(input, "png", outDir),
  "bmp->png": (input, outDir) => convertImage(input, "png", outDir),
  "tiff->jpg": (input, outDir) => convertImage(input, "jpg", outDir),
  "svg->png": (input, outDir) => convertImage(input, "png", outDir),
  "svg->pdf": (input, outDir) => convertSvgToPdf(input, outDir),

  // PDF tools
  "pdf->txt": pdfToText,
  "pdf->jpg": (input, outDir) => pdfToImages(input, "jpg", outDir),
  "pdf->png": (input, outDir) => pdfToImages(input, "png", outDir),

  // Audio
  "mp3->wav": (input, outDir) => convertMedia(input, "wav", outDir),
  "wav->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),
  "aac->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),
  "ogg->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),
  "flac->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),
  "m4a->mp3": (input, outDir) => convertMedia(input, "mp3", outDir),

  // Video
  "mp4->avi": (input, outDir) => convertMedia(input, "avi", outDir),
  "mp4->mkv": (input, outDir) => convertMedia(input, "mkv", outDir),
  "mkv->mp4": (input, outDir) => convertMedia(input, "mp4", outDir),
  "mov->mp4": (input, outDir) => convertMedia(input, "mp4", outDir),
  "webm->mp4": (input, outDir) => convertMedia(input, "mp4", outDir),
  "avi->mp4": (input, outDir) => convertMedia(input, "mp4", outDir),

  // Spreadsheet
  "xlsx->pdf": lo("pdf"),
  "xls->pdf": lo("pdf"),
  "csv->xlsx": (input, outDir) => convertSpreadsheet(input, "xlsx", outDir),
  "xlsx->csv": (input, outDir) => convertSpreadsheet(input, "csv", outDir),
  "ods->xlsx": lo("xlsx"),

  // Presentation
  "pptx->pdf": lo("pdf"),
  "ppt->pdf": lo("pdf"),
  "odp->pdf": lo("pdf"),

  // E-book
  "epub->pdf": (input, outDir) => convertEbook(input, "pdf", outDir),
  "epub->docx": (input, outDir) => convertEbook(input, "docx", outDir),
  "mobi->epub": (input, outDir) => convertEbook(input, "epub", outDir),
  "pdf->epub": (input, outDir) => convertEbook(input, "epub", outDir),
};

// Special operations that don't fit the plain from->to model.
const OPERATIONS = {
  merge: async (inputPaths, outDir) => mergePdfs(inputPaths, outDir),
  compress: async (inputPath, outDir, options) => compressPdf(inputPath, outDir, options.quality),
  protect: async (inputPath, outDir, options) => protectPdf(inputPath, outDir, options.password),
  watermark: async (inputPath, outDir, options) => watermarkPdf(inputPath, outDir, options.watermarkText),
  "pptx-images": async (inputPath, outDir, options) => {
    const pdfPath = await convertWithLibreOffice(inputPath, "pdf", outDir);
    return pdfToImages(pdfPath, options.imageFormat === "jpg" ? "jpg" : "png", outDir);
  },
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
