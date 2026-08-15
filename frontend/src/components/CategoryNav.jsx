import React from "react";
import { CATEGORY_META } from "../data/categoryMeta";

function NewBadge() {
  return (
    <span className="rounded-full border border-accent2/40 bg-accent2/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-accent2">
      New
    </span>
  );
}

function CategoryButton({ category, isActive, onClick, className = "" }) {
  const meta = CATEGORY_META[category.id];
  const Icon = meta?.icon;
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 whitespace-nowrap border-l-2 px-4 py-2.5 text-left transition-colors ${
        isActive
          ? "border-accent bg-raised text-ink"
          : "border-transparent text-ink-dim hover:border-border hover:bg-surface hover:text-ink"
      } ${className}`}
    >
      {Icon && (
        <Icon
          className={`shrink-0 text-base ${isActive ? "text-accent" : "text-ink-faint group-hover:text-ink-dim"}`}
        />
      )}
      <span className="font-sans text-sm font-medium">{category.label}</span>
      {meta?.isNew && <NewBadge />}
      <span className="ml-auto font-mono text-[11px] text-ink-faint">{category.pairs.length}</span>
    </button>
  );
}

export default function CategoryNav({ categories, activeId, onSelect }) {
  return (
    <>
      {/* Desktop: vertical rail */}
      <nav className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-border-soft md:py-6 md:pr-2">
        {categories.map((cat) => (
          <CategoryButton
            key={cat.id}
            category={cat}
            isActive={cat.id === activeId}
            onClick={() => onSelect(cat.id)}
          />
        ))}
      </nav>

      {/* Mobile: horizontal scroll tabs */}
      <nav className="flex gap-1 overflow-x-auto border-b border-border-soft px-1 py-2 md:hidden">
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat.id];
          const Icon = meta?.icon;
          const isActive = cat.id === activeId;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`flex shrink-0 items-center gap-2 border px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-accent/50 bg-raised text-ink shadow-glow-sm"
                  : "border-border-soft text-ink-dim"
              }`}
            >
              {Icon && <Icon className={isActive ? "text-accent" : "text-ink-faint"} />}
              {cat.label}
              {meta?.isNew && <NewBadge />}
            </button>
          );
        })}
      </nav>
    </>
  );
}
