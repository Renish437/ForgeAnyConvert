const path = require("path");
const os = require("os");           // add this line

const TMP_ROOT = path.join(os.tmpdir(), "forgeanyconvert");   // was: const ROOT = __dirname;

module.exports = {
  uploadsDir: path.join(TMP_ROOT, "uploads"),   // was: path.join(ROOT, "tmp", "uploads")
  outputsDir: path.join(TMP_ROOT, "outputs"),   // was: path.join(ROOT, "tmp", "outputs")
  maxUploadBytes: (parseInt(process.env.MAX_UPLOAD_MB, 10) || 200) * 1024 * 1024,
  jobTtlMs: 15 * 60 * 1000,
  port: parseInt(process.env.PORT, 10) || 3000,
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
};