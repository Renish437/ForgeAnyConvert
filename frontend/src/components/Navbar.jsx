import React from "react";
import { NavLink } from "react-router-dom";
import { FaBoltLightning, FaFilePdf, FaGithub, FaLayerGroup, FaPalette, FaWaveSquare } from "react-icons/fa6";
import ThemeToggle from "./ThemeToggle";

const PRODUCTS = [
  { to: "/converter", label: "Converter", icon: FaLayerGroup },
  { to: "/pdf-studio", label: "PDF Studio", icon: FaFilePdf },
  { to: "/image-lab", label: "Image Lab", icon: FaPalette },
  { to: "/media", label: "Media Converter", icon: FaWaveSquare },
  { to: "/github", label: "GitHub Grabber", icon: FaGithub },
];

function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center border border-accent/50 bg-accent/10 text-accent">
            <FaBoltLightning className="text-sm" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            Forge<span className="text-accent">.</span>
          </span>
        </NavLink>

        <nav className="flex flex-1 items-center justify-center gap-1 overflow-x-auto">
          {PRODUCTS.map((p) => (
            <NavLink
              key={p.to}
              to={p.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                  isActive ? "bg-raised text-ink" : "text-ink-dim hover:text-ink"
                }`
              }
            >
              <p.icon className="text-xs opacity-80" />
              {p.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export default Navbar;
