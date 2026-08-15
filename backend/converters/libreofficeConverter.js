const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { run } = require("../utils/run");
const { getLibreOffice } = require("../utils/binaries");

// LibreOffice needs an explicit filter name for a few formats where the
// bare extension is ambiguous (it would otherwise prompt / guess wrong).
const FILTER_BY_EXT = {
  txt: "txt:Text",
  csv: "csv:Text - txt - csv (StarCalc)",
};

/**
 * Convert a single file with headless LibreOffice.
 * Handles: docx/doc/odt/rtf/txt <-> pdf/html/docx/txt, xlsx/xls/ods/csv <-> pdf/xlsx/csv,
 * pptx/ppt/odp -> pdf, and more — anything soffice's filter set supports.
 */
async function convertWithLibreOffice(inputPath, targetExt, outDir) {
  const soffice = getLibreOffice();
  if (!soffice) {
    throw new Error(
      "LibreOffice was not found on this system. Install it (libreoffice.org) or set LIBREOFFICE_PATH."
    );
  }

  // Give every invocation an isolated user profile. Without this, concurrent
  // requests can collide on LibreOffice's profile lock and silently fail.
  const profileDir = path.join(os.tmpdir(), `lo-profile-${crypto.randomUUID()}`);
  const target = FILTER_BY_EXT[targetExt] || targetExt;

  const args = [
    "--headless",
    "--norestore",
    `-env:UserInstallation=file://${profileDir}`,
  ];

  // PDF -> an editable Writer format needs to be told explicitly to import
  // via Writer (readable/editable text), not the default Draw import
  // (which treats the PDF as a flat vector graphic and can't export docx/odt/etc).
  const sourceExt = path.extname(inputPath).slice(1).toLowerCase();
  if (sourceExt === "pdf" && ["docx", "doc", "odt", "rtf", "txt", "html"].includes(targetExt)) {
    args.push("--infilter=writer_pdf_import");
  }

  args.push("--convert-to", target, "--outdir", outDir, inputPath);

  await run(soffice, args, { timeoutMs: 3 * 60 * 1000 });

  fs.rm(profileDir, { recursive: true, force: true }, () => {});

  const baseName = path.parse(inputPath).name;
  const producedExt = target.split(":")[0];
  const outputPath = path.join(outDir, `${baseName}.${producedExt}`);

  if (!fs.existsSync(outputPath)) {
    throw new Error(
      `LibreOffice did not produce the expected output file (${producedExt}). The source file may be corrupt or unsupported.`
    );
  }
  return outputPath;
}

module.exports = { convertWithLibreOffice };
