import {
  FaFileWord,
  FaFileImage,
  FaFilePdf,
  FaFileAudio,
  FaFileVideo,
  FaFileExcel,
  FaFilePowerpoint,
  FaBookOpen,
  FaCodeBranch,
  FaFileZipper,
} from "react-icons/fa6";

export const CATEGORY_META = {
  documents: {
    icon: FaFileWord,
    tagline: "Word, text, HTML and Markdown — reshaped on demand.",
  },
  images: {
    icon: FaFileImage,
    tagline: "Raster and vector images, recast into the format you need.",
  },
  "pdf-tools": {
    icon: FaFilePdf,
    tagline: "Extract, merge, compress, lock or stamp your PDFs.",
  },
  audio: {
    icon: FaFileAudio,
    tagline: "Re-encode audio between the formats every player understands.",
  },
  video: {
    icon: FaFileVideo,
    tagline: "Swap containers and codecs without losing quality.",
  },
  spreadsheet: {
    icon: FaFileExcel,
    tagline: "Move rows and columns between sheets and plain CSV.",
  },
  presentation: {
    icon: FaFilePowerpoint,
    tagline: "Slides, exported as documents or standalone images.",
  },
  ebook: {
    icon: FaBookOpen,
    tagline: "EPUB, MOBI and PDF, converted for any reader.",
  },
  github: {
    icon: FaCodeBranch,
    tagline: "Any public repository or single file, packaged and ready to download.",
    isNew: true,
  },
  compress: {
    icon: FaFileZipper,
    tagline: "Shrink or enlarge images and video, or zip up anything for a lighter download.",
    isNew: true,
  },
};

export const OPERATION_LABELS = {
  merge: { verb: "Merge", needsMultiple: true },
  compress: { verb: "Compress" },
  protect: { verb: "Protect" },
  watermark: { verb: "Watermark" },
  "pptx-images": { verb: "Export as images" },
  "github-download": { verb: "Download" },
  "zip-compress": { verb: "Zip", needsMultiple: true },
  "reduce-image": { verb: "Shrink" },
  "reduce-video": { verb: "Shrink" },
};
