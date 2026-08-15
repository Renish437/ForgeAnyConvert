/**
 * A structured error every converter/route can throw. Carries a stable
 * `code` (for programmatic handling / consistent categorization) alongside
 * a human-readable `message` (safe to show directly to the end user — never
 * a stack trace or raw tool output).
 */
class AppError extends Error {
  constructor(code, message, { status = 400, cause } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

// Central place for every code this app can emit, so route handlers and
// converters agree on the same vocabulary instead of inventing ad hoc
// strings inline.
const ErrorCodes = {
  INVALID_INPUT: "INVALID_INPUT",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",

  GITHUB_INVALID_URL: "GITHUB_INVALID_URL",
  GITHUB_NOT_FOUND_OR_PRIVATE: "GITHUB_NOT_FOUND_OR_PRIVATE",
  GITHUB_RATE_LIMIT: "GITHUB_RATE_LIMIT",
  GITHUB_AUTH_REQUIRED: "GITHUB_AUTH_REQUIRED",
  GITHUB_BRANCH_NOT_FOUND: "GITHUB_BRANCH_NOT_FOUND",
  GITHUB_NETWORK_ERROR: "GITHUB_NETWORK_ERROR",
  GITHUB_EMPTY_FOLDER: "GITHUB_EMPTY_FOLDER",

  PDF_PARSE_FAILED: "PDF_PARSE_FAILED",
  PDF_PASSWORD_REQUIRED: "PDF_PASSWORD_REQUIRED",
  PDF_ENCRYPTION_FAILED: "PDF_ENCRYPTION_FAILED",
  PDF_OCR_REQUIRED: "PDF_OCR_REQUIRED",

  COMPRESSION_FAILED: "COMPRESSION_FAILED",
  EBOOK_CONVERSION_FAILED: "EBOOK_CONVERSION_FAILED",
  ENCODING_ERROR: "ENCODING_ERROR",
  OUTPUT_VALIDATION_FAILED: "OUTPUT_VALIDATION_FAILED",
  DEPENDENCY_NOT_INSTALLED: "DEPENDENCY_NOT_INSTALLED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

// Node's built-in system error codes — if one of these ever bubbles up
// uncaught, its raw message often contains an absolute filesystem path,
// which is an internal implementation detail and shouldn't reach the client.
const NODE_SYSTEM_ERROR_CODES = new Set([
  "ENOENT", "EACCES", "EPERM", "ENOSPC", "EMFILE", "ENFILE", "ENOMEM",
  "ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "EISDIR", "ENOTDIR",
]);

const GENERIC_MESSAGE = "Something went wrong while converting your file. Please try again.";

/**
 * Normalizes any thrown value into a safe `{ code, message, status }` for
 * the HTTP response: AppErrors pass through as-is (they're already
 * crafted to be safe and specific); anything that looks like a raw system
 * or library error — Node system error codes, or a message that leaks an
 * absolute filesystem path — is replaced with a generic message so
 * internals never reach the client. The original error is always logged
 * in full server-side by the caller before this is used.
 */
function toClientError(err) {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, status: err.status };
  }

  if (err && NODE_SYSTEM_ERROR_CODES.has(err.code)) {
    return { code: ErrorCodes.INTERNAL_ERROR, message: GENERIC_MESSAGE, status: 500 };
  }

  const message = err && typeof err.message === "string" ? err.message : "";
  const looksLikeLeakedPath = /\/(home|usr|var|tmp|root|etc)\//.test(message) || /[A-Za-z]:\\/.test(message);
  if (!message || looksLikeLeakedPath) {
    return { code: ErrorCodes.INTERNAL_ERROR, message: GENERIC_MESSAGE, status: 500 };
  }

  // A plain Error with a hand-written, non-leaking message — our own
  // converter code throws these deliberately as user-facing descriptions.
  return { code: ErrorCodes.INTERNAL_ERROR, message, status: 500 };
}

module.exports = { AppError, ErrorCodes, toClientError };
