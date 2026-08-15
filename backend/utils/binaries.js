/**
 * Cross-platform resolution of the external CLI tools we shell out to.
 *
 * Every OS puts these binaries in different places, and not every user will
 * have them on PATH. Each resolver:
 *   1. Honours an explicit env var override (best for servers/Docker/CI).
 *   2. Tries the plain command name (works if it's on PATH — the common
 *      case on Linux/macOS, and on Windows if the user ticked "Add to PATH").
 *   3. Falls back to well-known install locations per OS.
 *
 * Results are cached after first successful lookup.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const cache = {};

function commandExists(cmd) {
  try {
    const checker = os.platform() === "win32" ? "where" : "which";
    execFileSync(checker, [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function resolve(name, { envVar, candidates }) {
  if (cache[name]) return cache[name];

  const fromEnv = envVar && process.env[envVar];
  if (fromEnv && fs.existsSync(fromEnv)) {
    cache[name] = fromEnv;
    return fromEnv;
  }

  for (const candidate of candidates) {
    if (candidate.absolute) {
      if (fs.existsSync(candidate.absolute)) {
        cache[name] = candidate.absolute;
        return candidate.absolute;
      }
    } else if (commandExists(candidate.command)) {
      cache[name] = candidate.command;
      return candidate.command;
    }
  }

  return null; // not found — caller decides how to fail
}

function getLibreOffice() {
  const platform = os.platform();
  const candidates =
    platform === "win32"
      ? [
          { command: "soffice" },
          { absolute: "C:\\Program Files\\LibreOffice\\program\\soffice.exe" },
          { absolute: "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe" },
        ]
      : platform === "darwin"
      ? [
          { command: "soffice" },
          { absolute: "/Applications/LibreOffice.app/Contents/MacOS/soffice" },
        ]
      : [{ command: "soffice" }, { command: "libreoffice" }];

  return resolve("libreoffice", { envVar: "LIBREOFFICE_PATH", candidates });
}

function getFfmpeg() {
  // Prefer the npm-bundled static binary (works out of the box on every OS,
  // no system install required); fall back to a system install on PATH.
  let bundled = null;
  try {
    bundled = require("ffmpeg-static");
  } catch {
    /* package not installed / platform unsupported — fall through */
  }
  const candidates = [];
  if (bundled) candidates.push({ absolute: bundled });
  candidates.push({ command: "ffmpeg" });
  return resolve("ffmpeg", { envVar: "FFMPEG_PATH", candidates });
}

function getFfprobe() {
  let bundled = null;
  try {
    bundled = require("ffprobe-static").path;
  } catch {
    /* not installed */
  }
  const candidates = [];
  if (bundled) candidates.push({ absolute: bundled });
  candidates.push({ command: "ffprobe" });
  return resolve("ffprobe", { envVar: "FFPROBE_PATH", candidates });
}

function getPdftoppm() {
  return resolve("pdftoppm", { envVar: "PDFTOPPM_PATH", candidates: [{ command: "pdftoppm" }] });
}

function getPdftotext() {
  return resolve("pdftotext", { envVar: "PDFTOTEXT_PATH", candidates: [{ command: "pdftotext" }] });
}

function getGhostscript() {
  const platform = os.platform();
  const candidates =
    platform === "win32"
      ? [{ command: "gswin64c" }, { command: "gswin32c" }, { command: "gs" }]
      : [{ command: "gs" }];
  return resolve("ghostscript", { envVar: "GHOSTSCRIPT_PATH", candidates });
}

function getQpdf() {
  return resolve("qpdf", { envVar: "QPDF_PATH", candidates: [{ command: "qpdf" }] });
}

function getImageMagick() {
  const platform = os.platform();
  const candidates =
    platform === "win32" ? [{ command: "magick" }, { command: "convert" }] : [{ command: "convert" }, { command: "magick" }];
  return resolve("imagemagick", { envVar: "IMAGEMAGICK_PATH", candidates });
}

function getPandoc() {
  return resolve("pandoc", { envVar: "PANDOC_PATH", candidates: [{ command: "pandoc" }] });
}

function getEbookConvert() {
  const platform = os.platform();
  const candidates =
    platform === "win32"
      ? [
          { command: "ebook-convert" },
          { absolute: "C:\\Program Files\\Calibre2\\ebook-convert.exe" },
        ]
      : platform === "darwin"
      ? [
          { command: "ebook-convert" },
          { absolute: "/Applications/calibre.app/Contents/MacOS/ebook-convert" },
        ]
      : [{ command: "ebook-convert" }];
  return resolve("ebook-convert", { envVar: "EBOOK_CONVERT_PATH", candidates });
}

module.exports = {
  getLibreOffice,
  getFfmpeg,
  getFfprobe,
  getPdftoppm,
  getPdftotext,
  getGhostscript,
  getQpdf,
  getImageMagick,
  getPandoc,
  getEbookConvert,
};
