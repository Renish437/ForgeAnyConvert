import React, { useEffect, useMemo, useState } from "react";
import { FaTriangleExclamation, FaShieldHalved, FaGaugeHigh, FaLayerGroup } from "react-icons/fa6";
import CategoryNav from "../components/CategoryNav";
import ConversionPicker from "../components/ConversionPicker";
import Dropzone from "../components/Dropzone";
import UrlInput from "../components/UrlInput";
import OperationOptions from "../components/OperationOptions";
import FilenameOptions from "../components/FilenameOptions";
import ResultBanner from "../components/ResultBanner";
import { CATEGORY_META } from "../data/categoryMeta";
import { usePageTheme } from "../hooks/usePageTheme";
import { useFormats } from "../hooks/useFormats";
import { useConverter } from "../hooks/useConverter";

const URL_HINTS = {
  "github-download": "Works with any public GitHub repo or file link. Private repos aren't supported.",
};

function Converter() {
  usePageTheme("workshop");
  const { categories, error: formatsError } = useFormats();
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  const {
    selectedPair,
    selectPair,
    files,
    updateFiles,
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
    inputType,
    isMultiple,
    accept,
    canConvert,
    handleConvert,
  } = useConverter();

  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) || null,
    [categories, activeCategoryId]
  );

  const toolCount = useMemo(() => categories.reduce((sum, cat) => sum + cat.pairs.length, 0), [categories]);

  const handleSelectCategory = (id) => {
    setActiveCategoryId(id);
    selectPair(null);
  };

  if (formatsError) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-24 text-center sm:px-6">
        <FaTriangleExclamation className="text-2xl text-danger" />
        <p className="max-w-md font-sans text-sm text-ink-dim">{formatsError}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="border-b border-border-soft py-12 sm:py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">The universal converter</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Convert almost anything, right in your browser.
        </h1>
        <p className="mt-4 max-w-xl font-sans text-sm text-ink-dim sm:text-base">
          Documents, images, audio, video, spreadsheets, presentations, e-books, and GitHub files. Pick a
          tool, drop your file (or paste a link), and Forge does the rest.
        </p>

        <dl className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-t border-border-soft pt-6 sm:gap-8">
          <div>
            <dt className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
              <FaLayerGroup className="text-accent" /> Categories
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold text-ink">{categories.length || "\u2014"}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
              <FaGaugeHigh className="text-accent" /> Conversions
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold text-ink">{toolCount || "\u2014"}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
              <FaShieldHalved className="text-accent" /> Files stored
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold text-ink">0</dd>
          </div>
        </dl>
      </section>

      {/* Workbench */}
      <section className="flex flex-col gap-6 py-8 md:flex-row md:gap-8 md:py-10">
        <CategoryNav categories={categories} activeId={activeCategoryId} onSelect={handleSelectCategory} />

        <div className="min-w-0 flex-1 pb-16">
          {activeCategory && (
            <>
              <div className="mb-5">
                <h2 className="font-display text-xl font-semibold text-ink">{activeCategory.label}</h2>
                <p className="mt-1 font-sans text-sm text-ink-dim">
                  {CATEGORY_META[activeCategory.id]?.tagline}
                </p>
              </div>

              <ConversionPicker pairs={activeCategory.pairs} selected={selectedPair} onSelect={selectPair} />

              {selectedPair && (
                <div className="mt-6 flex flex-col gap-5 border border-border-soft bg-surface/60 p-5 animate-rise sm:p-6">
                  {inputType === "url" ? (
                    <UrlInput
                      value={linkValue}
                      onChange={updateLink}
                      placeholder={selectedPair.urlPlaceholder || "Paste a link\u2026"}
                      hint={URL_HINTS[selectedPair.operation]}
                    />
                  ) : (
                    <Dropzone
                      accept={accept}
                      multiple={isMultiple}
                      files={files}
                      onFilesChange={updateFiles}
                      hint={
                        selectedPair.from === "any"
                          ? isMultiple
                            ? "Add 2 or more files of any type, in the order you want them zipped"
                            : "Accepts any file type"
                          : isMultiple
                          ? `Add 2 or more .${selectedPair.from} files, in the order you want them merged`
                          : `Accepts .${selectedPair.from} files`
                      }
                    />
                  )}

                  <OperationOptions operation={selectedPair.operation} values={optionValues} onChange={setOptionValues} />

                  <FilenameOptions
                    appendUuid={optionValues.appendUuid}
                    onChange={(v) => setOptionValues({ ...optionValues, appendUuid: v })}
                  />

                  <ResultBanner
                    status={status}
                    progress={progress}
                    error={error}
                    result={result}
                    indeterminate={inputType === "url"}
                    onReset={resetOutcome}
                  />

                  {status !== "success" && (
                    <button
                      onClick={handleConvert}
                      disabled={!canConvert}
                      className="self-start border border-accent/60 bg-accent/10 px-6 py-2.5 font-sans text-sm font-semibold text-accent transition-all hover:bg-accent/20 hover:shadow-glow disabled:cursor-not-allowed disabled:border-border-soft disabled:bg-transparent disabled:text-ink-faint disabled:shadow-none"
                    >
                      {isBusy ? "Forging\u2026" : inputType === "url" ? "Fetch & convert" : "Convert"}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default Converter;
