import React, { useCallback, useRef, useState } from "react";
import { FaBoltLightning, FaXmark } from "react-icons/fa6";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Dropzone({ accept, multiple, files, onFilesChange, hint }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    (incoming) => {
      const list = Array.from(incoming);
      onFilesChange(multiple ? [...files, ...list] : list.slice(0, 1));
    },
    [files, multiple, onFilesChange]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div
        className={`bracket-frame flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging ? "border-accent bg-accent/5 text-accent" : "border-border text-ink-dim hover:border-border hover:bg-surface"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <span className="bracket-tl text-line" />
        <span className="bracket-br text-line" />
        <FaBoltLightning className={`text-2xl ${isDragging ? "text-accent" : "text-ink-faint"}`} />
        <div>
          <p className="font-sans text-sm font-medium text-ink">
            Drop {multiple ? "files" : "a file"} here, or{" "}
            <span className="text-accent underline underline-offset-2">browse</span>
          </p>
          {hint && <p className="mt-1 font-mono text-[11px] text-ink-faint">{hint}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between border border-border-soft bg-surface px-3 py-2"
            >
              <span className="truncate font-mono text-xs text-ink">{file.name}</span>
              <span className="ml-3 flex shrink-0 items-center gap-3">
                <span className="font-mono text-[11px] text-ink-faint">{formatBytes(file.size)}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-ink-faint transition-colors hover:text-danger"
                  aria-label={`Remove ${file.name}`}
                >
                  <FaXmark />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
