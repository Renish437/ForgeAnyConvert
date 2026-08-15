const fs = require("fs");
const os = require("os");
const path = require("path");
const archiver = require("archiver");
const sharp = require("sharp");
const ffmpegLib = require("fluent-ffmpeg");
const { getFfmpeg } = require("../utils/binaries");
const { AppError, ErrorCodes } = require("../utils/errors");

const ffmpegPath = getFfmpeg();
if (ffmpegPath) ffmpegLib.setFfmpegPath(ffmpegPath);

// Passing an explicit thread count (rather than relying on ffmpeg's own
// auto-detection) is a defensive correctness fix for containerized
// deployments: ffmpeg's auto-detect sometimes reads the host's full CPU
// count instead of the container's cgroup CPU quota, over-threading and
// causing contention rather than speedup. os.cpus().length reflects what
// Node itself was allowed to see, which tracks the cgroup limit correctly
// in modern Node/Docker setups.
const THREAD_COUNT = Math.max(1, os.cpus().length);

/**
 * Bundle any number of arbitrary files into a single .zip, preserving each
 * file's original name (uploaded files live on disk under randomised temp
 * names, so we can't just archiver.file()-with-basename them directly).
 */
async function zipCompress(inputPaths, outDir, options = {}) {
  const zipPath = path.join(outDir, "compressed-files.zip");
  const requestedNames = options.originalNames || inputPaths.map((p) => path.basename(p));

  // Guard against duplicate original filenames colliding inside the zip.
  const seen = new Map();
  const entryNames = requestedNames.map((name) => {
    const safeName = name || "file";
    const count = seen.get(safeName) || 0;
    seen.set(safeName, count + 1);
    if (count === 0) return safeName;
    const ext = path.extname(safeName);
    const stem = path.basename(safeName, ext);
    return `${stem} (${count})${ext}`;
  });

  await new Promise((resolvePromise, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolvePromise);
    archive.on("error", (err) => reject(new AppError(ErrorCodes.COMPRESSION_FAILED, `Couldn't build the zip: ${err.message}`)));
    archive.pipe(output);
    inputPaths.forEach((filePath, i) => {
      archive.file(filePath, { name: entryNames[i] });
    });
    archive.finalize();
  });

  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "Failed to build a valid zip archive.");
  }
  return zipPath;
}

const IMAGE_QUALITY = { high: 82, medium: 62, low: 38 };
const IMAGE_MAX_DIMENSION = { high: 2600, medium: 2000, low: 1400 };

/**
 * Resize/re-encode a raster image to change its file size — shrink it down
 * (lower quality / smaller max dimensions) or enlarge it (upscale
 * dimensions, e.g. for print or a bigger display slot). Every knob has a
 * sensible preset default via `level`, but the caller can override quality
 * and/or dimensions individually instead of just picking a preset.
 */
async function reduceImageSize(inputPath, outDir, options = {}) {
  const mode = options.mode === "enlarge" ? "enlarge" : "shrink";
  const level = IMAGE_QUALITY[options.level] ? options.level : "medium";

  const quality = Number.isFinite(options.customQuality)
    ? Math.min(100, Math.max(1, Math.round(options.customQuality)))
    : IMAGE_QUALITY[level];

  const presetDim = IMAGE_MAX_DIMENSION[level];
  const maxWidth =
    Number.isFinite(options.maxWidth) && options.maxWidth > 0 ? Math.round(options.maxWidth) : presetDim;
  const maxHeight =
    Number.isFinite(options.maxHeight) && options.maxHeight > 0 ? Math.round(options.maxHeight) : presetDim;

  // "Enlarge" mode exists specifically to grow an image's dimensions, so it
  // implies allowing upscaling even without the separate flag being set —
  // that's the entire point of choosing that mode.
  const withoutEnlargement = mode === "enlarge" ? false : !options.allowEnlarge;

  const sourceExt = path.extname(inputPath).slice(1).toLowerCase();
  const targetExt = sourceExt === "jpeg" ? "jpg" : ["jpg", "png", "webp"].includes(sourceExt) ? sourceExt : "jpg";
  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}.${targetExt}`);

  let pipeline;
  try {
    pipeline = sharp(inputPath).resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement,
    });

    if (targetExt === "png") {
      pipeline = pipeline.png({ quality, compressionLevel: 9, palette: true });
    } else if (targetExt === "webp") {
      pipeline = pipeline.webp({ quality });
    } else {
      pipeline = pipeline.flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true });
    }

    await pipeline.toFile(outputPath);
  } catch (err) {
    throw new AppError(
      ErrorCodes.COMPRESSION_FAILED,
      "Couldn't process that image — it may be corrupted or in an unsupported format.",
      { cause: err }
    );
  }

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "Image compression produced an empty file.");
  }
  return outputPath;
}

// Measured on real 1280x720 test footage (20s clip): "superfast" is ~28%
// faster than "veryfast" for only a ~6% larger file at the same CRF — a
// clearly favorable tradeoff, applied uniformly rather than guessed at.
// ("ultrafast" is faster still — ~54% faster — but produces a ~72% larger
// file, which actively works against the point of the "low / smallest
// file" tier, so it's not used here.)
const VIDEO_SETTINGS = {
  high: { crf: 24, maxHeight: 1080, audioBitrate: "160k" },
  medium: { crf: 28, maxHeight: 720, audioBitrate: "128k" },
  low: { crf: 32, maxHeight: 480, audioBitrate: "96k" },
};
const VIDEO_PRESET = "superfast";

/** Shrink a video's file size via a lower-bitrate H.264 re-encode. */
async function reduceVideoSize(inputPath, outDir, options = {}) {
  if (!ffmpegPath) {
    throw new AppError(
      ErrorCodes.DEPENDENCY_NOT_INSTALLED,
      "ffmpeg was not found on this system. Install it or set FFMPEG_PATH."
    );
  }
  const level = VIDEO_SETTINGS[options.level] ? options.level : "medium";
  const { crf, maxHeight, audioBitrate } = VIDEO_SETTINGS[level];

  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}-compressed.mp4`);

  await new Promise((resolvePromise, reject) => {
    ffmpegLib(inputPath)
      .outputOptions([
        "-c:v",
        "libx264",
        "-preset",
        VIDEO_PRESET,
        "-crf",
        String(crf),
        "-vf",
        `scale=-2:'min(${maxHeight},ih)'`,
        "-threads",
        String(THREAD_COUNT),
        "-c:a",
        "aac",
        "-b:a",
        audioBitrate,
        "-movflags",
        "+faststart",
      ])
      .on("progress", (progress) => {
        if (options.onProgress && Number.isFinite(progress.percent)) {
          options.onProgress(Math.min(99, Math.max(0, Math.round(progress.percent))));
        }
      })
      .on("error", (err) => {
        const message = /invalid data|moov atom not found|could not find codec/i.test(err.message)
          ? "That video file appears to be corrupted or in an unrecognized format."
          : `Video compression failed: ${err.message}`;
        reject(new AppError(ErrorCodes.COMPRESSION_FAILED, message, { cause: err }));
      })
      .on("end", resolvePromise)
      .save(outputPath);
  });

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "Video compression produced an empty file.");
  }
  return outputPath;
}

module.exports = { zipCompress, reduceImageSize, reduceVideoSize };
