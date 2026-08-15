import React from "react";

/**
 * `accent="secondary"` uses each theme's secondary color (accent2) for the
 * checkbox instead of the primary one — a small touch of variety on pages
 * that already use the primary accent heavily elsewhere on the same form.
 */
export default function FilenameOptions({ appendUuid, onChange, accent = "primary" }) {
  const accentColorClass = accent === "secondary" ? "accent-accent2" : "accent-accent";
  return (
    <label className="flex items-start gap-2.5 font-sans text-xs text-ink-dim">
      <input
        type="checkbox"
        checked={!!appendUuid}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 ${accentColorClass}`}
      />
      <span>
        Keep the original filename (default). Optionally add a unique ID to the end, e.g.{" "}
        <span className="font-mono text-[11px]">report-a1b2c3d4.pdf</span> &mdash; useful if you're converting
        the same file more than once.
      </span>
    </label>
  );
}
