import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaFilePdf,
  FaObjectGroup,
  FaCompress,
  FaLock,
  FaStamp,
  FaFileWord,
  FaFileLines,
  FaImage,
  FaArrowRight,
} from "react-icons/fa6";
import Dropzone from "../components/Dropzone";
import OperationOptions from "../components/OperationOptions";
import FilenameOptions from "../components/FilenameOptions";
import ResultBanner from "../components/ResultBanner";
import { usePageTheme } from "../hooks/usePageTheme";
import { useFormats } from "../hooks/useFormats";
import { useConverter } from "../hooks/useConverter";

// Curated, friendlier presentation of the pdf-tools pairs than the raw
// registry list — this page is meant to feel like a dedicated product, not
// another instance of the generic picker.
const TOOL_META = {
  "pdf->docx": { icon: FaFileWord, title: "PDF to Word", blurb: "Turn a PDF back into an editable .docx." },
  "pdf->txt": { icon: FaFileLines, title: "Extract text", blurb: "Pull the plain text out of any PDF." },
  "pdf->jpg": { icon: FaImage, title: "PDF to JPG", blurb: "Every page rendered as a JPG image." },
  "pdf->png": { icon: FaImage, title: "PDF to PNG", blurb: "Every page rendered as a PNG image." },
  merge: { icon: FaObjectGroup, title: "Merge PDFs", blurb: "Combine several PDFs into one, in order." },
  compress: { icon: FaCompress, title: "Compress", blurb: "Shrink the file size, choose your quality." },
  protect: { icon: FaLock, title: "Password protect", blurb: "Lock a PDF so it needs a password to open." },
  watermark: { icon: FaStamp, title: "Watermark", blurb: "Stamp text diagonally across every page." },
};

function toolKey(pair) {
  return pair.operation || `${pair.from}->${pair.to}`;
}

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" } }),
};

function PdfStudio() {
  usePageTheme("pdfstudio");
  const { categories, error: formatsError } = useFormats();
  const pdfCategory = categories.find((c) => c.id === "pdf-tools");
  const pairs = pdfCategory?.pairs || [];

  const {
    selectedPair,
    selectPair,
    files,
    updateFiles,
    optionValues,
    setOptionValues,
    status,
    isBusy,
    progress,
    error,
    result,
    resetOutcome,
    isMultiple,
    accept,
    canConvert,
    handleConvert,
  } = useConverter();

  return (
    <main className="relative overflow-hidden">
      {/* Ambient background glow — part of the "premium SaaS product" feel */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 800px 400px at 50% -10%, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent)",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-4 inline-flex items-center gap-2 border border-accent/30 bg-accent/10 px-3 py-1 font-sans text-xs font-medium text-accent">
            <FaFilePdf /> PDF Studio
          </div>
          <h1 className="max-w-xl font-display text-4xl font-bold leading-tight text-ink sm:text-5xl">
            Everything your PDFs need, in one place.
          </h1>
          <p className="mt-4 max-w-lg font-sans text-base text-ink-dim">
            Convert, merge, compress, lock, or stamp a PDF — pick a tool below to get started.
          </p>
        </motion.div>

        {formatsError && (
          <p className="mt-10 font-sans text-sm text-danger">{formatsError}</p>
        )}

        {/* Tool grid */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pairs.map((pair, i) => {
            const key = toolKey(pair);
            const meta = TOOL_META[key] || { icon: FaFilePdf, title: pair.label || key, blurb: "" };
            const Icon = meta.icon;
            const isActive = selectedPair && toolKey(selectedPair) === key;
            return (
              <motion.button
                key={key}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="show"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => selectPair(pair)}
                className={`group relative overflow-hidden rounded-2xl border p-5 text-left backdrop-blur-sm transition-colors ${
                  isActive
                    ? "border-accent/50 bg-accent/10"
                    : "border-border bg-surface/70 hover:border-accent/30 hover:bg-raised/70"
                }`}
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                    isActive ? "bg-accent text-white" : "bg-raised text-accent"
                  }`}
                >
                  <Icon />
                </div>
                <h3 className="font-display text-base font-semibold text-ink">{meta.title}</h3>
                {meta.blurb && <p className="mt-1 font-sans text-xs text-ink-dim">{meta.blurb}</p>}
              </motion.button>
            );
          })}
        </div>

        {/* Active tool workspace */}
        <AnimatePresence mode="wait">
          {selectedPair && (
            <motion.div
              key={toolKey(selectedPair)}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-8 overflow-hidden"
            >
              <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface/70 p-6 backdrop-blur-sm sm:p-8">
                <Dropzone
                  accept={accept}
                  multiple={isMultiple}
                  files={files}
                  onFilesChange={updateFiles}
                  hint={isMultiple ? "Add 2 or more PDFs, in the order you want them merged" : "Accepts .pdf files"}
                />

                <OperationOptions operation={selectedPair.operation} values={optionValues} onChange={setOptionValues} />

                <FilenameOptions
                  appendUuid={optionValues.appendUuid}
                  onChange={(v) => setOptionValues({ ...optionValues, appendUuid: v })}
                />

                <ResultBanner status={status} progress={progress} error={error} result={result} onReset={resetOutcome} />

                {status !== "success" && (
                  <motion.button
                    whileHover={{ scale: canConvert ? 1.015 : 1 }}
                    whileTap={{ scale: canConvert ? 0.98 : 1 }}
                    onClick={handleConvert}
                    disabled={!canConvert}
                    className="flex w-fit items-center gap-2 rounded-xl bg-accent px-6 py-3 font-sans text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-opacity disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    {isBusy ? "Working\u2026" : "Run it"} <FaArrowRight className="text-xs" />
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export default PdfStudio;
