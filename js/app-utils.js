/* ============================================
   PORTFOLIO INTELLIGENCE — Utility Functions
   Stripped from app.js for React migration.
   Provides: APP_STATE, formatCurrency, formatPct, escapeHTML,
             saveData, loadData, savePreferences, loadPreferences,
             prepareFileForScan, resizeImage, fileToBase64
   ============================================ */

// ── Global State ──
window.APP_STATE = {
  lang: 'da',
  theme: 'dark',
  currency: 'DKK',
  returnRate: 7,
  projectionYears: 10,
  user: null,
  demoMode: false,
  currentView: 'overview',
  philosophy: 'bogle',
  // Data
  entries: [],      // net worth entries
  positions: [],    // portfolio positions
};

// ── Currency Formatting ──
const CURRENCY_MAP = {
  DKK: { locale: 'da-DK', currency: 'DKK', suffix: ' kr.' },
  EUR: { locale: 'de-DE', currency: 'EUR', suffix: '' },
  USD: { locale: 'en-US', currency: 'USD', suffix: '' },
  SEK: { locale: 'sv-SE', currency: 'SEK', suffix: '' },
  NOK: { locale: 'nb-NO', currency: 'NOK', suffix: '' },
  GBP: { locale: 'en-GB', currency: 'GBP', suffix: '' },
};

// ── FX Rates (to DKK) ── updated via fetchFxRates()
// Fallback rates (approximate) used until live rates are fetched
window.FX_RATES = {
  DKK: 1,
  USD: 6.85,   // ~6.85 DKK per USD
  EUR: 7.46,   // ~7.46 DKK per EUR
  SEK: 0.64,   // ~0.64 DKK per SEK
  NOK: 0.65,   // ~0.65 DKK per NOK
  GBP: 8.65,   // ~8.65 DKK per GBP
};

// Convert amount from a given currency to the app's display currency (DKK)
function toDKK(amount, fromCurrency) {
  if (!fromCurrency || fromCurrency === 'DKK') return amount;
  const rate = window.FX_RATES[fromCurrency] || 1;
  return amount * rate;
}

// Fetch live FX rates (called on app load + price refresh)
async function fetchFxRates() {
  try {
    const resp = await fetch('/api/fx');
    if (!resp.ok) return;
    const data = await resp.json();
    if (data && typeof data === 'object') {
      Object.assign(window.FX_RATES, data);
      console.log('FX rates updated:', window.FX_RATES);
    }
  } catch(e) {
    console.warn('FX rate fetch failed, using fallback rates:', e.message);
  }
}

function formatCurrency(amount) {
  const s = APP_STATE;
  const c = CURRENCY_MAP[s.currency] || CURRENCY_MAP.DKK;
  try {
    return new Intl.NumberFormat(c.locale, {
      style: 'currency',
      currency: c.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString('da-DK')} kr.`;
  }
}

function formatPct(value, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

// ── Utility ──
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Preferences Persistence ──
function savePreferences() {
  try {
    localStorage.setItem('pi-prefs', JSON.stringify({
      lang: APP_STATE.lang,
      theme: APP_STATE.theme,
      currency: APP_STATE.currency,
      returnRate: APP_STATE.returnRate,
      projectionYears: APP_STATE.projectionYears,
      philosophy: APP_STATE.philosophy,
    }));
  } catch {}
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem('pi-prefs'));
    if (saved) {
      Object.assign(APP_STATE, saved);
      document.documentElement.dataset.theme = APP_STATE.theme === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : (APP_STATE.theme || 'dark');
    }
  } catch {}
}

// ── Data Persistence (localStorage for demo, Supabase when available) ──
function saveData() {
  try {
    localStorage.setItem('pi-entries', JSON.stringify(APP_STATE.entries));
    localStorage.setItem('pi-positions', JSON.stringify(APP_STATE.positions));
    if (APP_STATE.overlapData) localStorage.setItem('pi-overlap', JSON.stringify(APP_STATE.overlapData));
    if (APP_STATE.lastPriceUpdate) localStorage.setItem('pi-last-price-update', APP_STATE.lastPriceUpdate);
  } catch {}
}

function loadData() {
  try {
    const entries = JSON.parse(localStorage.getItem('pi-entries'));
    const positions = JSON.parse(localStorage.getItem('pi-positions'));
    const overlap = JSON.parse(localStorage.getItem('pi-overlap'));
    const lastPrice = localStorage.getItem('pi-last-price-update');
    if (entries) APP_STATE.entries = entries;
    if (positions) APP_STATE.positions = positions;
    if (overlap) APP_STATE.overlapData = overlap;
    if (lastPrice) APP_STATE.lastPriceUpdate = lastPrice;
  } catch {}
  // Migrate: backfill broker/accountType for positions added before this field existed
  APP_STATE.positions.forEach(p => {
    if (!p.broker) p.broker = 'saxo';
    if (!p.accountType) p.accountType = 'free';
  });
}

// ── Image / File Utilities for AI Scanning ──
function resizeImage(file, maxDim, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]);
    };
    img.src = URL.createObjectURL(file);
  });
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
}

async function prepareFileForScan(file) {
  const MAX_DIM = 1200;
  const JPEG_QUALITY = 0.7;

  // PDF → render pages as images using PDF.js
  if (file.type === 'application/pdf') {
    if (!window.pdfjsLib) {
      const base64 = await fileToBase64(file);
      return [{ type: 'image', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }];
    }
    const arrayBuf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuf }).promise;
    const totalPages = pdf.numPages;
    let pageNums;
    if (totalPages <= 6) {
      pageNums = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      pageNums = [2, 3];
      for (let p = 8; p <= Math.min(totalPages, 11); p++) pageNums.push(p);
    }
    const blocks = [];
    for (const i of pageNums) {
      if (i > totalPages) continue;
      const page = await pdf.getPage(i);
      const scale = Math.min(MAX_DIM / page.getViewport({ scale: 1 }).width, 2);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const base64 = dataUrl.split(',')[1];
      blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } });
    }
    return blocks;
  }

  // Images → resize and compress
  if (file.type.startsWith('image/')) {
    const base64 = await resizeImage(file, MAX_DIM, JPEG_QUALITY);
    return [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } }];
  }

  // Fallback for other file types
  const base64 = await fileToBase64(file);
  return [{ type: 'image', source: { type: 'base64', media_type: file.type || 'application/octet-stream', data: base64 } }];
}

// ── Expose all utilities globally ──
Object.assign(window, {
  APP_STATE,
  CURRENCY_MAP,
  formatCurrency,
  formatPct,
  escapeHTML,
  savePreferences,
  loadPreferences,
  saveData,
  loadData,
  resizeImage,
  fileToBase64,
  prepareFileForScan,
  toDKK,
  fetchFxRates,
});
