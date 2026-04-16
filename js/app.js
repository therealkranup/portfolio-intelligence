/* ============================================
   PORTFOLIO INTELLIGENCE — Main Application
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
};

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

// ── Supabase Client (lazy init) ──
let supabase = null;

function initSupabase() {
  // Will be configured in settings or via env
  const url = window.__SUPABASE_URL__;
  const key = window.__SUPABASE_ANON_KEY__;
  if (url && key && window.supabase) {
    supabase = window.supabase.createClient(url, key);
  }
  return supabase;
}

// ── Navigation & Routing ──
function navigateTo(section) {
  APP_STATE.currentView = section;

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Update bottom bar active state
  document.querySelectorAll('.tab-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Show/hide views
  document.querySelectorAll('#main-content .view').forEach(el => {
    el.classList.toggle('active', el.dataset.view === section);
  });

  // Update URL hash
  history.replaceState(null, '', `#${section}`);
}

function initNavigation() {
  // Sidebar nav clicks
  document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.section);
    });
  });

  // Bottom bar tab clicks
  document.querySelectorAll('.tab-item[data-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const section = el.dataset.section;
      if (section === 'more') {
        // Toggle a "more" menu — for now, go to settings
        navigateTo('settings');
      } else {
        navigateTo(section);
      }
    });
  });

  // Sidebar toggle (collapse/expand)
  const toggle = document.getElementById('sidebar-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.getElementById('app-shell').classList.toggle('sidebar-collapsed');
    });
  }

  // Handle initial hash
  const hash = location.hash.replace('#', '') || 'overview';
  navigateTo(hash);
}

// ── Auth Screen ──
function initAuth() {
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  // Tab switching
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.authTab;
      authTabs.forEach(t => t.classList.toggle('active', t === tab));
      loginForm.hidden = target !== 'login';
      signupForm.hidden = target !== 'signup';
    });
  });

  // Login
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.hidden = true;

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        APP_STATE.user = data.user;
        showApp();
      } catch (err) {
        errorEl.textContent = err.message || 'Login fejlede';
        errorEl.hidden = false;
      }
    } else {
      // Demo: any credentials work
      APP_STATE.user = { email, id: 'demo-' + Date.now() };
      APP_STATE.demoMode = true;
      showApp();
    }
  });

  // Signup
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-password-confirm').value;
    const errorEl = document.getElementById('signup-error');
    errorEl.hidden = true;

    if (password !== confirm) {
      errorEl.textContent = APP_STATE.lang === 'da' ? 'Adgangskoderne matcher ikke' : 'Passwords do not match';
      errorEl.hidden = false;
      return;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        APP_STATE.user = data.user;
        showApp();
      } catch (err) {
        errorEl.textContent = err.message || 'Oprettelse fejlede';
        errorEl.hidden = false;
      }
    } else {
      APP_STATE.user = { email, id: 'demo-' + Date.now() };
      APP_STATE.demoMode = true;
      showApp();
    }
  });

  // Demo mode
  document.getElementById('demo-mode-btn').addEventListener('click', () => {
    APP_STATE.user = { email: 'demo@portfolio.dk', id: 'demo-' + Date.now() };
    APP_STATE.demoMode = true;
    showApp();
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (supabase) await supabase.auth.signOut();
    APP_STATE.user = null;
    APP_STATE.demoMode = false;
    showAuthScreen();
  });
}

function showAuthScreen() {
  document.getElementById('app-loading').classList.remove('active');
  document.getElementById('app-loading').style.display = 'none';
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('app-shell').classList.remove('active');
}

function showApp() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-shell').classList.add('active');

  // Update user display
  if (APP_STATE.user) {
    const email = APP_STATE.user.email || '';
    document.getElementById('user-name').textContent = email;
    document.getElementById('user-avatar').textContent = email.charAt(0).toUpperCase();
  }

  loadData();
  renderAll();
}

// ── Theme Management ──
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  themeToggle.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.themeVal;
      themeToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (val === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
      } else {
        document.documentElement.dataset.theme = val;
      }
      APP_STATE.theme = val;
      savePreferences();
    });
  });
}

// ── Language Toggle ──
function initLanguage() {
  const langToggle = document.getElementById('lang-toggle');
  if (!langToggle) return;

  langToggle.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      langToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      APP_STATE.lang = btn.dataset.lang;
      applyTranslations(APP_STATE.lang);
      savePreferences();
    });
  });
}

// ── Currency Select ──
function initCurrency() {
  const select = document.getElementById('currency-select');
  if (!select) return;

  select.addEventListener('change', () => {
    APP_STATE.currency = select.value;
    renderAll();
    savePreferences();
  });
}

// ── Preferences (localStorage fallback) ──
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
  } catch {}
  // TODO: sync to Supabase when connected
}

function loadData() {
  try {
    const entries = JSON.parse(localStorage.getItem('pi-entries'));
    const positions = JSON.parse(localStorage.getItem('pi-positions'));
    if (entries) APP_STATE.entries = entries;
    if (positions) APP_STATE.positions = positions;
  } catch {}
}

// ── Net Worth Entry Management ──
function initNetWorth() {
  const addBtn = document.getElementById('add-entry-btn');
  const modal = document.getElementById('modal-entry');
  const form = document.getElementById('entry-form');

  addBtn.addEventListener('click', () => {
    document.getElementById('modal-entry-title').textContent = t('modal.addEntry');
    form.reset();
    document.getElementById('entry-id').value = '';
    modal.showModal();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('entry-id').value;
    const entry = {
      id: id || crypto.randomUUID(),
      name: document.getElementById('entry-name').value,
      amount: parseFloat(document.getElementById('entry-amount').value) || 0,
      type: document.getElementById('entry-type').value,
      category: document.getElementById('entry-category').value,
    };

    if (id) {
      const idx = APP_STATE.entries.findIndex(e => e.id === id);
      if (idx >= 0) APP_STATE.entries[idx] = entry;
    } else {
      APP_STATE.entries.push(entry);
    }

    saveData();
    renderAll();
    modal.close();
  });
}

function editEntry(id) {
  const entry = APP_STATE.entries.find(e => e.id === id);
  if (!entry) return;
  const modal = document.getElementById('modal-entry');
  document.getElementById('modal-entry-title').textContent = t('modal.editEntry');
  document.getElementById('entry-id').value = entry.id;
  document.getElementById('entry-name').value = entry.name;
  document.getElementById('entry-amount').value = entry.amount;
  document.getElementById('entry-type').value = entry.type;
  document.getElementById('entry-category').value = entry.category;
  modal.showModal();
}

function deleteEntry(id) {
  APP_STATE.entries = APP_STATE.entries.filter(e => e.id !== id);
  saveData();
  renderAll();
}

// ── Position Management ──
function initPortfolio() {
  const addBtn = document.getElementById('add-position-btn');
  const modal = document.getElementById('modal-position');
  const form = document.getElementById('position-form');

  addBtn.addEventListener('click', () => {
    document.getElementById('modal-position-title').textContent = t('modal.addPosition');
    form.reset();
    document.getElementById('position-id').value = '';
    modal.showModal();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('position-id').value;
    const position = {
      id: id || crypto.randomUUID(),
      ticker: document.getElementById('position-ticker').value.toUpperCase(),
      name: document.getElementById('position-name').value,
      type: document.getElementById('position-type').value,
      shares: parseFloat(document.getElementById('position-shares').value) || 0,
      avgPrice: parseFloat(document.getElementById('position-avg-price').value) || 0,
      currentPrice: parseFloat(document.getElementById('position-current-price').value) || 0,
    };

    if (id) {
      const idx = APP_STATE.positions.findIndex(p => p.id === id);
      if (idx >= 0) APP_STATE.positions[idx] = position;
    } else {
      APP_STATE.positions.push(position);
    }

    saveData();
    renderAll();
    modal.close();
  });
}

function editPosition(id) {
  const pos = APP_STATE.positions.find(p => p.id === id);
  if (!pos) return;
  const modal = document.getElementById('modal-position');
  document.getElementById('modal-position-title').textContent = t('modal.editPosition');
  document.getElementById('position-id').value = pos.id;
  document.getElementById('position-ticker').value = pos.ticker;
  document.getElementById('position-name').value = pos.name;
  document.getElementById('position-type').value = pos.type;
  document.getElementById('position-shares').value = pos.shares;
  document.getElementById('position-avg-price').value = pos.avgPrice;
  document.getElementById('position-current-price').value = pos.currentPrice;
  modal.showModal();
}

function deletePosition(id) {
  APP_STATE.positions = APP_STATE.positions.filter(p => p.id !== id);
  saveData();
  renderAll();
}

// ── Modal Close Handlers ──
function initModals() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('dialog').close();
    });
  });

  // Close on backdrop click
  document.querySelectorAll('dialog.modal').forEach(dialog => {
    dialog.addEventListener('click', e => {
      if (e.target === dialog) dialog.close();
    });
  });
}

// ── Document Scan ──
function initScan() {
  const scanBtn = document.getElementById('scan-doc-btn');
  const modal = document.getElementById('modal-scan');
  const dropzone = document.getElementById('scan-dropzone');
  const fileInput = document.getElementById('scan-file-input');

  scanBtn.addEventListener('click', () => {
    document.getElementById('scan-preview').hidden = true;
    document.getElementById('scan-result').hidden = true;
    document.getElementById('scan-loading').hidden = true;
    document.getElementById('scan-apply-btn').hidden = true;
    modal.showModal();
  });

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleScanFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleScanFile(fileInput.files[0]);
  });
}

async function handleScanFile(file) {
  const preview = document.getElementById('scan-preview');
  const loading = document.getElementById('scan-loading');
  const result = document.getElementById('scan-result');

  // Show preview
  preview.hidden = false;
  if (file.type.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = '100%';
    img.style.borderRadius = 'var(--radius-lg)';
    preview.innerHTML = '';
    preview.appendChild(img);
  } else {
    preview.innerHTML = `<p style="color:var(--text-secondary)">${file.name} (${(file.size/1024).toFixed(0)} KB)</p>`;
  }

  // Convert to base64
  loading.hidden = false;
  const base64 = await fileToBase64(file);
  const mediaType = file.type || 'application/pdf';

  try {
    const resp = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 }
            },
            {
              type: 'text',
              text: `Analyze this financial document. Extract all monetary amounts, asset names, and categories. Return JSON: { "entries": [{ "name": "...", "amount": number, "type": "asset"|"liability", "category": "cash|investment|property|pension|vehicle|other_asset|mortgage|student_loan|car_loan|credit_card|other_liability" }], "positions": [{ "ticker": "...", "name": "...", "type": "stock|etf|fund|bond|crypto|other", "shares": number, "currentPrice": number }] }`
            }
          ]
        }]
      })
    });

    const data = await resp.json();
    loading.hidden = true;

    if (data.content && data.content[0] && data.content[0].text) {
      const text = data.content[0].text;
      // Try to parse JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        window._scanResults = parsed;
        result.hidden = false;
        result.innerHTML = renderScanResults(parsed);
        document.getElementById('scan-apply-btn').hidden = false;
      } else {
        result.hidden = false;
        result.innerHTML = `<p style="color:var(--text-secondary)">${text}</p>`;
      }
    } else {
      result.hidden = false;
      result.innerHTML = `<p style="color:var(--color-negative)">Kunne ikke analysere dokumentet.</p>`;
    }
  } catch (err) {
    loading.hidden = true;
    result.hidden = false;
    result.innerHTML = `<p style="color:var(--color-negative)">Fejl: ${err.message}</p>`;
  }
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
}

function renderScanResults(data) {
  let html = '';
  if (data.entries && data.entries.length) {
    html += `<h4 style="margin-bottom:var(--space-2);color:var(--text-primary)">Fundet ${data.entries.length} poster</h4>`;
    html += '<ul style="list-style:none;display:flex;flex-direction:column;gap:var(--space-1)">';
    data.entries.forEach(e => {
      html += `<li style="font-size:var(--text-sm);color:var(--text-secondary)">${e.name}: ${formatCurrency(e.amount)} (${e.type})</li>`;
    });
    html += '</ul>';
  }
  if (data.positions && data.positions.length) {
    html += `<h4 style="margin:var(--space-3) 0 var(--space-2);color:var(--text-primary)">Fundet ${data.positions.length} positioner</h4>`;
    html += '<ul style="list-style:none;display:flex;flex-direction:column;gap:var(--space-1)">';
    data.positions.forEach(p => {
      html += `<li style="font-size:var(--text-sm);color:var(--text-secondary)">${p.ticker} — ${p.name}: ${p.shares} stk.</li>`;
    });
    html += '</ul>';
  }
  return html || '<p style="color:var(--text-tertiary)">Ingen data fundet i dokumentet.</p>';
}

function initScanApply() {
  document.getElementById('scan-apply-btn').addEventListener('click', () => {
    const data = window._scanResults;
    if (!data) return;
    if (data.entries) {
      data.entries.forEach(e => {
        APP_STATE.entries.push({ ...e, id: crypto.randomUUID() });
      });
    }
    if (data.positions) {
      data.positions.forEach(p => {
        APP_STATE.positions.push({ ...p, id: crypto.randomUUID(), avgPrice: 0 });
      });
    }
    saveData();
    renderAll();
    document.getElementById('modal-scan').close();
  });
}

// ── Philosophy Selector ──
function initPhilosophy() {
  document.getElementById('philosophy-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#philosophy-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    APP_STATE.philosophy = chip.dataset.philosophy;
    savePreferences();
    // TODO: re-run scoring engine
  });
}

// ── Render Functions ──
function renderAll() {
  renderNetWorthList();
  renderKPIs();
  renderHoldingsTable();
}

function renderNetWorthList() {
  const assets = APP_STATE.entries.filter(e => e.type === 'asset');
  const liabilities = APP_STATE.entries.filter(e => e.type === 'liability');

  const assetsList = document.getElementById('assets-list');
  const liabilitiesList = document.getElementById('liabilities-list');

  if (assets.length === 0) {
    assetsList.innerHTML = `<div class="empty-state">${t('networth.noAssets')}</div>`;
  } else {
    assetsList.innerHTML = assets.map(e => entryItemHTML(e)).join('');
  }

  if (liabilities.length === 0) {
    liabilitiesList.innerHTML = `<div class="empty-state">${t('networth.noLiabilities')}</div>`;
  } else {
    liabilitiesList.innerHTML = liabilities.map(e => entryItemHTML(e)).join('');
  }

  const totalA = assets.reduce((s, e) => s + e.amount, 0);
  const totalL = liabilities.reduce((s, e) => s + e.amount, 0);
  document.getElementById('total-assets').textContent = formatCurrency(totalA);
  document.getElementById('total-liabilities').textContent = formatCurrency(totalL);
  document.getElementById('nw-total').textContent = formatCurrency(totalA - totalL);
}

function entryItemHTML(entry) {
  return `
    <div class="entry-item">
      <span class="entry-item-name">${escapeHTML(entry.name)}</span>
      <span class="entry-item-amount ${entry.type === 'liability' ? 'negative' : 'positive'}">${formatCurrency(entry.amount)}</span>
      <div class="entry-item-actions">
        <button onclick="editEntry('${entry.id}')" title="Redigér">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button onclick="deleteEntry('${entry.id}')" title="Slet">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    </div>`;
}

function renderKPIs() {
  const assets = APP_STATE.entries.filter(e => e.type === 'asset');
  const liabilities = APP_STATE.entries.filter(e => e.type === 'liability');
  const totalA = assets.reduce((s, e) => s + e.amount, 0);
  const totalL = liabilities.reduce((s, e) => s + e.amount, 0);
  const nw = totalA - totalL;

  document.getElementById('kpi-networth').textContent = formatCurrency(nw);
  document.getElementById('kpi-assets').textContent = formatCurrency(totalA);
  document.getElementById('kpi-liabilities').textContent = formatCurrency(totalL);

  // Portfolio total
  const portfolioTotal = APP_STATE.positions.reduce((s, p) => s + (p.shares * p.currentPrice), 0);
  document.getElementById('portfolio-total').textContent = formatCurrency(portfolioTotal);
  document.getElementById('portfolio-count').textContent = APP_STATE.positions.length;
}

function renderHoldingsTable() {
  const tbody = document.getElementById('holdings-tbody');
  const positions = APP_STATE.positions;
  const totalValue = positions.reduce((s, p) => s + (p.shares * p.currentPrice), 0);

  if (positions.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8"><div class="empty-state">${t('portfolio.noHoldings')}</div></td></tr>`;
    return;
  }

  tbody.innerHTML = positions.map(p => {
    const value = p.shares * p.currentPrice;
    const weight = totalValue > 0 ? (value / totalValue * 100) : 0;
    return `
      <tr>
        <td><strong>${escapeHTML(p.ticker)}</strong></td>
        <td>${escapeHTML(p.name || '—')}</td>
        <td><span class="badge">${p.type}</span></td>
        <td class="num">${p.shares}</td>
        <td class="num">${formatCurrency(p.currentPrice)}</td>
        <td class="num">${formatCurrency(value)}</td>
        <td class="num">${formatPct(weight)}</td>
        <td>
          <div class="entry-item-actions">
            <button onclick="editPosition('${p.id}')" title="Redigér">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button onclick="deletePosition('${p.id}')" title="Slet">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Holdings Search ──
function initHoldingsSearch() {
  const input = document.getElementById('holdings-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    const rows = document.querySelectorAll('#holdings-tbody tr:not(.empty-row)');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

// ── Settings inputs ──
function initSettings() {
  const returnInput = document.getElementById('return-rate');
  const yearsInput = document.getElementById('projection-years');

  if (returnInput) {
    returnInput.value = APP_STATE.returnRate;
    returnInput.addEventListener('change', () => {
      APP_STATE.returnRate = parseFloat(returnInput.value) || 7;
      savePreferences();
    });
  }
  if (yearsInput) {
    yearsInput.value = APP_STATE.projectionYears;
    yearsInput.addEventListener('change', () => {
      APP_STATE.projectionYears = parseInt(yearsInput.value) || 10;
      savePreferences();
    });
  }

  // Export
  document.getElementById('export-data-btn')?.addEventListener('click', () => {
    const data = { entries: APP_STATE.entries, positions: APP_STATE.positions };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-intelligence-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import
  document.getElementById('import-data-btn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (data.entries) APP_STATE.entries = data.entries;
          if (data.positions) APP_STATE.positions = data.positions;
          saveData();
          renderAll();
        } catch (err) {
          alert('Kunne ikke læse filen: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });
}

// ── Utility ──
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', () => {
  loadPreferences();
  applyTranslations(APP_STATE.lang);
  initSupabase();

  initNavigation();
  initAuth();
  initTheme();
  initLanguage();
  initCurrency();
  initModals();
  initNetWorth();
  initPortfolio();
  initScan();
  initScanApply();
  initPhilosophy();
  initHoldingsSearch();
  initSettings();

  // Hide loading, check auth state
  document.getElementById('app-loading').style.display = 'none';

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        APP_STATE.user = data.session.user;
        showApp();
      } else {
        showAuthScreen();
      }
    });
  } else {
    // No Supabase — show auth screen (user can use demo mode)
    showAuthScreen();
  }
});
