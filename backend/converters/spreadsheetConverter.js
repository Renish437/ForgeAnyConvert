const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const ExcelJS = require("exceljs");
const chardet = require("chardet");
const iconv = require("iconv-lite");

const BOM_UTF8 = Buffer.from([0xef, 0xbb, 0xbf]);

function normalizeEncodingLabel(detected) {
  if (!detected) return "windows-1252";
  const lower = detected.toLowerCase();
  if (lower.includes("utf-8") || lower === "ascii") return "utf-8";
  return lower;
}

/**
 * Reads a CSV's raw bytes and returns a correctly-decoded UTF-8 string.
 *
 * Real-world CSVs — especially anything exported from Excel on Windows —
 * are very often Windows-1252/Latin-1, not UTF-8. Blindly assuming UTF-8
 * (which is what naively calling exceljs's file reader does) silently
 * turns bytes like an en-dash in Windows-1252 into the U+FFFD replacement
 * character ("6\ufffd19 employees" instead of "6-19 employees") — the
 * corruption doesn't throw an error, so it goes unnoticed until someone
 * reads the output.
 */
function readCsvAsUtf8(inputPath) {
  const buffer = fs.readFileSync(inputPath);

  // An explicit UTF-8 BOM is authoritative — trust it over detection.
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(BOM_UTF8)) {
    return buffer.subarray(3).toString("utf8");
  }
  // UTF-16 BOMs, in case a CSV was saved that way (common from some
  // Windows tools' "Unicode text" export option).
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return iconv.decode(buffer.subarray(2), "utf-16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return iconv.decode(buffer.subarray(2), "utf-16be");
  }

  const encoding = normalizeEncodingLabel(chardet.detect(buffer));
  if (encoding === "utf-8") return buffer.toString("utf8");
  if (iconv.encodingExists(encoding)) return iconv.decode(buffer, encoding);
  // Unrecognized encoding label — Windows-1252 is the safest fallback
  // since every byte value is representable in it, so decoding can't throw.
  return iconv.decode(buffer, "windows-1252");
}

/** CSV -> XLSX and XLSX -> CSV. Pure JS, no external binary needed. */
async function convertSpreadsheet(inputPath, targetExt, outDir) {
  const baseName = path.parse(inputPath).name;
  const outputPath = path.join(outDir, `${baseName}.${targetExt}`);
  const workbook = new ExcelJS.Workbook();

  if (targetExt === "xlsx") {
    const text = readCsvAsUtf8(inputPath);
    await workbook.csv.read(Readable.from(text));
    await workbook.xlsx.writeFile(outputPath);
  } else if (targetExt === "csv") {
    await workbook.xlsx.readFile(inputPath);
    await workbook.csv.writeFile(outputPath, { sheetName: workbook.worksheets[0].name });
  } else {
    throw new Error(`Unsupported spreadsheet target: ${targetExt}`);
  }
  return outputPath;
}

module.exports = { convertSpreadsheet, readCsvAsUtf8 };
