import React from "react";
import { FaArrowRightLong } from "react-icons/fa6";

function pairKey(pair) {
  return pair.operation ? `${pair.operation}:${pair.from}->${pair.to}` : `${pair.from}->${pair.to}`;
}

export default function ConversionPicker({ pairs, selected, onSelect }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {pairs.map((pair) => {
        const key = pairKey(pair);
        const isActive = selected && pairKey(selected) === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(pair)}
            className={`bracket-frame flex items-center justify-between gap-2 border px-4 py-3 text-left transition-all ${
              isActive
                ? "border-accent/60 bg-raised text-accent shadow-glow-sm"
                : "border-border-soft bg-surface text-ink-dim hover:border-border hover:text-ink"
            }`}
          >
            {isActive && (
              <>
                <span className="bracket-tl" />
                <span className="bracket-br" />
              </>
            )}
            {pair.label ? (
              <span className="font-mono text-xs leading-snug">{pair.label}</span>
            ) : (
              <span className="flex items-center gap-2 font-mono text-xs">
                <span className="uppercase">{pair.from}</span>
                <FaArrowRightLong className="shrink-0 text-[10px] opacity-70" />
                <span className="uppercase">{pair.to}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { pairKey };
