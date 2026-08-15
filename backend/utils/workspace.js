const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { outputsDir } = require("../config");

/**
 * Each conversion request gets its own scratch directory under tmp/outputs
 * so concurrent jobs never collide, and cleanup is a single rm -rf.
 */
function createJobWorkspace() {
  const jobId = crypto.randomUUID();
  const dir = path.join(outputsDir, jobId);
  fs.mkdirSync(dir, { recursive: true });
  return { jobId, dir };
}

function cleanupWorkspace(dir) {
  fs.rm(dir, { recursive: true, force: true }, (err) => {
    if (err) console.error(`Failed to clean up workspace ${dir}:`, err.message);
  });
}

module.exports = { createJobWorkspace, cleanupWorkspace };
