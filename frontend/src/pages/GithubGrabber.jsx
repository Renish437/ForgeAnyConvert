import React from "react";
import { motion } from "framer-motion";
import { FaGithub, FaCodeBranch, FaFile, FaArrowRight, FaCircleInfo } from "react-icons/fa6";
import UrlInput from "../components/UrlInput";
import FilenameOptions from "../components/FilenameOptions";
import ResultBanner from "../components/ResultBanner";
import { usePageTheme } from "../hooks/usePageTheme";
import { useFormats } from "../hooks/useFormats";
import { useConverter } from "../hooks/useConverter";

function GithubGrabber() {
  usePageTheme("github");
  const { categories, error: formatsError } = useFormats();
  const githubCategory = categories.find((c) => c.id === "github");
  const pair = githubCategory?.pairs?.[0];

  const {
    selectedPair,
    selectPair,
    linkValue,
    updateLink,
    optionValues,
    setOptionValues,
    status,
    isBusy,
    progress,
    error,
    result,
    resetOutcome,
    canConvert,
    handleConvert,
  } = useConverter();

  // This page only ever offers one tool, so select it as soon as it loads.
  React.useEffect(() => {
    if (pair && !selectedPair) selectPair(pair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair]);

  return (
    <main className="min-h-[calc(100vh-8rem)]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <div className="mb-6 flex items-center gap-3 font-mono text-ink-dim">
            <FaGithub className="text-2xl text-ink" />
            <span className="text-sm">github-grabber</span>
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />
          </div>

          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
            Grab exactly what you need from GitHub.
          </h1>
          <p className="mt-3 max-w-lg font-sans text-sm text-ink-dim">
            Paste a link to a single file and get just that file. Paste a link to a repo and get the whole
            thing, zipped.
          </p>

          {/* Reference for the two link shapes this tool understands */}
          <div className="mt-4 flex flex-col gap-2 font-mono text-xs text-ink-faint sm:flex-row sm:gap-6">
            <span className="flex items-center gap-1.5">
              <FaFile className="text-accent" /> .../blob/branch/path/to/file &rarr; that one file
            </span>
            <span className="flex items-center gap-1.5">
              <FaCodeBranch className="text-accent2" /> github.com/owner/repo &rarr; whole repo, zipped
            </span>
          </div>
        </motion.div>

        {formatsError && <p className="mt-8 font-sans text-sm text-danger">{formatsError}</p>}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mt-10 border border-border bg-surface p-6 sm:p-8"
        >
          <UrlInput
            value={linkValue}
            onChange={updateLink}
            placeholder="https://github.com/owner/repo/blob/main/path/to/file.js"
            hint="Works with any public repository or file. Private repos aren't supported."
          />

          <div className="mt-5">
            <FilenameOptions
              accent="secondary"
              appendUuid={optionValues.appendUuid}
              onChange={(v) => setOptionValues({ ...optionValues, appendUuid: v })}
            />
          </div>

          <div className="mt-5">
            <ResultBanner status={status} progress={progress} error={error} result={result} indeterminate onReset={resetOutcome} />
          </div>

          {status !== "success" && (
            <motion.button
              whileHover={{ x: canConvert ? 2 : 0 }}
              whileTap={{ scale: canConvert ? 0.98 : 1 }}
              onClick={handleConvert}
              disabled={!canConvert}
              className="mt-5 flex items-center gap-2 border border-accent/60 bg-accent/10 px-6 py-2.5 font-mono text-sm font-medium text-accent transition-all hover:bg-accent/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-ink-faint"
            >
              {isBusy ? "fetching\u2026" : "$ fetch"} <FaArrowRight className="text-xs" />
            </motion.button>
          )}
        </motion.div>

        <p className="mt-6 flex items-start gap-2 font-sans text-xs text-ink-faint">
          <FaCircleInfo className="mt-0.5 shrink-0" />
          Only public repositories are supported. Nothing is stored on the server after your download
          finishes.
        </p>
      </div>
    </main>
  );
}

export default GithubGrabber;
