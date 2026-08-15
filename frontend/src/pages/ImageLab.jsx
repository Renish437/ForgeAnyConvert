import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPalette, FaArrowRightLong, FaWandMagicSparkles } from "react-icons/fa6";
import Dropzone from "../components/Dropzone";
import OperationOptions from "../components/OperationOptions";
import FilenameOptions from "../components/FilenameOptions";
import ResultBanner from "../components/ResultBanner";
import { usePageTheme } from "../hooks/usePageTheme";
import { useFormats } from "../hooks/useFormats";
import { useConverter } from "../hooks/useConverter";

function pairKey(pair) {
  return pair.operation ? `${pair.operation}:${pair.from}->${pair.to}` : `${pair.from}->${pair.to}`;
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 10 },
  show: (i) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, type: "spring", stiffness: 260, damping: 20 },
  }),
};

function ImageLab() {
  usePageTheme("imagelab");
  const { categories, error: formatsError } = useFormats();

  const imagesCategory = categories.find((c) => c.id === "images");
  const compressCategory = categories.find((c) => c.id === "compress");
  const resizePair = compressCategory?.pairs.find((p) => p.operation === "reduce-image");
  const pairs = [...(imagesCategory?.pairs || []), ...(resizePair ? [resizePair] : [])];

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
    accept,
    canConvert,
    handleConvert,
  } = useConverter();

  return (
    <main className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 700px 380px at 20% -5%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent), radial-gradient(ellipse 600px 340px at 85% 5%, color-mix(in srgb, var(--color-accent2) 20%, transparent), transparent)",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-sans text-xs font-semibold text-accent">
            <FaPalette /> Image Lab
          </div>
          <h1 className="max-w-xl font-display text-4xl font-bold leading-tight text-ink sm:text-5xl">
            Reshape your images, playfully.
          </h1>
          <p className="mt-4 max-w-lg font-sans text-base text-ink-dim">
            Convert between formats, or shrink and enlarge — pick a tool below and drop your image in.
          </p>
        </motion.div>

        {formatsError && <p className="mt-10 font-sans text-sm text-danger">{formatsError}</p>}

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {pairs.map((pair, i) => {
            const key = pairKey(pair);
            const isActive = selectedPair && pairKey(selectedPair) === key;
            return (
              <motion.button
                key={key}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="show"
                whileHover={{ y: -4, rotate: isActive ? 0 : -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => selectPair(pair)}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  isActive
                    ? "border-accent bg-accent text-white shadow-lg shadow-accent/30"
                    : "border-border bg-surface text-ink hover:border-accent/40"
                }`}
              >
                {pair.label ? (
                  <span className="flex items-center gap-1.5 font-sans text-sm font-semibold">
                    <FaWandMagicSparkles className={isActive ? "text-white" : "text-accent2"} />
                    {pair.label}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 font-mono text-xs font-semibold uppercase">
                    {pair.from}
                    <FaArrowRightLong className="text-[10px] opacity-70" />
                    {pair.to}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {selectedPair && (
            <motion.div
              key={pairKey(selectedPair)}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-8 overflow-hidden"
            >
              <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 sm:p-8">
                <Dropzone accept={accept} multiple={false} files={files} onFilesChange={updateFiles} hint="Drop an image to get started" />

                <OperationOptions operation={selectedPair.operation} values={optionValues} onChange={setOptionValues} />

                <FilenameOptions
                  appendUuid={optionValues.appendUuid}
                  onChange={(v) => setOptionValues({ ...optionValues, appendUuid: v })}
                />

                <ResultBanner status={status} progress={progress} error={error} result={result} onReset={resetOutcome} />

                {status !== "success" && (
                  <motion.button
                    whileHover={{ scale: canConvert ? 1.03 : 1 }}
                    whileTap={{ scale: canConvert ? 0.95 : 1 }}
                    onClick={handleConvert}
                    disabled={!canConvert}
                    className="flex w-fit items-center gap-2 rounded-full bg-accent px-7 py-3 font-sans text-sm font-bold text-white shadow-lg shadow-accent/30 transition-opacity disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    {isBusy ? "Reshaping\u2026" : "Go"} <FaWandMagicSparkles className="text-xs" />
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

export default ImageLab;
