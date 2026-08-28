const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { getHandler, getOperation } = require("../converters/registry");
const { normalizeExt, mimeFor } = require("../utils/fileTypes");
const { uploadsDir } = require("../config");
const { createJobWorkspace, cleanupWorkspace } = require("../utils/workspace");
const { ErrorCodes, toClientError } = require("../utils/errors");
const config = require("../config");

const router = express.Router();

// Preserve the original extension on uploaded temp files. Several of the
// tools we shell out to (LibreOffice, ffmpeg, pandoc) pick their import
// filter from the file extension rather than sniffing content, so a
// random extension-less temp name (multer's default) can cause silently
// wrong or failed conversions.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 20 },
});

// Operations that take several uploaded files at once (merge PDFs, bundle
// arbitrary files into a zip) rather than exactly one.
const MULTI_FILE_OPERATIONS = new Set(["merge", "zip-compress"]);
// Operations that take a URL instead of an uploaded file entirely (a
// GitHub file or repo link).
const URL_OPERATIONS = new Set(["github-download"]);

/** Insert a short random suffix before the extension, e.g. "report-a1b2c3d4.pdf". */
function withUuidSuffix(filename, shouldAppend) {
  if (!shouldAppend) return filename;

  const ext = path.extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  const shortId = crypto.randomUUID().split("-")[0];

  return `${base}-${shortId}${ext}`;
}

/** Make a filename safe for use in an HTTP Content-Disposition header. */
function sanitizeHeaderFilename(filename) {
  return filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
}

router.post("/", upload.array("files"), async (req, res) => {
  const uploadedFiles = req.files || [];
  const { dir: jobDir } = createJobWorkspace();

  // Always clean up both the job's output workspace and the raw multer
  // uploads, whether the request succeeded, failed, or the client hung up
  // at any point. Guarded so multiple close/error events only clean once.
  let cleaned = false;
  const cleanupAll = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupWorkspace(jobDir);
    for (const f of uploadedFiles) {
      fs.rm(f.path, { force: true }, () => {});
    }
  };

  // Registered immediately, before any conversion work starts, so we don't
  // miss a genuine client disconnect that happens while a slow conversion
  // is still running. Deliberately listens on the *response* only — the
  // *request* object's "close" event fires as soon as its (often tiny)
  // body has been fully read, which is unrelated to whether the client is
  // still waiting for a reply, and would trigger cleanup while the
  // conversion is still in flight.
  res.on("close", cleanupAll);

  // Every validation failure needs the same temp-file cleanup as a thrown
  // error would get in the catch block, so route 400s through here too.
  const badRequest = (message, code = ErrorCodes.INVALID_INPUT) => {
    cleanupAll();
    if (!res.headersSent)
      res.status(400).json({ success: false, error: { code, message } });
  };

  try {
    const operation = req.body.operation || null;
    const appendUuid =
      req.body.appendUuid === "true" || req.body.appendUuid === true;

    let resultPath;
    let isZip = false;
    let targetExt;
    let downloadName;

    if (operation && URL_OPERATIONS.has(operation)) {
      // GitHub file or repo link. No file upload involved; the backend
      // fetches the content itself.
      const url = (req.body.url || "").trim();
      if (!url) return badRequest("Paste a link first.");

      const handler = getOperation(operation);
      if (!handler) return badRequest(`Unknown operation "${operation}".`);

      resultPath = await handler(url, jobDir);
      targetExt = normalizeExt(resultPath);
      isZip = targetExt === "zip";
      downloadName = path.basename(resultPath);
    } else if (operation && MULTI_FILE_OPERATIONS.has(operation)) {
      // e.g. merge: multiple PDFs -> one PDF; zip-compress: many files -> one zip
      if (uploadedFiles.length === 0) return badRequest("No file(s) uploaded.");
      const handler = getOperation(operation);
      if (!handler) return badRequest(`Unknown operation "${operation}".`);
      if (operation === "merge" && uploadedFiles.length < 2) {
        return badRequest("Merging requires at least 2 files.");
      }
      const inputPaths = uploadedFiles.map((f) => f.path);
      const originalNames = uploadedFiles.map((f) => f.originalname);
      resultPath = await handler(inputPaths, jobDir, { originalNames });
      targetExt = normalizeExt(resultPath);
      isZip = targetExt === "zip";
      downloadName = isZip
        ? uploadedFiles.length > 1
          ? `${uploadedFiles.length}-files-compressed.zip`
          : `${path.parse(uploadedFiles[0].originalname).name}-compressed.zip`
        : path.basename(resultPath);
    } else if (operation) {
      // Single-file special operation: compress / protect / watermark /
      // pptx-images / reduce-image / reduce-video
      if (uploadedFiles.length === 0) return badRequest("No file(s) uploaded.");
      const handler = getOperation(operation);
      if (!handler) return badRequest(`Unknown operation "${operation}".`);
      const options = {
        password: req.body.password,
        watermarkText: req.body.watermarkText,
        quality: req.body.quality || "ebook",
        imageFormat: req.body.imageFormat || "png",
        level: req.body.level || "medium",
        mode: req.body.mode,
        customQuality: req.body.customQuality
          ? Number(req.body.customQuality)
          : undefined,
        maxWidth: req.body.maxWidth ? Number(req.body.maxWidth) : undefined,
        maxHeight: req.body.maxHeight ? Number(req.body.maxHeight) : undefined,
        allowEnlarge:
          req.body.allowEnlarge === "true" || req.body.allowEnlarge === true,
      };
      const outcome = await handler(uploadedFiles[0].path, jobDir, options);
      if (typeof outcome === "object" && outcome.path) {
        resultPath = outcome.path;
        isZip = outcome.isZip;
      } else {
        resultPath = outcome;
      }
      targetExt = isZip ? "zip" : normalizeExt(resultPath);
      const originalBase = path.parse(uploadedFiles[0].originalname).name;
      downloadName = isZip
        ? `${originalBase}-converted.zip`
        : `${originalBase}.${targetExt}`;
    } else {
      // Plain from -> to conversion
      if (uploadedFiles.length === 0) return badRequest("No file(s) uploaded.");
      if (uploadedFiles.length > 1) {
        return badRequest(
          "This conversion type accepts only one file at a time.",
        );
      }
      const file = uploadedFiles[0];
      const from = normalizeExt(file.originalname);
      const to = normalizeExt(req.body.to || "");
      if (!to) return badRequest('Missing target format ("to").');

      const handler = getHandler(from, to);
      if (!handler) {
        return badRequest(
          `Converting .${from} to .${to} isn't supported yet.`,
          ErrorCodes.UNSUPPORTED_FORMAT,
        );
      }

      const outcome = await handler(file.path, jobDir, {});
      if (typeof outcome === "object" && outcome.path) {
        resultPath = outcome.path;
        isZip = outcome.isZip;
      } else {
        resultPath = outcome;
      }
      targetExt = isZip ? "zip" : to;
      const originalBase = path.parse(file.originalname).name;
      downloadName = isZip
        ? `${originalBase}-converted.zip`
        : `${originalBase}.${targetExt}`;
    }

    downloadName = withUuidSuffix(downloadName, appendUuid);

    // The client may have already disconnected while the conversion above
    // was running. Don't bother streaming to a dead connection — cleanupAll
    // already ran via the "close" listeners registered at the top.
    if (res.writableEnded || res.destroyed) {
      return;
    }

    res.setHeader("Content-Type", mimeFor(targetExt));
    const safeDownloadName = sanitizeHeaderFilename(downloadName);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeDownloadName}"`,
    );

   
    const resultSize = fs.statSync(resultPath).size;
    res.setHeader("X-Result-Size", String(resultSize));
    if (uploadedFiles.length > 0) {
      const originalSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
      res.setHeader("X-Original-Size", String(originalSize));
    }
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition, X-Result-Size, X-Original-Size",
    );

    const stream = fs.createReadStream(resultPath);
    stream.pipe(res);
    stream.on("close", cleanupAll);
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      cleanupAll();
    });
  } catch (err) {
    console.error("Conversion failed:", err);
    cleanupAll();
    if (!res.headersSent) {
      const { code, message, status } = toClientError(err);
      res.status(status).json({ success: false, error: { code, message } });
    }
  }
});

module.exports = router;
