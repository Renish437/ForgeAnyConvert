const path = require("path");
const os = require("os");    

const ROOT = __dirname;
const TMP_ROOT = path.join(os.tmpdir(), "forgeanyconvert");
module.exports = {
  uploadsDir: path.join(ROOT, "tmp", "uploads"),
  outputsDir: path.join(ROOT, "tmp", "outputs"),
  // Max upload size in bytes (default 200 MB, override with MAX_UPLOAD_MB env var)
  maxUploadBytes: (parseInt(process.env.MAX_UPLOAD_MB, 10) || 200) * 1024 * 1024,
  // How long (ms) a job's temp files are kept before forced cleanup, in case a
  // response never finishes (client disconnect, crash, etc). 15 minutes.
  jobTtlMs: 15 * 60 * 1000,
  port: parseInt(process.env.PORT, 10) || 3000,
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
};
