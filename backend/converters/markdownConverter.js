const path = require("path");
const { run } = require("../utils/run");
const { getPandoc } = require("../utils/binaries");
const { convertWithLibreOffice } = require("./libreofficeConverter");

/**
 * Markdown -> DOCX is a direct, built-in pandoc writer (no extra engine
 * needed). Markdown -> PDF is trickier: pandoc's PDF writer normally shells
 * out to a LaTeX engine that most systems won't have installed, so instead
 * we hop through HTML (pandoc) and let LibreOffice do the HTML -> PDF step,
 * which is already a dependency of this project.
 */
async function convertMarkdown(inputPath, targetExt, outDir) {
  const pandoc = getPandoc();
  if (!pandoc) throw new Error("pandoc was not found on this system. Install it or set PANDOC_PATH.");

  const baseName = path.parse(inputPath).name;

  if (targetExt === "docx") {
    const outputPath = path.join(outDir, `${baseName}.docx`);
    await run(pandoc, [inputPath, "-o", outputPath]);
    return outputPath;
  }

  if (targetExt === "pdf") {
    const htmlPath = path.join(outDir, `${baseName}.html`);
    await run(pandoc, [inputPath, "-s", "-o", htmlPath]);
    return convertWithLibreOffice(htmlPath, "pdf", outDir);
  }

  throw new Error(`Unsupported Markdown target: ${targetExt}`);
}

module.exports = { convertMarkdown };
