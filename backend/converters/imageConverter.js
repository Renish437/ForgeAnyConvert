const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { PDFDocument } = require("pdf-lib");
const { run } = require("../utils/run");
const { getImageMagick } = require("../utils/binaries");

const RASTER_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff"]);

/**
 * Raster <-> raster conversion (jpg/png/webp/gif/bmp/tiff), plus SVG -> PNG
 * rasterization. Sharp bundles libvips for every OS, so no system install
 * is required here — it "just works" on Linux, macOS and Windows alike.
 */
async function convertImage(inputPath, targetExt, outDir) {
  const baseName = path.parse(inputPath).name;
  const ext = targetExt.toLowerCase();
  const outputPath = path.join(outDir, `${baseName}.${ext}`);

  // sharp/libvips encoding support for bmp and gif is limited/build-dependent,
  // so route those straight to ImageMagick rather than risk a runtime failure.
  if (ext === "bmp" || ext === "gif") {
    return convertWithImageMagick(inputPath, ext, outDir);
  }

  try {
    let pipeline = sharp(inputPath, { density: 300 }); // density matters for SVG input
    switch (ext) {
      case "jpg":
      case "jpeg":
        pipeline = pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 92 });
        break;
      case "png":
        pipeline = pipeline.png();
        break;
      case "webp":
        pipeline = pipeline.webp({ quality: 92 });
        break;
      case "tiff":
        pipeline = pipeline.tiff();
        break;
      default:
        throw new Error(`Unsupported image target format: ${ext}`);
    }
    await pipeline.toFile(outputPath);
    return outputPath;
  } catch (err) {
    // sharp couldn't decode the source (e.g. some BMP variants) — ImageMagick
    // has broader legacy-format read support, so fall back to it rather than
    // failing outright.
    return convertWithImageMagick(inputPath, ext, outDir);
  }
}

/**
 * SVG -> PDF. Rather than depend on ImageMagick's rsvg-convert delegate
 * (an extra, easy-to-miss system dependency), we rasterize with sharp and
 * embed the result into a single-page PDF sized to match with pdf-lib —
 * both are already npm dependencies, so this works on any OS with nothing
 * extra to install.
 */
async function convertSvgToPdf(inputPath, outDir) {
  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}.pdf`);

  const pngBuffer = await sharp(inputPath, { density: 300 }).png().toBuffer();
  const meta = await sharp(pngBuffer).metadata();

  // Convert pixel dimensions (rendered at 300 DPI) down to PDF points (72/in).
  const widthPt = (meta.width / 300) * 72;
  const heightPt = (meta.height / 300) * 72;

  const doc = await PDFDocument.create();
  const image = await doc.embedPng(pngBuffer);
  const page = doc.addPage([widthPt, heightPt]);
  page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });

  fs.writeFileSync(outputPath, await doc.save());
  return outputPath;
}

async function convertWithImageMagick(inputPath, targetExt, outDir) {
  const magick = getImageMagick();
  if (!magick) {
    throw new Error("ImageMagick was not found on this system. Install it or set IMAGEMAGICK_PATH.");
  }
  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}.${targetExt}`);
  // `magick` (IM7) takes "magick in out"; `convert` (IM6) takes "convert in out". Both accept this arg order.
  const args = path.basename(magick).includes("magick")
    ? [inputPath, outputPath]
    : [inputPath, outputPath];
  await run(magick, args, { timeoutMs: 2 * 60 * 1000 });
  return outputPath;
}

module.exports = { convertImage, convertSvgToPdf, RASTER_FORMATS };
