const os = require("os");
const fs = require("fs");
const path = require("path");
const ffmpegLib = require("fluent-ffmpeg");
const { getFfmpeg, getFfprobe } = require("../utils/binaries");
const { AppError, ErrorCodes } = require("../utils/errors");

const ffmpegPath = getFfmpeg();
const ffprobePath = getFfprobe();
if (ffmpegPath) ffmpegLib.setFfmpegPath(ffmpegPath);
if (ffprobePath) ffmpegLib.setFfprobePath(ffprobePath);

const THREAD_COUNT = Math.max(1, os.cpus().length);

// Codec choice per target container, tuned for broad playback compatibility
// rather than max quality/speed. "copy" pairs are tried when codecs are
// already compatible between the two containers, saving a costly re-encode.
const AUDIO_CODEC = {
  mp3: ["-c:a", "libmp3lame", "-q:a", "2"],
  wav: ["-c:a", "pcm_s16le"],
};

// "superfast" measured ~28% faster than "veryfast" for only ~6% larger
// output on real 720p test footage, with no quality loss (same CRF) — see
// compressConverter.js for the full benchmark. Applied here too since this
// is the same libx264 encode path, just triggered by a plain format
// conversion instead of the explicit "shrink" operation.
const VIDEO_RECODE = ["-c:v", "libx264", "-preset", "superfast", "-crf", "23", "-threads", String(THREAD_COUNT), "-c:a", "aac", "-b:a", "160k"];

// Pairs where source/target containers commonly already share codecs, so a
// plain remux (stream copy) is attempted first — this is dramatically
// faster than re-encoding (seconds vs. real-time-or-worse) since it's just
// repackaging the existing compressed bitstream, not re-compressing it.
const REMUX_CANDIDATES = new Set(["mp4->mkv", "mkv->mp4", "mov->mp4", "avi->mp4"]);

const CORRUPT_INPUT_PATTERN = /invalid data|moov atom not found|could not find codec|invalid argument/i;

function isAudioExt(ext) {
  return ["mp3", "wav", "aac", "ogg", "flac", "m4a"].includes(ext);
}

async function convertMedia(inputPath, targetExt, outDir) {
  if (!ffmpegPath) {
    throw new AppError(
      ErrorCodes.DEPENDENCY_NOT_INSTALLED,
      "ffmpeg was not found on this system. Install it or set FFMPEG_PATH."
    );
  }
  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}.${targetExt}`);
  const sourceExt = path.extname(inputPath).slice(1).toLowerCase();

  let resultPath;
  if (isAudioExt(targetExt)) {
    resultPath = await runFfmpeg(inputPath, outputPath, AUDIO_CODEC[targetExt] || []);
  } else {
    // Video target
    const pairKey = `${sourceExt}->${targetExt}`;
    if (REMUX_CANDIDATES.has(pairKey)) {
      try {
        resultPath = await runFfmpeg(inputPath, outputPath, ["-c", "copy"]);
      } catch {
        // Codecs inside the container weren't actually compatible — fall
        // through to a full re-encode below.
        resultPath = await runFfmpeg(inputPath, outputPath, VIDEO_RECODE);
      }
    } else {
      resultPath = await runFfmpeg(inputPath, outputPath, VIDEO_RECODE);
    }
  }

  if (!fs.existsSync(resultPath) || fs.statSync(resultPath).size === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "The conversion produced an empty file.");
  }
  return resultPath;
}

function runFfmpeg(inputPath, outputPath, extraArgs) {
  return new Promise((resolvePromise, reject) => {
    ffmpegLib(inputPath)
      .outputOptions(extraArgs)
      .on("error", (err) => {
        const message = CORRUPT_INPUT_PATTERN.test(err.message)
          ? "That media file appears to be corrupted or in an unrecognized format."
          : `Conversion failed: ${err.message}`;
        reject(new AppError(ErrorCodes.COMPRESSION_FAILED, message, { cause: err }));
      })
      .on("end", () => resolvePromise(outputPath))
      .save(outputPath);
  });
}

module.exports = { convertMedia, isAudioExt };
