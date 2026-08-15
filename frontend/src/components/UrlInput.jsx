import React from "react";
import { FaLink } from "react-icons/fa6";

export default function UrlInput({ value, onChange, placeholder, hint }) {
  return (
    <div>
      <div className="bracket-frame flex items-center gap-3 border-2 border-dashed border-border bg-surface/60 px-5 py-7 text-line transition-colors focus-within:border-accent focus-within:text-accent">
        <span className="bracket-tl" />
        <span className="bracket-br" />
        <FaLink className="shrink-0 text-lg text-ink-faint" />
        <input
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          className="w-full bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>
      {hint && <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}
