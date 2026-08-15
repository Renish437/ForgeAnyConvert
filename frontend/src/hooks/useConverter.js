import { useEffect, useState } from "react";
import { convertFiles } from "../api";

const MULTI_FILE_OPS = new Set(["merge"]);

function isLikelyUrl(value) {
  return /^https?:\/\/\S+\.\S+/i.test(value.trim());
}

/**
 * Encapsulates the entire "pick a pair, provide input, convert, download"
 * flow. Used by every tool page (the general workbench, PDF Studio, GitHub
 * Grabber) so each page only has to own its own visual presentation.
 *
 * `status` moves through distinct, honestly-labeled phases rather than one
 * generic "converting" state, so the UI never just sits frozen on a large
 * file: "uploading" (real percentage, from the browser's own upload
 * progress), then "processing" (the server is doing the actual
 * conversion/compression — this is deliberately NOT a fake percentage,
 * since the backend doesn't stream true progress back over this endpoint;
 * an indeterminate indicator here is more honest than a number that isn't
 * real), then "finalizing" briefly while the result downloads, then
 * "success" or "error".
 */
export function useConverter() {
  const [selectedPair, setSelectedPair] = useState(null);
  const [files, setFiles] = useState([]);
  const [linkValue, setLinkValue] = useState("");
  const [optionValues, setOptionValues] = useState({ appendUuid: false });
  const [status, setStatus] = useState("idle"); // idle | uploading | processing | finalizing | success | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const resetOutcome = () => {
    setStatus("idle");
    setError("");
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
  };

  const selectPair = (pair) => {
    setSelectedPair(pair);
    setFiles([]);
    setLinkValue("");
    setOptionValues({ appendUuid: optionValues.appendUuid });
    resetOutcome();
  };

  const updateFiles = (f) => {
    setFiles(f);
    resetOutcome();
  };

  const updateLink = (v) => {
    setLinkValue(v);
    resetOutcome();
  };

  const inputType = selectedPair?.inputType || "file";
  const isMultiple = !!selectedPair && (selectedPair.multiple || MULTI_FILE_OPS.has(selectedPair.operation));
  const accept = !selectedPair ? undefined : selectedPair.from === "any" ? undefined : selectedPair.accept || `.${selectedPair.from}`;

  const missingRequiredOption =
    selectedPair?.operation === "protect" && !optionValues.password
      ? true
      : selectedPair?.operation === "watermark" && !optionValues.watermarkText
      ? true
      : false;

  const isBusy = status === "uploading" || status === "processing" || status === "finalizing";

  const canConvert =
    !!selectedPair &&
    !isBusy &&
    !missingRequiredOption &&
    (inputType === "url" ? isLikelyUrl(linkValue) : isMultiple ? files.length >= 2 : files.length === 1);

  const handleConvert = async () => {
    const startedAt = Date.now();
    setStatus(inputType === "url" ? "processing" : "uploading");
    setProgress(0);
    setError("");
    try {
      const fields =
        inputType === "url"
          ? { operation: selectedPair.operation, url: linkValue.trim(), ...optionValues }
          : { to: selectedPair.to, operation: selectedPair.operation, ...optionValues };
      const { blob, filename, originalSize, resultSize } = await convertFiles(
        inputType === "url" ? [] : files,
        fields,
        (percent) => {
          setProgress(percent);
          // Once the browser finishes uploading the file, the server takes
          // over — that's the "processing" phase, with no further real
          // percentage available over this endpoint.
          if (percent >= 100) setStatus("processing");
        }
      );
      setStatus("finalizing");
      const objectUrl = URL.createObjectURL(blob);
      // Total wall-clock time for the whole job (upload + processing), shown
      // on the success banner so people can see how long it actually took.
      const durationMs = Date.now() - startedAt;
      setResult({ url: objectUrl, filename, originalSize, resultSize, durationMs });
      setStatus("success");
    } catch (err) {
      setError(err.message || "Something went wrong during conversion.");
      setStatus("error");
    }
  };

  return {
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
  };
}
