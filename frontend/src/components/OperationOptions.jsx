import React from "react";

const inputClass =
  "w-full border border-border-soft bg-raised px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-accent";

export default function OperationOptions({ operation, values, onChange }) {
  if (!operation) return null;

  const set = (key) => (e) => onChange({ ...values, [key]: e.target.value });
  const setChecked = (key) => (e) => onChange({ ...values, [key]: e.target.checked });

  if (operation === "protect") {
    return (
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">
          Password to open the file
        </label>
        <input
          type="text"
          value={values.password || ""}
          onChange={set("password")}
          placeholder="Enter a password"
          className={inputClass}
        />
      </div>
    );
  }

  if (operation === "watermark") {
    return (
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">Watermark text</label>
        <input
          type="text"
          value={values.watermarkText || ""}
          onChange={set("watermarkText")}
          placeholder="e.g. CONFIDENTIAL"
          className={inputClass}
        />
      </div>
    );
  }

  if (operation === "compress") {
    return (
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">Compression level</label>
        <select value={values.quality || "ebook"} onChange={set("quality")} className={inputClass}>
          <option value="screen">Smallest file (screen quality)</option>
          <option value="ebook">Balanced (recommended)</option>
          <option value="printer">Higher quality (printer)</option>
        </select>
      </div>
    );
  }

  if (operation === "pptx-images") {
    return (
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">Image format</label>
        <select value={values.imageFormat || "png"} onChange={set("imageFormat")} className={inputClass}>
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
        </select>
      </div>
    );
  }

  if (operation === "reduce-video") {
    return (
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">Compression level</label>
        <select value={values.level || "medium"} onChange={set("level")} className={inputClass}>
          <option value="high">Light &middot; best quality</option>
          <option value="medium">Balanced (recommended)</option>
          <option value="low">Maximum &middot; smallest file</option>
        </select>
      </div>
    );
  }

  if (operation === "reduce-image") {
    const mode = values.mode || "shrink";
    return (
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">What do you want to do?</label>
          <div className="flex gap-2">
            {[
              { value: "shrink", label: "Shrink (reduce file size)" },
              { value: "enlarge", label: "Enlarge (increase dimensions)" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...values, mode: opt.value })}
                className={`flex-1 border px-3 py-2 text-left font-sans text-xs font-medium transition-colors ${
                  mode === opt.value
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-border-soft text-ink-dim hover:border-border"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "shrink" && (
          <div>
            <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">Preset</label>
            <select value={values.level || "medium"} onChange={set("level")} className={inputClass}>
              <option value="high">Light &middot; best quality</option>
              <option value="medium">Balanced (recommended)</option>
              <option value="low">Maximum &middot; smallest file</option>
            </select>
          </div>
        )}

        <details className="group">
          <summary className="cursor-pointer select-none font-sans text-xs font-medium text-ink-faint hover:text-ink-dim">
            Custom quality &amp; dimensions (optional)
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">
                Quality override: {values.customQuality || "preset default"}
                {values.customQuality ? "%" : ""}
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={values.customQuality || ""}
                onChange={set("customQuality")}
                className="w-full accent-accent"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">Max width (px)</label>
                <input
                  type="number"
                  min="1"
                  value={values.maxWidth || ""}
                  onChange={set("maxWidth")}
                  placeholder="auto"
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block font-sans text-xs font-medium text-ink-dim">Max height (px)</label>
                <input
                  type="number"
                  min="1"
                  value={values.maxHeight || ""}
                  onChange={set("maxHeight")}
                  placeholder="auto"
                  className={inputClass}
                />
              </div>
            </div>
            {mode === "shrink" && (
              <label className="flex items-center gap-2 font-sans text-xs text-ink-dim">
                <input
                  type="checkbox"
                  checked={!!values.allowEnlarge}
                  onChange={setChecked("allowEnlarge")}
                  className="accent-accent"
                />
                Allow upscaling if the dimensions above are bigger than the original
              </label>
            )}
          </div>
        </details>
      </div>
    );
  }

  return null;
}
