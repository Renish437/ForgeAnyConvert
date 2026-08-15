import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaWaveSquare, FaFilm, FaMusic, FaPlay } from "react-icons/fa6";
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

// A little waveform bar-graph, purely decorative — sets the DAW/broadcast
// tone at a glance without needing an actual audio file loaded.
function Waveform({ active }) {
  const bars = [6, 14, 9, 18, 11, 20, 8, 16, 12, 22, 7, 15, 10, 19, 9];
  return (
    <div className="flex h-8 items-end gap-[3px]">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          initial={{ height: 4 }}
          animate={{ height: active ? [4, h, 4] : h }}
          transition={active ? { duration: 0.9, repeat: Infinity, delay: i * 0.05, ease: "easeInOut" } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

function MediaConverter() {
  usePageTheme("media");
  const { categories, error: formatsError } = useFormats();

  const audioCategory = categories.find((c) => c.id === "audio");
  const videoCategory = categories.find((c) => c.id === "video");
  const compressCategory = categories.find((c) => c.id === "compress");
  const shrinkVideoPair = compressCategory?.pairs.find((p) => p.operation === "reduce-video");

  const audioPairs = audioCategory?.pairs || [];
  const videoPairs = [...(videoCategory?.pairs || []), ...(shrinkVideoPair ? [shrinkVideoPair] : [])];

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

  const renderRow = (pair, i) => {
    const key = pairKey(pair);
    const isActive = selectedPair && pairKey(selectedPair) === key;
    return (
      <motion.button
        key={key}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.03, duration: 0.25 }}
        whileHover={{ x: 3 }}
        onClick={() => selectPair(pair)}
        className={`flex w-full items-center justify-between border-b border-border-soft px-4 py-3 text-left transition-colors ${
          isActive ? "bg-accent/10 text-accent" : "text-ink-dim hover:bg-raised hover:text-ink"
        }`}
      >
        <span className="font-mono text-sm">
          {pair.label || (
            <>
              <span className="uppercase">{pair.from}</span>
              <span className="mx-2 opacity-50">&rarr;</span>
              <span className="uppercase">{pair.to}</span>
            </>
          )}
        </span>
        {isActive && <FaPlay className="text-xs text-accent" />}
      </motion.button>
    );
  };

  return (
    <main className="min-h-[calc(100vh-8rem)]">
      <div
        className="pointer-events-none h-1 w-full"
        style={{ background: "linear-gradient(90deg, var(--color-accent), var(--color-accent2), var(--color-accent))" }}
      />
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div>
            <div className="mb-4 inline-flex items-center gap-2 border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-accent">
              <FaWaveSquare /> Media Converter
            </div>
            <h1 className="max-w-lg font-display text-4xl font-bold uppercase tracking-tight text-ink sm:text-5xl">
              Any format. Every format.
            </h1>
            <p className="mt-3 max-w-md font-sans text-sm text-ink-dim">
              Re-encode audio and video between the formats every player and editor actually supports.
            </p>
          </div>
          <Waveform active={isBusy} />
        </motion.div>

        {formatsError && <p className="mt-10 font-sans text-sm text-danger">{formatsError}</p>}

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="border border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border-soft bg-raised px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-ink">
              <FaMusic className="text-accent2" /> Audio
            </div>
            {audioPairs.map(renderRow)}
          </div>
          <div className="border border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border-soft bg-raised px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-ink">
              <FaFilm className="text-accent2" /> Video
            </div>
            {videoPairs.map(renderRow)}
          </div>
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
              <div className="flex flex-col gap-5 border border-border bg-surface p-6 sm:p-8">
                <Dropzone accept={accept} multiple={false} files={files} onFilesChange={updateFiles} hint="Drop a media file to get started" />

                <OperationOptions operation={selectedPair.operation} values={optionValues} onChange={setOptionValues} />

                <FilenameOptions
                  accent="secondary"
                  appendUuid={optionValues.appendUuid}
                  onChange={(v) => setOptionValues({ ...optionValues, appendUuid: v })}
                />

                <ResultBanner status={status} progress={progress} error={error} result={result} onReset={resetOutcome} />

                {status !== "success" && (
                  <motion.button
                    whileHover={{ scale: canConvert ? 1.02 : 1 }}
                    whileTap={{ scale: canConvert ? 0.97 : 1 }}
                    onClick={handleConvert}
                    disabled={!canConvert}
                    className="flex w-fit items-center gap-2 border border-accent bg-accent px-6 py-2.5 font-mono text-sm font-semibold uppercase tracking-wide text-black transition-opacity disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-ink-faint disabled:opacity-60"
                  >
                    <FaPlay className="text-xs" /> {isBusy ? "Rendering\u2026" : "Render"}
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

export default MediaConverter;
