(function (global) {
  var MAX_COLOUR_OTHER_WORDS = 3;
  var COLOUR_OTHER_WORDS_ERROR =
    "Please use up to three words only (e.g. whites and greens, or pink purple blue).";

  function normalizeColourOther(text) {
    return String(text || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function colourOtherWordCount(text) {
    var normalized = normalizeColourOther(text);
    if (!normalized) return 0;
    return normalized.split(" ").length;
  }

  function validateColourOther(colour, colourOther) {
    if (colour !== "other") {
      return { ok: true, colourOther: "" };
    }

    var normalized = normalizeColourOther(colourOther);
    if (!normalized) {
      return {
        ok: false,
        error: "Please specify your colour preference (up to three words).",
      };
    }

    if (colourOtherWordCount(normalized) > MAX_COLOUR_OTHER_WORDS) {
      return { ok: false, error: COLOUR_OTHER_WORDS_ERROR };
    }

    return { ok: true, colourOther: normalized };
  }

  global.GinShopColour = {
    validateColourOther: validateColourOther,
    colourOtherWordCount: colourOtherWordCount,
  };
})(typeof window !== "undefined" ? window : global);
