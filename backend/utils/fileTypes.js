const path = require("path");

const EXT_ALIASES = { jpeg: "jpg" };

function normalizeExt(filenameOrExt) {
  const raw = filenameOrExt.includes(".")
    ? path.extname(filenameOrExt).slice(1)
    : filenameOrExt;
  const lower = raw.toLowerCase();
  return EXT_ALIASES[lower] || lower;
}

const MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  txt: "text/plain",
  html: "text/html",
  md: "text/markdown",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  odp: "application/vnd.oasis.opendocument.presentation",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  ogg: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  webm: "video/webm",
  epub: "application/epub+zip",
  mobi: "application/x-mobipocket-ebook",
  zip: "application/zip",
};

function mimeFor(ext) {
  return MIME_TYPES[ext] || "application/octet-stream";
}

module.exports = { normalizeExt, mimeFor };
