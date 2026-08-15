const express = require("express");
const { CATEGORIES } = require("../converters/registry");

const router = express.Router();

router.get("/", (req, res) => {
  // Strip internal handler wiring — the frontend only needs from/to/labels.
  const payload = CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    pairs: cat.pairs.map((p) => ({
      from: p.from,
      to: p.to,
      operation: p.operation || null,
      label: p.label || null,
      inputType: p.inputType || "file",
      accept: p.accept || null,
      multiple: !!p.multiple,
      urlPlaceholder: p.urlPlaceholder || null,
    })),
  }));
  res.json({ categories: payload });
});

module.exports = router;
