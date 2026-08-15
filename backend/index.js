const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const config = require("./config");
const formatsRoute = require("./routes/formats");
const convertRoute = require("./routes/convert");

// Ensure scratch directories exist before anything tries to write into them.
for (const dir of [config.uploadsDir, config.outputsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();

// Vercel gives every deployment of a project its own URL: the stable
// production alias (forge-any-convert.vercel.app) plus a new one per
// preview/branch build (forge-any-convert-<hash-or-branch>.vercel.app).
// Matching that whole family by pattern means CORS keeps working across
// every preview deploy without hand-maintaining an exact-string env var —
// CORS_ORIGINS still works as an explicit allowlist on top of this for
// anything outside that pattern (e.g. a custom domain).
const explicitOrigins = new Set(config.corsOrigins);
const VERCEL_PROJECT_ORIGIN =
  /^https:\/\/forge-any-convert(-[a-z0-9-]+)?\.vercel\.app$/i;

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header at all (curl, server-to-server, same-origin) — allow.
      if (!origin) return callback(null, true);
      const allowed =
        explicitOrigins.has(origin) || VERCEL_PROJECT_ORIGIN.test(origin);
      callback(null, allowed);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    exposedHeaders: ["Content-Disposition", "X-Original-Size", "X-Result-Size"],
  }),
);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/formats", formatsRoute);
app.use("/api/convert", convertRoute);

// Central error handler — catches Multer errors (e.g. file too large) and
// anything else thrown synchronously, and always responds with JSON so the
// frontend never has to parse an HTML error page.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `File is too large. Max size is ${config.maxUploadBytes / (1024 * 1024)} MB.`
        : err.message;
    return res.status(400).json({ message });
  }
  console.error(err);
  console.error(err.message);
  console.error(err.stack);
  res.status(500).json({
    message: "Unexpected server error.",
    debug: err.message, // TEMP — remove before real users hit this
    stack: err.stack, // TEMP — remove before real users hit this
  });
});

// Periodic sweep for orphaned temp directories (e.g. left behind after a
// crash mid-request), so disk usage doesn't grow unbounded over time.
setInterval(
  () => {
    for (const dir of [config.uploadsDir, config.outputsDir]) {
      fs.readdir(dir, (err, entries) => {
        if (err) return;
        const now = Date.now();
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          fs.stat(fullPath, (statErr, stats) => {
            if (statErr) return;
            if (now - stats.mtimeMs > config.jobTtlMs) {
              fs.rm(fullPath, { recursive: true, force: true }, () => {});
            }
          });
        }
      });
    }
  },
  5 * 60 * 1000,
).unref();

// Vercel's @vercel/node builder imports this file and calls the exported
// app as a request handler directly — it does not run app.listen() itself,
// and calling it in that environment would try (and fail) to bind a real
// port. Everywhere else (Docker, a VPS, local dev) nothing sets
// process.env.VERCEL, so this behaves exactly as before.
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`ForgeAnyConvert backend listening on port ${config.port}`);
  });
}

module.exports = app;
