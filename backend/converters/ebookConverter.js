const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { run } = require("../utils/run");
const { getEbookConvert } = require("../utils/binaries");

/**
 * EPUB/MOBI/PDF e-book conversions via Calibre's `ebook-convert` CLI.
 * Calibre is a large, separately-installed application (not bundled via
 * npm), so this converter fails with a clear, actionable message if it
 * isn't present rather than crashing obscurely.
 */
async function convertEbook(inputPath, targetExt, outDir) {
  const ebookConvert = getEbookConvert();
  if (!ebookConvert) {
    throw new Error(
      "Calibre's ebook-convert was not found on this system. Install Calibre (calibre-ebook.com) " +
        "— it's the only piece of this converter that isn't bundled automatically — or set EBOOK_CONVERT_PATH."
    );
  }

  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}.${targetExt}`);

  // PDF output (and some other paths) render through Qt WebEngine, which
  // is Chromium-based and refuses to run as root at all without an
  // explicit sandbox override — and most Docker containers run as root by
  // default. Without this, ebook-convert exits with "Running as root
  // without --no-sandbox is not supported" and produces no output.
  const runtimeDir = path.join(os.tmpdir(), `xdg-runtime-${crypto.randomUUID()}`);
  fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });

  try {
    await run(ebookConvert, [inputPath, outputPath], {
      timeoutMs: 3 * 60 * 1000,
      env: {
        QTWEBENGINE_DISABLE_SANDBOX: "1",
        XDG_RUNTIME_DIR: runtimeDir,
      },
    });
  } finally {
    fs.rm(runtimeDir, { recursive: true, force: true }, () => {});
  }

  // Calibre can exit 0 while still having produced a broken or empty file
  // for some malformed inputs — verify there's real output before telling
  // the caller this succeeded.
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error(
      `Calibre finished without producing a valid ${targetExt.toUpperCase()} file. The source file may be corrupt, DRM-protected, or use an unsupported ebook format variant.`
    );
  }

  return outputPath;
}

module.exports = { convertEbook };
