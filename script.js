// DOM Elements
const sourceCodeTextarea = document.getElementById("sourceCode");
const sourceLanguageSelect = document.getElementById("sourceLanguage");
const targetLanguageSelect = document.getElementById("targetLanguage");
const outputCodeTextarea = document.getElementById("outputCode");
const convertBtn = document.getElementById("convertBtn");
const swapBtn = document.getElementById("swapBtn");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const formatBtn = document.getElementById("formatBtn");
const copySourceBtn = document.getElementById("copySourceBtn");
const copyResultBtn = document.getElementById("copyResultBtn");
const downloadBtn = document.getElementById("downloadBtn");
const explainBtn = document.getElementById("explainBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const clearBtn = document.getElementById("clearBtn");
const collapseOptionsBtn = document.getElementById("collapseOptionsBtn");
const optionsContent = document.getElementById("optionsContent");
const historyContent = document.getElementById("historyContent");
const loadingOverlay = document.getElementById("loadingOverlay");
const errorToast = document.getElementById("errorToast");
const successToast = document.getElementById("successToast");
const themeToggle = document.getElementById("themeToggle");

// API Configuration
const API_URL = "http://localhost:3000/convert";

// History Storage
let conversionHistory = [];
// Whether the user manually changed the source language select
let userChangedSourceLang = false;

// Initialize
loadHistory();

// Attach event listeners safely (some elements may be missing in tests)
if (convertBtn) convertBtn.addEventListener("click", handleConvert);
if (swapBtn) swapBtn.addEventListener("click", handleSwap);
if (uploadBtn && fileInput)
  uploadBtn.addEventListener("click", () => fileInput.click());
if (fileInput) fileInput.addEventListener("change", handleFileUpload);
if (formatBtn) formatBtn.addEventListener("click", handleFormat);
if (copySourceBtn)
  copySourceBtn.addEventListener("click", () =>
    copyToClipboard(sourceCodeTextarea.value, "Source code copied!")
  );
if (copyResultBtn)
  copyResultBtn.addEventListener("click", () =>
    copyToClipboard(outputCodeTextarea.value, "Result copied!")
  );
if (downloadBtn) downloadBtn.addEventListener("click", handleDownload);
if (explainBtn) explainBtn.addEventListener("click", handleExplain);
if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", clearHistory);
if (clearBtn) clearBtn.addEventListener("click", clearHistory);
if (collapseOptionsBtn)
  collapseOptionsBtn.addEventListener("click", toggleOptions);
if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

// Track if user manually selects a language (so auto-detect doesn't override)
if (sourceLanguageSelect)
  sourceLanguageSelect.addEventListener("change", () => {
    userChangedSourceLang = sourceLanguageSelect.value !== "auto";
  });

// Detect language while typing when source language is set to Auto-detect
if (sourceCodeTextarea) {
  sourceCodeTextarea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (convertBtn) convertBtn.click();
      else handleConvert();
    }
  });

  sourceCodeTextarea.addEventListener(
    "input",
    debounce(() => {
      const text = sourceCodeTextarea.value || "";
      if (
        sourceLanguageSelect &&
        sourceLanguageSelect.value === "auto" &&
        !userChangedSourceLang
      ) {
        autoDetectFromCode(text);
      }
    }, 600)
  );
}

// Keyboard shortcut: Ctrl+Enter to convert
if (sourceCodeTextarea) {
  sourceCodeTextarea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (convertBtn) convertBtn.click();
      else handleConvert();
    }
  });
}

/**
 * Main conversion handler
 */
async function handleConvert() {
  if (!sourceCodeTextarea || !sourceLanguageSelect || !targetLanguageSelect)
    return;

  const sourceCode = sourceCodeTextarea.value.trim();
  const sourceLang = sourceLanguageSelect.value;
  const targetLang = targetLanguageSelect.value;

  if (!sourceCode) {
    showToast("Please enter source code to convert", "error");
    return;
  }

  if (sourceLang === targetLang) {
    showToast("Source and target languages are the same", "error");
    return;
  }

  outputCodeTextarea.value = "";
  showLoading(true);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceCode: sourceCode,
        targetLanguage: targetLang,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.output) {
      throw new Error("Invalid response from server");
    }

    outputCodeTextarea.value = data.output;
    addToHistory({
      sourceCode: sourceCode,
      sourceLang: sourceLang,
      targetLang: targetLang,
      output: data.output,
      timestamp: Date.now(),
    });

    showToast("Code converted successfully!", "success");
  } catch (error) {
    console.error("Conversion error:", error);
    if (error.message && error.message.includes("fetch")) {
      showToast(
        "Unable to connect to server. Ensure backend is running on port 3000.",
        "error"
      );
    } else {
      showToast(`Conversion failed: ${error.message || error}`, "error");
    }
  } finally {
    showLoading(false);
  }
}

/**
 * Swap source and target languages
 */
function handleSwap() {
  if (
    !sourceLanguageSelect ||
    !targetLanguageSelect ||
    !sourceCodeTextarea ||
    !outputCodeTextarea
  )
    return;

  const tempLang = sourceLanguageSelect.value;
  const tempCode = sourceCodeTextarea.value;

  sourceLanguageSelect.value = targetLanguageSelect.value;
  targetLanguageSelect.value = tempLang;

  if (outputCodeTextarea.value) {
    sourceCodeTextarea.value = outputCodeTextarea.value;
    outputCodeTextarea.value = tempCode;
  }

  showToast("Languages swapped!", "success");
}

/**
 * Handle file upload
 */
function handleFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (fileName) fileName.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    if (sourceCodeTextarea) {
      sourceCodeTextarea.value = e.target.result;
      autoDetectLanguage(file.name);
    }
    showToast("File uploaded successfully!", "success");
  };
  reader.onerror = () => {
    showToast("Failed to read file", "error");
  };
  reader.readAsText(file);
}

/**
 * Format code (basic implementation)
 */
function handleFormat() {
  if (!sourceCodeTextarea) return;
  const code = sourceCodeTextarea.value.trim();
  if (!code) {
    showToast("No code to format", "error");
    return;
  }

  const lines = code.split("\n");
  const formatted = lines.map((line) => line.trim()).join("\n");
  sourceCodeTextarea.value = formatted;

  showToast("Code formatted!", "success");
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text, message) {
  if (!text) {
    showToast("Nothing to copy", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast(message, "success");
  } catch (error) {
    showToast("Failed to copy to clipboard", "error");
  }
}

/**
 * Download converted code
 */
function handleDownload() {
  if (!outputCodeTextarea) return;
  const code = outputCodeTextarea.value;
  if (!code) {
    showToast("No code to download", "error");
    return;
  }

  const targetLang = targetLanguageSelect ? targetLanguageSelect.value : "";
  const extension = getFileExtension(targetLang);
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `converted_code.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Code downloaded!", "success");
}

/**
 * Get file extension for language
 */
function getFileExtension(language) {
  const extensions = {
    Python: "py",
    JavaScript: "js",
    Javascript: "js",
    Java: "java",
    "C++": "cpp",
    C: "c",
    Go: "go",
    Ruby: "rb",
    PHP: "php",
    "C#": "cs",
    TypeScript: "ts",
    Rust: "rs",
    Kotlin: "kt",
    Swift: "swift",
    "Objective-C": "m",
    Scala: "scala",
    Perl: "pl",
    Bash: "sh",
    SQL: "sql",
  };
  return extensions[language] || "txt";
}

/**
 * Explain code (placeholder)
 */
async function handleExplain() {
  if (!outputCodeTextarea) return;
  const code = outputCodeTextarea.value;
  const language = targetLanguageSelect ? targetLanguageSelect.value : "";
  if (!code) {
    showToast("No code to explain", "error");
    return;
  }

  showLoading(true);
  try {
    const resp = await fetch("/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Server error: ${resp.status}`);
    }

    const data = await resp.json();
    let explanation = data.explanation || "No explanation returned.";

    // Strip markdown formatting (bold, italic, headers)
    explanation = explanation
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove **bold**
      .replace(/\*([^*]+)\*/g, "$1") // Remove *italic*
      .replace(/^###\s+/gm, "") // Remove ### headers
      .replace(/^##\s+/gm, "") // Remove ## headers
      .replace(/^#\s+/gm, "") // Remove # headers
      .replace(/^\t\+\s+/gm, "• ") // Convert tabs to bullets
      .replace(/^\s{2,}/gm, ""); // Remove extra indentation

    // Show explanation in modal
    const modal = document.getElementById("explainModal");
    const container = document.getElementById("explainContent");
    if (container) container.textContent = explanation;
    if (modal) modal.style.display = "flex";
  } catch (error) {
    console.error("Explain error:", error);
    showToast(`Explain failed: ${error.message}`, "error");
  } finally {
    showLoading(false);
  }
}

/**
 * Add conversion to history
 */
function addToHistory(conversion) {
  conversionHistory.unshift(conversion);

  if (conversionHistory.length > 10) {
    conversionHistory = conversionHistory.slice(0, 10);
  }

  saveHistory();
  renderHistory();
}

/**
 * Save history to localStorage
 */
function saveHistory() {
  try {
    localStorage.setItem("polycode_history", JSON.stringify(conversionHistory));
  } catch (error) {
    console.error("Failed to save history:", error);
  }
}

/**
 * Load history from localStorage
 */
function loadHistory() {
  try {
    const saved = localStorage.getItem("polycode_history");
    if (saved) {
      conversionHistory = JSON.parse(saved);
      renderHistory();
    }
  } catch (error) {
    console.error("Failed to load history:", error);
    conversionHistory = [];
  }
}

/**
 * Render history items
 */
function renderHistory() {
  if (!conversionHistory || conversionHistory.length === 0) {
    if (historyContent)
      historyContent.innerHTML = '<p class="empty-state">No history yet</p>';
    return;
  }

  if (!historyContent) return;

  historyContent.innerHTML = conversionHistory
    .map((item, index) => {
      const timeAgo = getTimeAgo(item.timestamp);
      const preview = (item.sourceCode || "")
        .substring(0, 80)
        .replace(/\n/g, " ");

      return `
                <div class="history-item" data-index="${index}">
                    <div class="history-item-header">
                        <span class="history-languages">${escapeHtml(
                          item.sourceLang
                        )} → ${escapeHtml(item.targetLang)}</span>
                        <span class="history-time">${timeAgo}</span>
                    </div>
                    <div class="history-preview">${escapeHtml(preview)}</div>
                </div>
            `;
    })
    .join("");

  const items = historyContent.querySelectorAll(".history-item");
  items.forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-index"));
      loadHistoryItem(idx);
    });
  });
}

// Simple HTML escape to avoid injection in history preview
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Load a history item into the UI
function loadHistoryItem(index) {
  const item = conversionHistory[index];
  if (!item) return;

  if (sourceCodeTextarea) sourceCodeTextarea.value = item.sourceCode || "";
  if (sourceLanguageSelect)
    sourceLanguageSelect.value = item.sourceLang || sourceLanguageSelect.value;
  if (targetLanguageSelect)
    targetLanguageSelect.value = item.targetLang || targetLanguageSelect.value;
  if (outputCodeTextarea) outputCodeTextarea.value = item.output || "";

  showToast("Loaded history item", "success");
}

// Human readable time-ago
function getTimeAgo(timestamp) {
  if (!timestamp) return "";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// Toggle options panel
function toggleOptions() {
  if (!optionsContent) return;
  const isHidden =
    optionsContent.style.display === "none" ||
    getComputedStyle(optionsContent).display === "none";
  optionsContent.style.display = isHidden ? "block" : "none";
}

// Show or hide loading overlay
function showLoading(show) {
  if (!loadingOverlay) return;
  loadingOverlay.style.display = show ? "flex" : "none";
}

// Toast helpers
let toastTimeout = null;
function showToast(message, type = "success") {
  clearTimeout(toastTimeout);

  const isError = type === "error";
  const el = isError ? errorToast : successToast;
  const other = isError ? successToast : errorToast;

  if (!el) return;
  if (other) other.style.display = "none";

  el.textContent = message;
  el.style.display = "block";

  toastTimeout = setTimeout(() => {
    if (el) el.style.display = "none";
  }, 3500);
}

// Clear history
function clearHistory() {
  conversionHistory = [];
  saveHistory();
  renderHistory();
  showToast("History cleared", "success");
}

// Debounce helper
function debounce(fn, wait) {
  let t = null;
  return function (...args) {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Try to detect language from source code text using simple heuristics
 */
function autoDetectFromCode(code) {
  if (!sourceLanguageSelect || !code) return;
  const text = code.trim();

  // Quick heuristics - ordered
  const patterns = [
    { re: /\bdef\s+\w+\(|\bimport\s+\w+/m, lang: "Python" },
    {
      re: /console\.log\(|\bfunction\s+\w+\(|=>|\bconst\s+\w+/m,
      lang: "JavaScript",
    },
    {
      re: /\bclass\s+\w+\b.*\bextends\b|System\.out\.println|public\s+static\s+void\s+main/m,
      lang: "Java",
    },
    { re: /#include\s+<|std::|cout\s*<</m, lang: "C++" },
    { re: /using\s+System;|Console\.WriteLine\(/m, lang: "C#" },
    { re: /package\s+\w+;|fun\s+\w+\(|val\s+\w+|var\s+\w+/, lang: "Kotlin" },
    { re: /\bfunc\s+\w+\(|fmt\.Println\(/m, lang: "Go" },
    { re: /->|let\s+\w+:|fn\s+\w+\(/m, lang: "Rust" },
    { re: /console\.|import\s+\w+\s+from\s+/m, lang: "TypeScript" },
    { re: /<\?php|echo\s+/m, lang: "PHP" },
    { re: /#!/, lang: "Bash" },
  ];

  for (const p of patterns) {
    if (p.re.test(text)) {
      sourceLanguageSelect.value = p.lang;
      showToast(`Detected language: ${p.lang}`, "success");
      return;
    }
  }

  // fallback: check for JSON-like or SQL
  if (/SELECT\s+.+FROM/i.test(text) || /INSERT\s+INTO/i.test(text)) {
    sourceLanguageSelect.value = "SQL";
    showToast("Detected language: SQL", "success");
    return;
  }

  // no clear detection
  console.log("autoDetectFromCode: no match");
}

/**
 * Auto-detect language from file extension
 */
function autoDetectLanguage(filename) {
  if (!sourceLanguageSelect) return;

  console.log("Auto-detecting language for:", filename);

  const langMap = {
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".java": "Java",
    ".cpp": "C++",
    ".c": "C",
    ".go": "Go",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".rs": "Rust",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".m": "Objective-C",
    ".scala": "Scala",
    ".pl": "Perl",
    ".sh": "Bash",
    ".sql": "SQL",
  };

  // Try to match by file extension
  for (const [ext, lang] of Object.entries(langMap)) {
    if (filename.toLowerCase().endsWith(ext)) {
      console.log(`Matched ${ext} → Setting language to ${lang}`);
      sourceLanguageSelect.value = lang;
      showToast(`Detected language: ${lang}`, "success");
      return;
    }
  }

  console.log("No language match found for:", filename);
}

/**
 * Toggle between dark and light theme
 */
function toggleTheme() {
  const root = document.documentElement;
  const currentTheme = localStorage.getItem("theme") || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  root.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);

  if (themeToggle) {
    themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
  }

  showToast(`Switched to ${newTheme} theme`, "success");
}

/**
 * Initialize theme on page load
 */
function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  const root = document.documentElement;
  root.setAttribute("data-theme", saved);

  if (themeToggle) {
    themeToggle.textContent = saved === "dark" ? "☀️" : "🌙";
  }
}

// Initialize theme on load
initTheme();

// Ensure functions accessible from HTML if needed
window.loadHistoryItem = loadHistoryItem;
window.toggleOptions = toggleOptions;
window.clearHistory = clearHistory;
window.autoDetectLanguage = autoDetectLanguage;
window.toggleTheme = toggleTheme;
window.handleExplain = handleExplain;

// Modal close handlers
const explainModal = document.getElementById("explainModal");
const closeExplainBtn = document.getElementById("closeExplainBtn");
if (closeExplainBtn)
  closeExplainBtn.addEventListener("click", () => {
    if (explainModal) explainModal.style.display = "none";
  });
if (explainModal) {
  explainModal.addEventListener("click", (e) => {
    if (e.target === explainModal) explainModal.style.display = "none";
  });
}
