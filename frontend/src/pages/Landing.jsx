import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaLayerGroup,
  FaFilePdf,
  FaGithub,
  FaArrowRight,
  FaShieldHalved,
  FaBolt,
  FaPalette,
  FaWaveSquare,
} from "react-icons/fa6";
import { usePageTheme } from "../hooks/usePageTheme";

const PRODUCTS = [
  {
    to: "/converter",
    icon: FaLayerGroup,
    title: "Universal Converter",
    blurb: "Documents, images, audio, video, spreadsheets, presentations, e-books — 40+ conversions in one workbench.",
    cta: "Open the workbench",
  },
  {
    to: "/pdf-studio",
    icon: FaFilePdf,
    title: "PDF Studio",
    blurb: "Merge, compress, password-protect, watermark, or convert a PDF, in a dedicated space built for it.",
    cta: "Open PDF Studio",
  },
  {
    to: "/image-lab",
    icon: FaPalette,
    title: "Image Lab",
    blurb: "Convert between image formats, or shrink and enlarge — with real quality and dimension controls.",
    cta: "Open Image Lab",
  },
  {
    to: "/media",
    icon: FaWaveSquare,
    title: "Media Converter",
    blurb: "Re-encode audio and video between the formats every player and editor actually supports.",
    cta: "Open Media Converter",
  },
  {
    to: "/github",
    icon: FaGithub,
    title: "GitHub Grabber",
    blurb: "Paste a link to one file, a folder, or a whole repo — get back exactly that, zipped if needed.",
    cta: "Open GitHub Grabber",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" } }),
};

function Landing() {
  usePageTheme("workshop");

  return (
    <main>
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="font-mono text-xs uppercase tracking-widest text-accent"
        >
          Forge
        </motion.p>
        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mx-auto mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight text-ink sm:text-6xl"
        >
          Three tools. Zero uploads left behind.
        </motion.h1>
        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mx-auto mt-5 max-w-xl font-sans text-base text-ink-dim"
        >
          A universal file converter, a dedicated PDF toolkit, and a GitHub file grabber. Pick one below —
          every file you send in is deleted the moment your download finishes.
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-8 flex flex-wrap items-center justify-center gap-6 font-mono text-xs text-ink-faint"
        >
          <span className="flex items-center gap-1.5">
            <FaShieldHalved className="text-accent" /> Nothing stored
          </span>
          <span className="flex items-center gap-1.5">
            <FaBolt className="text-accent" /> Runs locally on your server
          </span>
        </motion.div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PRODUCTS.map((p, i) => (
            <motion.div
              key={p.to}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
            >
              <Link
                to={p.to}
                className="bracket-frame group flex h-full flex-col border border-border-soft bg-surface p-6 text-accent transition-colors hover:border-accent/40"
              >
                <span className="bracket-tl" />
                <span className="bracket-br" />
                <div className="mb-4 flex h-10 w-10 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
                  <p.icon />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink">{p.title}</h3>
                <p className="mt-2 flex-1 font-sans text-sm text-ink-dim">{p.blurb}</p>
                <span className="mt-5 flex items-center gap-1.5 font-sans text-sm font-medium text-accent">
                  {p.cta}{" "}
                  <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Landing;
