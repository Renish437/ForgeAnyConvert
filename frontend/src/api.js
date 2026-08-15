import axios from "axios";

// Vite exposes env vars prefixed with VITE_ on import.meta.env. Falls back to
// localhost:3000 for local dev, matching the Backend's default port.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const client = axios.create({ baseURL: API_BASE });

/** Fetch the full conversion matrix the backend actually supports. */
export async function fetchFormats() {
  const { data } = await client.get("/api/formats");
  return data.categories;
}

/**
 * Run a conversion (or special operation) — either against uploaded files,
 * or, for link-based tools (the GitHub file/repo grabber), against a
 * pasted URL with an empty file list.
 * @param {File[]} files
 * @param {{ to?: string, operation?: string, url?: string, password?: string, watermarkText?: string, quality?: string, imageFormat?: string, level?: string, mode?: string, customQuality?: string|number, maxWidth?: string|number, maxHeight?: string|number, allowEnlarge?: boolean, appendUuid?: boolean }} options
 * @param {(percent: number) => void} onProgress
 * @returns {Promise<{ blob: Blob, filename: string, originalSize?: number, resultSize?: number }>}
 */
export async function convertFiles(files, options, onProgress) {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  if (options.to) form.append("to", options.to);
  if (options.operation) form.append("operation", options.operation);
  if (options.url) form.append("url", options.url);
  if (options.password) form.append("password", options.password);
  if (options.watermarkText) form.append("watermarkText", options.watermarkText);
  if (options.quality) form.append("quality", options.quality);
  if (options.imageFormat) form.append("imageFormat", options.imageFormat);
  if (options.level) form.append("level", options.level);
  if (options.mode) form.append("mode", options.mode);
  if (options.customQuality) form.append("customQuality", options.customQuality);
  if (options.maxWidth) form.append("maxWidth", options.maxWidth);
  if (options.maxHeight) form.append("maxHeight", options.maxHeight);
  if (options.allowEnlarge) form.append("allowEnlarge", "true");
  if (options.appendUuid) form.append("appendUuid", "true");

  try {
    const response = await client.post("/api/convert", form, {
      responseType: "blob",
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
      },
    });

    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="(.+?)"/);
    const filename = match ? match[1] : "converted-file";
    const originalSize = response.headers["x-original-size"]
      ? Number(response.headers["x-original-size"])
      : null;
    const resultSize = response.headers["x-result-size"] ? Number(response.headers["x-result-size"]) : null;

    return { blob: response.data, filename, originalSize, resultSize };
  } catch (error) {
    // The backend always responds with JSON errors, but axios receives them
    // as a Blob here because responseType is "blob" — decode it back to text.
    if (error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        const parsed = JSON.parse(text);
        // New structured format: { success: false, error: { code, message } }.
        const message = parsed.error?.message || parsed.message || "Conversion failed.";
        const err = new Error(message);
        err.code = parsed.error?.code;
        throw err;
      } catch (parseErr) {
        if (parseErr instanceof SyntaxError) throw new Error("Conversion failed.");
        throw parseErr;
      }
    }
    throw new Error(error.message || "Conversion failed.");
  }
}
