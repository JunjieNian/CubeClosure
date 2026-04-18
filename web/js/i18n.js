/**
 * i18n.js - Internationalization module for CUBE (心慌方) visualization
 *
 * Supports Chinese (zh) and English (en).
 * Persists language preference in localStorage.
 * Updates DOM elements carrying a data-i18n attribute and fires a
 * 'langchange' CustomEvent on document so dynamic code can react.
 */

const translations = {
  zh: {
    title:              "CUBE",
    subtitle:           "\u5fc3\u614c\u65b9 \u2014 \u95ed\u5408\u673a\u68b0\u7cfb\u7edf",
    controls:           "\u63a7\u5236",
    grid:               "\u7f51\u683c",
    currentState:       "\u5f53\u524d\u72b6\u6001",
    speed:              "\u901f\u5ea6",
    serviceLayer:       "\u670d\u52a1\u76ae\u5c42",
    roomTrails:         "\u623f\u95f4\u8f68\u8ff9",
    autoLoop:           "\u81ea\u52a8\u5faa\u73af",
    statistics:         "\u7edf\u8ba1",
    gridLabel:          "\u7f51\u683c",
    totalRooms:         "\u603b\u623f\u95f4\u6570",
    tracked:            "\u8ddf\u8e2a\u4e2d",
    phases:             "\u9636\u6bb5\u6570",
    roomInspector:      "\u623f\u95f4\u68c0\u67e5\u5668",
    clickToInspect:     "\u70b9\u51fb\u623f\u95f4\u4ee5\u67e5\u770b\u8be6\u60c5",
    mathModel:          "\u6570\u5b66\u6a21\u578b",
    codebookTitle:      "\u8f74\u7f16\u7801\u8868 (26)",
    orbitHint:          "\u62d6\u62fd\u65cb\u8f6c \u00b7 \u6eda\u8f6e\u7f29\u653e",
    loadingModules:     "\u52a0\u8f7d\u6a21\u5757\u4e2d...",
    buildingModel:      "\u6784\u5efa\u6a21\u578b\u4e2d...",
    creatingScene:      "\u521b\u5efa\u573a\u666f\u4e2d...",
    computingCodebook:  "\u8ba1\u7b97\u7f16\u7801\u8868\u4e2d...",
    initSystem:         "\u521d\u59cb\u5316\u7cfb\u7edf",
    roomIdentity:       "\u623f\u95f4\u8eab\u4efd\uff08\u521d\u59cb\u4f4d\u7f6e\uff09",
    currentPosition:    "\u5f53\u524d\u4f4d\u7f6e",
    roomIndex:          "\u623f\u95f4\u7f16\u53f7",
    xAxisEncoding:      "X\u8f74\u7f16\u7801",
    positions:          "\u4f4d\u7f6e",
    phase0:             "Phase 0\uff08\u521d\u59cb\u505c\u9760\uff09",
    xRearrange:         "X \u8f74\u91cd\u6392",
    xyRearrange:        "X+Y \u8f74\u91cd\u6392",
    phase1:             "Phase 1",
    phase2:             "Phase 2",
    backToPhase0:       "\u56de\u5230 Phase 0",
    mathEncoding:       "\u7f16\u7801\u516c\u5f0f",
    mathPhasePos:       "\u9636\u6bb5\u4f4d\u7f6e",
    mathDisplacement:   "\u4f4d\u79fb",
    mathCycle:          "\u5faa\u73af",
    mathTransition:     "\u9636\u6bb5\u8f6c\u6362\u5bf9 X, Y, Z \u4e09\u8f74\u72ec\u7acb\u65bd\u52a0\u76f8\u540c\u7684\u4e00\u7ef4\u6392\u5217\u3002",
  },

  en: {
    title:              "CUBE",
    subtitle:           "CUBE \u2014 Closed Mechanical System",
    controls:           "Controls",
    grid:               "Grid",
    currentState:       "Current State",
    speed:              "Speed",
    serviceLayer:       "Service Layer",
    roomTrails:         "Room Trails",
    autoLoop:           "Auto Loop",
    statistics:         "Statistics",
    gridLabel:          "Grid",
    totalRooms:         "Total Rooms",
    tracked:            "Tracked",
    phases:             "Phases",
    roomInspector:      "Room Inspector",
    clickToInspect:     "Click a room to inspect",
    mathModel:          "Math Model",
    codebookTitle:      "Axis Codebook (26)",
    orbitHint:          "Orbit: drag \u00b7 Zoom: scroll",
    loadingModules:     "LOADING MODULES...",
    buildingModel:      "BUILDING MODEL...",
    creatingScene:      "CREATING SCENE...",
    computingCodebook:  "COMPUTING CODEBOOK...",
    initSystem:         "INITIALIZING SYSTEM",
    roomIdentity:       "Room Identity (initial pos)",
    currentPosition:    "Current Position",
    roomIndex:          "Room Index",
    xAxisEncoding:      "X-axis Encoding",
    positions:          "positions",
    phase0:             "Phase 0 (Initial Dock)",
    xRearrange:         "X-axis Rearrange",
    xyRearrange:        "X+Y Axes Rearrange",
    phase1:             "Phase 1",
    phase2:             "Phase 2",
    backToPhase0:       "Back to Phase 0",
    mathEncoding:       "Encoding",
    mathPhasePos:       "Phase positions",
    mathDisplacement:   "Displacement",
    mathCycle:          "Cycle",
    mathTransition:     "Phase transitions apply the same 1D permutation independently on X, Y, Z axes.",
  },
};

/* ------------------------------------------------------------------ */
/*  State                                                             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "cube-lang";
let currentLang = localStorage.getItem(STORAGE_KEY) || "zh";

/* ------------------------------------------------------------------ */
/*  Core API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Return the translation for `key` in the active language.
 * Falls back to the key itself when no translation exists.
 */
function t(key) {
  const bundle = translations[currentLang];
  return (bundle && bundle[key] !== undefined) ? bundle[key] : key;
}

/** Return the current language code ('zh' or 'en'). */
function getCurrentLang() {
  return currentLang;
}

/**
 * Switch to the given language, persist the choice, refresh every
 * element carrying `data-i18n`, and fire a 'langchange' event.
 *
 * @param {'zh'|'en'} lang
 */
function setLang(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);

  // Update every DOM node that declares a translation key.
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });

  // Notify dynamic code that the language changed.
  document.dispatchEvent(
    new CustomEvent("langchange", { detail: { lang } })
  );
}

/* ------------------------------------------------------------------ */
/*  Phase-title translator                                            */
/* ------------------------------------------------------------------ */

/**
 * Translate a Chinese phase title to English when the current language
 * is 'en'.  Returns the original string unchanged when in 'zh' mode or
 * when no matching pattern is found.
 *
 * Recognised patterns:
 *   "Phase 0（初始停靠）"       -> "Phase 0 (Initial Dock)"
 *   "0→1：X 轴重排"            -> "0\u21921: X-axis Rearrange"
 *   "0→1：X+Y 轴重排"          -> "0\u21921: X+Y Axes Rearrange"
 *   "Phase 1"                  -> "Phase 1"
 *   "Phase 2"                  -> "Phase 2"
 *   "回到 Phase 0"             -> "Back to Phase 0"
 *
 * @param {string} zhTitle - A Chinese phase title.
 * @returns {string} The translated title, or the original if no match.
 */
function translateTitle(zhTitle) {
  if (currentLang !== "en") return zhTitle;

  // Phase 0（初始停靠）
  if (/Phase\s*0\uff08\u521d\u59cb\u505c\u9760\uff09/.test(zhTitle)) {
    return "Phase 0 (Initial Dock)";
  }

  // 回到 Phase 0
  if (/\u56de\u5230\s*Phase\s*0/.test(zhTitle)) {
    return "Back to Phase 0";
  }

  // N→M：X+Y 轴重排
  const xyMatch = zhTitle.match(/^(\d+)\u2192(\d+)\uff1aX\+Y\s*\u8f74\u91cd\u6392$/);
  if (xyMatch) {
    return `${xyMatch[1]}\u2192${xyMatch[2]}: X+Y Axes Rearrange`;
  }

  // N→M：X 轴重排
  const xMatch = zhTitle.match(/^(\d+)\u2192(\d+)\uff1aX\s*\u8f74\u91cd\u6392$/);
  if (xMatch) {
    return `${xMatch[1]}\u2192${xMatch[2]}: X-axis Rearrange`;
  }

  // Phase N  (plain, already English-ish)
  if (/^Phase\s+\d+$/.test(zhTitle)) {
    return zhTitle;
  }

  return zhTitle;
}

/* ------------------------------------------------------------------ */
/*  Exports                                                           */
/* ------------------------------------------------------------------ */

export { translations, t, setLang, getCurrentLang, translateTitle };
