const fs = require("fs");
const path = require("path");
const https = require("https");
const archiver = require("archiver");
const { AppError, ErrorCodes } = require("../utils/errors");

// A "blob" URL points at one specific file, e.g.
// https://github.com/owner/repo/blob/master/backend/backend/settings.py
const BLOB_PATTERN = /github\.com\/([^/\s]+)\/([^/\s]+)\/blob\/([^/\s]+)\/(.+?)(?:[?#].*)?$/i;
// A "tree" URL points at a branch, optionally followed by a subfolder path
// within it, e.g. .../tree/master or .../tree/master/backend/media/image
const TREE_PATTERN = /github\.com\/([^/\s]+)\/([^/\s]+)\/tree\/([^/\s?#]+)(?:\/([^?#]*))?/i;
const REPO_PATTERN = /github\.com\/([^/\s]+)\/([^/\s]+)/i;

/**
 * Pulls a clean URL out of whatever was pasted in. Handles two messy but
 * common cases: a markdown-formatted link `[text](url)` — where the
 * visible text and the actual target are different URLs, and naively
 * matching would grab the wrong one or splice both together — and plain
 * text containing more than one URL-like substring, where the most
 * specific (longest) one is almost always the intended target.
 */
function extractCandidateUrl(input) {
  const trimmed = (input || "").trim();

  const markdownLink = trimmed.match(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/);
  if (markdownLink) return markdownLink[2];

  const urlMatches = trimmed.match(/https?:\/\/[^\s\]\)<>"']+/g);
  if (urlMatches && urlMatches.length > 0) {
    return urlMatches.reduce((best, candidate) => (candidate.length > best.length ? candidate : best));
  }

  return trimmed;
}

/**
 * Figures out whether a pasted link points at a single file, a subfolder,
 * or a whole repository, and pulls out owner/repo/branch/path accordingly.
 * Accepts full GitHub URLs, markdown-formatted links, or the "owner/repo"
 * shorthand.
 */
function parseGithubUrl(input) {
  const trimmed = extractCandidateUrl(input);

  const blobMatch = trimmed.match(BLOB_PATTERN);
  if (blobMatch) {
    const [, owner, repo, branch, filePath] = blobMatch;
    return {
      type: "file",
      owner,
      repo: repo.replace(/\.git$/i, ""),
      branch: decodeURIComponent(branch),
      filePath: decodeURIComponent(filePath),
    };
  }

  const treeMatch = trimmed.match(TREE_PATTERN);
  if (treeMatch) {
    const [, owner, repo, branch, subPath] = treeMatch;
    const cleanSubPath = subPath ? decodeURIComponent(subPath.replace(/\/+$/, "")) : "";
    const base = { owner, repo: repo.replace(/\.git$/i, ""), branch: decodeURIComponent(branch) };
    return cleanSubPath ? { type: "dir", ...base, dirPath: cleanSubPath } : { type: "repo", ...base };
  }

  const repoMatch = trimmed.match(REPO_PATTERN) || trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!repoMatch) {
    throw new AppError(
      ErrorCodes.GITHUB_INVALID_URL,
      "That doesn't look like a GitHub link. Paste a repo URL (github.com/owner/repo), a folder URL " +
        "(.../tree/branch/path/to/folder), or a file URL (.../blob/branch/path/to/file)."
    );
  }
  return { type: "repo", owner: repoMatch[1], repo: repoMatch[2].replace(/\.git$/i, ""), branch: null };
}

function githubHeaders(extra = {}) {
  const headers = { "User-Agent": "ForgeAnyConvert", ...extra };
  // Unauthenticated requests to the GitHub API are capped at 60/hour per IP,
  // which a shared server can burn through fast. Set GITHUB_TOKEN (a plain
  // personal access token, no special scopes needed for public repos) to
  // raise that to 5,000/hour.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

/**
 * Turns a GitHub HTTP response (status code + optional parsed JSON body)
 * into the right AppError. GitHub deliberately returns 404 for both
 * "doesn't exist" and "exists but you can't see it" (private repos) to
 * avoid leaking which private repos exist — so honestly, this code can't
 * fully tell those apart without a token that has access. The message
 * says so plainly instead of pretending to a certainty it doesn't have.
 */
function classifyGithubResponseError(statusCode, body, context) {
  const bodyMessage = (body && typeof body === "object" && body.message) || "";
  const lower = bodyMessage.toLowerCase();

  if (statusCode === 403 && lower.includes("rate limit")) {
    return new AppError(
      ErrorCodes.GITHUB_RATE_LIMIT,
      process.env.GITHUB_TOKEN
        ? "GitHub's API rate limit was hit even with a token configured. Wait a few minutes and try again."
        : "GitHub's rate limit for unauthenticated requests was hit (60/hour, shared by everyone using this " +
          "server). Set a GITHUB_TOKEN on the server to raise this to 5,000/hour, or try again later.",
      { status: 429 }
    );
  }

  if (statusCode === 401 || (statusCode === 403 && (lower.includes("must be authenticated") || lower.includes("bad credentials")))) {
    return new AppError(
      ErrorCodes.GITHUB_AUTH_REQUIRED,
      "GitHub rejected the configured GITHUB_TOKEN (missing, expired, or invalid). Check the server's " +
        "GITHUB_TOKEN environment variable.",
      { status: 401 }
    );
  }

  if (statusCode === 404) {
    const branchNote = context?.branch ? ` on branch "${context.branch}"` : "";
    return new AppError(
      ErrorCodes.GITHUB_NOT_FOUND_OR_PRIVATE,
      `Couldn't find that${branchNote} on GitHub. Either it doesn't exist, the branch name is wrong, or ` +
        "the repository is private. This GitHub repository or folder may be private — please provide a " +
        "public repository URL, or configure GITHUB_TOKEN with access to it.",
      { status: 404 }
    );
  }

  if (statusCode === 422) {
    return new AppError(
      ErrorCodes.GITHUB_BRANCH_NOT_FOUND,
      `"${context?.branch || "That branch"}" doesn't seem to exist in this repository. Double-check the branch name.`,
      { status: 404 }
    );
  }

  return new AppError(
    ErrorCodes.GITHUB_NETWORK_ERROR,
    `GitHub responded with an unexpected status (${statusCode}). Please try again in a moment.`,
    { status: 502 }
  );
}

function wrapNetworkError(err) {
  return new AppError(
    ErrorCodes.GITHUB_NETWORK_ERROR,
    "Couldn't reach GitHub — check the server's network connection and try again.",
    { status: 502, cause: err }
  );
}

function httpGet(url, redirectsLeft = 5) {
  return new Promise((resolvePromise, reject) => {
    https
      .get(url, { headers: githubHeaders() }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          return httpGet(res.headers.location, redirectsLeft - 1).then(resolvePromise, reject);
        }
        resolvePromise(res);
      })
      .on("error", (err) => reject(wrapNetworkError(err)));
  });
}

async function getJson(url, context) {
  const res = await httpGet(url);
  return new Promise((resolvePromise, reject) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      let parsed = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        /* not JSON — fall through to status-code-only classification below */
      }
      if (res.statusCode !== 200) {
        return reject(classifyGithubResponseError(res.statusCode, parsed, context));
      }
      if (!parsed) {
        return reject(
          new AppError(ErrorCodes.GITHUB_NETWORK_ERROR, "Couldn't read the response from GitHub's API.", {
            status: 502,
          })
        );
      }
      resolvePromise(parsed);
    });
    res.on("error", (err) => reject(wrapNetworkError(err)));
  });
}

async function downloadToFile(url, destPath, context) {
  const res = await httpGet(url);
  return new Promise((resolvePromise, reject) => {
    if (res.statusCode !== 200) {
      res.resume();
      return reject(classifyGithubResponseError(res.statusCode, null, context));
    }
    const file = fs.createWriteStream(destPath);
    res.pipe(file);
    file.on("finish", () => file.close(() => resolvePromise(destPath)));
    file.on("error", (err) => reject(wrapNetworkError(err)));
    res.on("error", (err) => reject(wrapNetworkError(err)));
  });
}

/** Runs async tasks with at most `limit` running at once. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runNext() {
    const i = nextIndex++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    return runNext();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

/** Single-file link -> fetch just that file from raw.githubusercontent.com. */
async function downloadSingleFile({ owner, repo, branch, filePath }, outDir) {
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`;
  const originalName = path.basename(filePath);
  const outputPath = path.join(outDir, originalName);
  await downloadToFile(rawUrl, outputPath, { branch });

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new AppError(
      ErrorCodes.OUTPUT_VALIDATION_FAILED,
      "GitHub returned an empty response for that file. It may have been removed, or the path may be wrong."
    );
  }
  return outputPath;
}

/**
 * Subfolder link -> list every file under that path via the Git Trees API
 * (one API call, regardless of folder size), fetch each one from
 * raw.githubusercontent.com (which doesn't count against the API rate
 * limit), and zip them back up preserving the folder's internal structure.
 */
async function downloadDirectory({ owner, repo, branch, dirPath }, outDir) {
  const normalizedDir = dirPath.replace(/\/+$/, "");
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const treeData = await getJson(treeUrl, { branch });

  const prefix = `${normalizedDir}/`;
  const matches = (treeData.tree || []).filter(
    (entry) => entry.type === "blob" && (entry.path === normalizedDir || entry.path.startsWith(prefix))
  );

  if (matches.length === 0) {
    throw new AppError(
      ErrorCodes.GITHUB_EMPTY_FOLDER,
      `No files found under "${normalizedDir}" on branch "${branch}". Double-check the folder path and ` +
        "branch name — it may also be a private repository."
    );
  }

  if (treeData.truncated) {
    console.warn(
      `GitHub's tree listing for ${owner}/${repo}@${branch} was truncated (repo too large for one API ` +
        "response) — some deeply nested files under the requested folder may be missing from the result."
    );
  }

  const folderName = path.basename(normalizedDir) || repo;
  const workDir = path.join(outDir, folderName);
  fs.mkdirSync(workDir, { recursive: true });

  const zipEntries = await mapWithConcurrency(matches, 6, async (entry) => {
    const relativePath = entry.path === normalizedDir ? path.basename(entry.path) : entry.path.slice(prefix.length);
    const localPath = path.join(workDir, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(localPath), { recursive: true });

    const encodedGithubPath = entry.path.split("/").map(encodeURIComponent).join("/");
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedGithubPath}`;
    await downloadToFile(rawUrl, localPath, { branch });
    return { localPath, name: `${folderName}/${relativePath}` };
  });

  const zipPath = path.join(outDir, `${folderName}.zip`);
  await new Promise((resolvePromise, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolvePromise);
    archive.on("error", (err) => reject(wrapNetworkError(err)));
    archive.pipe(output);
    for (const entry of zipEntries) archive.file(entry.localPath, { name: entry.name });
    archive.finalize();
  });

  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "Failed to build a valid ZIP for that folder.");
  }
  return zipPath;
}

/** Whole-repo (or whole-branch) link -> fetch the full source zip via codeload. */
async function downloadRepoZip({ owner, repo, branch }, outDir) {
  let resolvedBranch = branch;
  if (!resolvedBranch) {
    const meta = await getJson(`https://api.github.com/repos/${owner}/${repo}`, {});
    resolvedBranch = meta.default_branch || "main";
  }
  const safeBranch = resolvedBranch.replace(/[^\w.-]/g, "-");
  const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(resolvedBranch)}`;
  const outputPath = path.join(outDir, `${repo}-${safeBranch}.zip`);
  await downloadToFile(zipUrl, outputPath, { branch: resolvedBranch });

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new AppError(ErrorCodes.OUTPUT_VALIDATION_FAILED, "GitHub returned an empty archive for that repository.");
  }
  return outputPath;
}

/**
 * Single entry point: pass any GitHub link and get back the right thing —
 * just the one file for a file link, a zip of just that subfolder for a
 * folder link, or a zip of the whole repo/branch otherwise.
 */
async function downloadGithubContent(url, outDir) {
  const parsed = parseGithubUrl(url);
  if (parsed.type === "file") return downloadSingleFile(parsed, outDir);
  if (parsed.type === "dir") return downloadDirectory(parsed, outDir);
  return downloadRepoZip(parsed, outDir);
}

module.exports = { downloadGithubContent, parseGithubUrl };
