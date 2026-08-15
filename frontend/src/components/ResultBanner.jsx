import React from "react";
import { FaDownload, FaTriangleExclamation, FaCircleCheck, FaArrowRotateLeft } from "react-icons/fa6";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Formats a duration in milliseconds the way a person would say it out loud
// ("3.2s", "1m 05s") — used on the success banner and nowhere else, since
// that's the only place we know the *real*, finished elapsed time.
function formatDuration(ms) {
  if (!ms || ms < 0) return null;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 10) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

const PHASE_LABELS = {
  uploading: "Uploading\u2026",
  processing: "Processing\u2026",
  finalizing: "Finalizing\u2026",
};

// After this many seconds in a busy phase, we add a reassuring note so a
// slow conversion (a big video, a large PDF) doesn't read as "stuck."
const LONG_WAIT_THRESHOLD_SECONDS = 8;

export default function ResultBanner({ status, progress, error, result, indeterminate, onReset }) {
  const isBusyPhase = status === "uploading" || status === "processing" || status === "finalizing";
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!isBusyPhase) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isBusyPhase]);

  if (isBusyPhase) {
    // Only the "uploading" phase has a real, measured percentage (the
    // browser's own upload progress). "Processing" and "finalizing" show
    // an indeterminate sweep instead of a fake number — this backend
    // doesn't stream true completion percentage back over this endpoint,
    // and a progress bar that lies about how far along it is would be
    // worse than one that honestly says "still working."
    const showRealPercent = status === "uploading" && !indeterminate;
    const baseLabel = indeterminate && status !== "finalizing" ? "Fetching & converting\u2026" : PHASE_LABELS[status];
    const timeLabel = elapsed > 0 ? ` (${elapsed}s)` : "";
    const isTakingAWhile = elapsed >= LONG_WAIT_THRESHOLD_SECONDS;
    return (
      <div className="border border-border-soft bg-surface px-5 py-4">
        <div className="mb-2 flex items-center justify-between font-mono text-xs text-ink-dim">
          <span>{baseLabel}{timeLabel}</span>
          {showRealPercent && <span>{progress}%</span>}
        </div>
        <div className="relative h-1.5 w-full overflow-hidden bg-raised">
          {showRealPercent ? (
            <div
              className="h-full animate-pulse-glow bg-accent transition-all duration-200"
              style={{ width: `${Math.max(progress, 6)}%` }}
            />
          ) : (
            <div className="absolute inset-y-0 w-1/3 animate-loading-sweep bg-accent" />
          )}
        </div>
        {isTakingAWhile && (
          <p className="mt-2 font-sans text-xs text-ink-faint">
            Large or complex files can take a little longer to process &mdash; this is still working, feel free to
            keep this tab open.
          </p>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-start gap-3 border border-danger/40 bg-danger/10 px-5 py-4 animate-rise">
        <FaTriangleExclamation className="mt-0.5 shrink-0 text-danger" />
        <div className="flex-1">
          <p className="font-sans text-sm font-medium text-ink">Conversion failed</p>
          <p className="mt-0.5 font-mono text-xs leading-relaxed text-ink-dim">{error}</p>
        </div>
        <button
          onClick={onReset}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-sans text-xs font-medium text-ink-dim transition-colors hover:text-ink"
        >
          <FaArrowRotateLeft /> Try again
        </button>
      </div>
    );
  }

  if (status === "success" && result) {
    const { originalSize, resultSize, durationMs } = result;
    const showSavings = originalSize && resultSize && originalSize > resultSize;
    const savingsPct = showSavings ? Math.round((1 - resultSize / originalSize) * 100) : null;
    const durationLabel = formatDuration(durationMs);

    return (
      <div className="flex flex-col gap-3 border border-accent2/40 bg-accent2/5 px-5 py-4 animate-rise sm:flex-row sm:items-center sm:gap-4">
        <FaCircleCheck className="hidden shrink-0 text-xl text-accent2 sm:block" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FaCircleCheck className="shrink-0 text-base text-accent2 sm:hidden" />
            <p className="font-sans text-sm font-medium text-ink">
              Your file is ready{durationLabel ? <span className="text-ink-faint"> &middot; done in {durationLabel}</span> : ""}
            </p>
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-ink-dim">{result.filename}</p>
          {(resultSize || showSavings) && (
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              {showSavings ? (
                <>
                  {formatBytes(originalSize)} <span className="text-accent2">&rarr;</span> {formatBytes(resultSize)}{" "}
                  <span className="text-accent2">&middot; {savingsPct}% smaller</span>
                </>
              ) : (
                resultSize && formatBytes(resultSize)
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <a
            href={result.url}
            download={result.filename}
            className="flex shrink-0 items-center gap-2 border border-accent2/50 bg-accent2/10 px-4 py-2 font-sans text-sm font-medium text-accent2 transition-colors hover:bg-accent2/20"
          >
            <FaDownload /> Download
          </a>
          <button
            onClick={onReset}
            className="shrink-0 font-sans text-xs font-medium text-ink-faint transition-colors hover:text-ink-dim"
          >
            Convert another
          </button>
        </div>
      </div>
    );
  }

  return null;
}
