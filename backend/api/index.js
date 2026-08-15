// Vercel auto-detects any file under api/ as a Serverless Function. This
// file exists only to re-export the real Express app (../index.js) into
// that convention — the app itself doesn't change based on where it's
// deployed. See index.js for the `if (!process.env.VERCEL)` guard that
// skips app.listen() when running as a Vercel Function.
module.exports = require("../index");
