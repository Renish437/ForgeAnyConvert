const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { PDFDocument, rgb, degrees, StandardFonts } = require("pdf-lib");
const { run } = require("../utils/run");
const { getPdftoppm, getPdftotext, getGhostscript, getQpdf } = require("../utils/binaries");
const { AppError, ErrorCodes } = require("../utils/errors");

/**
 * Classifies a poppler/qpdf CLI tool's stderr text into the right
 * structured error. Patterns below are the exact real strings these tools
 * emit (verified directly, not guessed) for encrypted and corrupted PDFs.
 */
function classifyPdfToolError(stderrText) {
  const text = (stderrText || "").toLowerCase();
  if (text.includes("incorrect password") || text.includes("invalid password")) {
    return new AppError(
      ErrorCodes.PDF_PASSWORD_REQUIRED,
      "This PDF is password-protected. Provide the correct password, or remove the existing protection " +
        "before processing it."
    );
  }
  if (
    text.includes("trailer dictionary") ||
    text.includes("read xref") ||
    text.includes("may not be a pdf") ||
    text.includes("pdf header") ||
    text.includes("file is damaged") ||
    text.includes("recovering damaged file")
  ) {
    return new AppError(
      ErrorCodes.PDF_PARSE_FAILED,
      "This file couldn't be read as a PDF — it may be corrupted, truncated, or not actually a PDF."
    );
  }
  return null;
}

/** PDF -> plain text, via poppler's pdftotext. */
async function pdfToText(inputPath, outDir) {
  const pdftotext = getPdftotext();
  if (!pdftotext) {
    throw new AppError(
      ErrorCodes.DEPENDENCY_NOT_INSTALLED,
      "pdftotext (poppler-utils) was not found on this system. Install poppler-utils or set PDFTOTEXT_PATH."
    );
  }
  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}.txt`);

  try {
    // -layout preserves the PDF's visual column/paragraph structure in the
    // extracted text rather than emitting a raw, unstructured word stream.
    await run(pdftotext, ["-layout", inputPath, outputPath]);
  } catch (err) {
    throw classifyPdfToolError(err.message) || new AppError(
      ErrorCodes.PDF_PARSE_FAILED,
      "Couldn't extract text from that PDF.",
      { cause: err }
    );
  }

  if (!fs.existsSync(outputPath)) {
    throw new AppError(ErrorCodes.PDF_PARSE_FAILED, "Text extraction did not produce an output file.");
  }

  // pdftotext exits 0 (success) even for a PDF with no real text layer —
  // it just writes page-break control characters and nothing else.
  // Returning that silently as a "successful" extraction would hide the
  // actual problem: the PDF is scanned/image-only and needs OCR, which
  // this tool doesn't perform.
  const extracted = fs.readFileSync(outputPath, "utf8");
  const meaningfulText = extracted.replace(/[\f\s]/g, "");
  if (meaningfulText.length === 0) {
    throw new AppError(
      ErrorCodes.PDF_OCR_REQUIRED,
      "No extractable text was found in this PDF — it looks like a scanned/image-only document. OCR " +
        "(optical character recognition) would be required to pull text from it, which this converter " +
        "doesn't perform."
    );
  }

  return outputPath;
}

/**
 * PDF -> images. One page = a single image file returned directly.
 * Multiple pages = every page rendered and zipped, since a "download" can
 * only ever be one file.
 */
async function pdfToImages(inputPath, targetExt, outDir) {
  const pdftoppm = getPdftoppm();
  if (!pdftoppm) {
    throw new AppError(
      ErrorCodes.DEPENDENCY_NOT_INSTALLED,
      "pdftoppm (poppler-utils) was not found on this system. Install poppler-utils or set PDFTOPPM_PATH."
    );
  }
  const baseName = path.parse(inputPath).name;
  const format = targetExt === "jpg" ? "jpeg" : "png";
  const prefix = path.join(outDir, baseName);

  try {
    await run(pdftoppm, [`-${format}`, "-r", "150", inputPath, prefix]);
  } catch (err) {
    throw classifyPdfToolError(err.message) || new AppError(
      ErrorCodes.PDF_PARSE_FAILED,
      "Couldn't render that PDF to images.",
      { cause: err }
    );
  }

  const files = fs
    .readdirSync(outDir)
    .filter((f) => f.startsWith(`${baseName}-`))
    .sort()
    .map((f) => path.join(outDir, f));

  if (files.length === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "No pages were rendered from the PDF.");
  }

  if (files.length === 1) {
    const single = path.join(outDir, `${baseName}.${targetExt}`);
    fs.renameSync(files[0], single);
    return { path: single, isZip: false };
  }

  const zipPath = path.join(outDir, `${baseName}-pages.zip`);
  await zipFiles(files, zipPath);
  return { path: zipPath, isZip: true };
}

function zipFiles(filePaths, zipPath) {
  return new Promise((resolvePromise, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolvePromise(zipPath));
    archive.on("error", (err) => reject(new AppError(ErrorCodes.INTERNAL_ERROR, "Couldn't build the zip.", { cause: err })));
    archive.pipe(output);
    for (const f of filePaths) archive.file(f, { name: path.basename(f) });
    archive.finalize();
  });
}

/** Loads a PDF via pdf-lib, translating its errors into structured ones. */
async function loadPdfLibDoc(inputPath, { forEncryption = false } = {}) {
  const bytes = fs.readFileSync(inputPath);
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: !forEncryption });
  } catch (err) {
    const message = (err.message || "").toLowerCase();
    if (message.includes("encrypt")) {
      throw new AppError(
        ErrorCodes.PDF_PASSWORD_REQUIRED,
        "This PDF is password-protected. Provide the correct password, or remove the existing protection " +
          "before processing it."
      );
    }
    throw new AppError(
      ErrorCodes.PDF_PARSE_FAILED,
      "This file couldn't be read as a PDF — it may be corrupted, truncated, or not actually a PDF.",
      { cause: err }
    );
  }
}

/** Merge many PDFs (in the given order) into one. */
async function mergePdfs(inputPaths, outDir) {
  const merged = await PDFDocument.create();
  for (const inputPath of inputPaths) {
    const doc = await loadPdfLibDoc(inputPath);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  const outputPath = path.join(outDir, "merged.pdf");
  fs.writeFileSync(outputPath, await merged.save());

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "Merging produced an empty file.");
  }
  return outputPath;
}

/** Shrink file size using Ghostscript's PDF re-writer. */
async function compressPdf(inputPath, outDir, quality = "ebook") {
  const gs = getGhostscript();
  if (!gs) {
    throw new AppError(
      ErrorCodes.DEPENDENCY_NOT_INSTALLED,
      "Ghostscript was not found on this system. Install it or set GHOSTSCRIPT_PATH."
    );
  }
  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}-compressed.pdf`);
  try {
    // /screen /ebook /printer /prepress, low -> high quality & size
    await run(gs, [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=/${quality}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ]);
  } catch (err) {
    throw classifyPdfToolError(err.message) || new AppError(
      ErrorCodes.COMPRESSION_FAILED,
      "Couldn't compress that PDF.",
      { cause: err }
    );
  }

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "Compression produced an empty file.");
  }
  return outputPath;
}

/**
 * Encrypt a PDF with a user (open) password via qpdf. Verifies afterward
 * that the output genuinely requires the password to open — never reports
 * success on the strength of qpdf's exit code alone.
 */
async function protectPdf(inputPath, outDir, password) {
  if (!password || !password.trim()) {
    throw new AppError(ErrorCodes.INVALID_INPUT, "A password is required to protect a PDF.");
  }
  const qpdf = getQpdf();
  if (!qpdf) {
    throw new AppError(
      ErrorCodes.DEPENDENCY_NOT_INSTALLED,
      "qpdf was not found on this system. Install it or set QPDF_PATH."
    );
  }
  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}-protected.pdf`);

  try {
    await run(qpdf, [
      "--encrypt",
      password, // user password (needed to open)
      password, // owner password (kept the same for simplicity)
      "256",
      "--",
      inputPath,
      outputPath,
    ]);
  } catch (err) {
    const classified = classifyPdfToolError(err.message);
    if (classified) throw classified;
    throw new AppError(
      ErrorCodes.PDF_ENCRYPTION_FAILED,
      "Couldn't add password protection to that PDF.",
      { cause: err }
    );
  }

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new AppError(ErrorCodes.PDF_ENCRYPTION_FAILED, "Password protection produced an empty file.");
  }

  // Verify the encryption actually took effect: opening WITHOUT the
  // password must fail, and opening WITH it must succeed. This is the
  // difference between "qpdf exited 0" and "the PDF is genuinely locked" —
  // never report success without checking both directions.
  try {
    await run(qpdf, ["--check", outputPath]);
    throw new AppError(
      ErrorCodes.OUTPUT_VALIDATION_FAILED,
      "The output PDF doesn't actually require a password to open — encryption verification failed."
    );
  } catch (err) {
    if (!(err instanceof AppError) && !/password/i.test(err.message)) {
      // qpdf --check failed for some reason OTHER than "this file is
      // password-protected" (which is what we want to see) — that's a
      // genuine problem with the output.
      throw new AppError(
        ErrorCodes.OUTPUT_VALIDATION_FAILED,
        "Couldn't verify that the generated PDF is properly password-protected.",
        { cause: err }
      );
    }
    if (err instanceof AppError) throw err;
    // Expected: qpdf --check refused without a password — protection verified.
  }

  try {
    await run(qpdf, [`--password=${password}`, "--check", outputPath]);
  } catch (err) {
    throw new AppError(
      ErrorCodes.OUTPUT_VALIDATION_FAILED,
      "The generated PDF couldn't be verified to open with the password you set.",
      { cause: err }
    );
  }

  return outputPath;
}

/** Stamp a diagonal text watermark onto every page. */
async function watermarkPdf(inputPath, outDir, text = "WATERMARK") {
  const doc = await loadPdfLibDoc(inputPath, { forEncryption: false });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = Math.min(width, height) / 10;
    page.drawText(text, {
      x: width / 2 - (text.length * fontSize) / 4,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.35,
      rotate: degrees(45),
    });
  }

  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}-watermarked.pdf`);
  fs.writeFileSync(outputPath, await doc.save());

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "Watermarking produced an empty file.");
  }
  return outputPath;
}

module.exports = {
  pdfToText,
  pdfToImages,
  mergePdfs,
  compressPdf,
  protectPdf,
  watermarkPdf,
  zipFiles,
};
