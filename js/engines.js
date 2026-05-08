/* ============================================
   PORTFOLIO INTELLIGENCE — Engines Module
   Auto-sync, prices, overlap, scoring, rebalancing
   ============================================ */

// ── Helper: position value in DKK ──
function posValDKK(p) {
  const raw = (p.shares || 0) * (p.currentPrice || 0);
  return (typeof toDKK === 'function') ? toDKK(raw, p.currency) : raw;
}

// ── Static fund data for proprietary Nordnet index funds (not on Yahoo Finance) ──
const NORDNET_FUND_DATA = {
  NORDNET_DK_IDX: {
    topHoldings: [
      { name: 'DSV', ticker: 'DSV.CO', weight: 13.72 },
      { name: 'Danske Bank', ticker: 'DANSKE.CO', weight: 10.99 },
      { name: 'Novo Nordisk B', ticker: 'NOVO-B.CO', weight: 9.49 },
      { name: 'Vestas Wind', ticker: 'VWS.CO', weight: 9.10 },
      { name: 'Novozymes', ticker: 'NZYM-B.CO', weight: 8.10 },
      { name: 'Genmab', ticker: 'GMAB.CO', weight: 7.38 },
      { name: 'Coloplast', ticker: 'COLO-B.CO', weight: 5.13 },
      { name: 'Oersted', ticker: 'ORSTED.CO', weight: 3.91 },
      { name: 'Pandora', ticker: 'PNDORA.CO', weight: 3.54 },
      { name: 'Moller Maersk B', ticker: 'MAERSK-B.CO', weight: 2.96 },
    ],
    geography: { Denmark: 100 },
    sectors: { Industrials: 36.84, Healthcare: 31.93, 'Financial Services': 19.21, 'Basic Materials': 6.63, Utilities: 3.45, 'Consumer Cyclical': 1.94 },
  },
  NORDNET_GLOBAL_125: {
    topHoldings: [
      { name: 'NVIDIA', ticker: 'NVDA', weight: 7.0 },
      { name: 'Apple', ticker: 'AAPL', weight: 6.4 },
      { name: 'Microsoft', ticker: 'MSFT', weight: 4.8 },
      { name: 'Amazon', ticker: 'AMZN', weight: 4.7 },
      { name: 'Tesla', ticker: 'TSLA', weight: 4.6 },
      { name: 'Broadcom', ticker: 'AVGO', weight: 3.2 },
      { name: 'Alphabet A', ticker: 'GOOGL', weight: 2.8 },
      { name: 'Alphabet C', ticker: 'GOOG', weight: 2.4 },
      { name: 'Meta Platforms', ticker: 'META', weight: 2.1 },
      { name: 'Eli Lilly', ticker: 'LLY', weight: 1.7 },
    ],
    geography: { US: 93.3, Eurozone: 10.7, Japan: 6.8, 'Europe ex-Eurozone': 5.2, UK: 3.8, Canada: 3.7, Australasia: 1.8 },
    sectors: { Technology: 35.7, 'Financial Services': 17.9, Healthcare: 15.9, Industrials: 11.9, 'Consumer Cyclical': 11.7, 'Communication Services': 10.4, 'Consumer Defensive': 7.5, 'Basic Materials': 4.5, Energy: 3.3, 'Real Estate': 2.8 },
  },
  NORDNET_GLOBAL_DKK: {
    topHoldings: [
      { name: 'NVIDIA', ticker: 'NVDA', weight: 5.47 },
      { name: 'Apple', ticker: 'AAPL', weight: 4.95 },
      { name: 'Microsoft', ticker: 'MSFT', weight: 3.69 },
      { name: 'Amazon', ticker: 'AMZN', weight: 3.63 },
      { name: 'Tesla', ticker: 'TSLA', weight: 3.59 },
      { name: 'Broadcom', ticker: 'AVGO', weight: 2.47 },
      { name: 'Alphabet A', ticker: 'GOOGL', weight: 2.21 },
      { name: 'Alphabet C', ticker: 'GOOG', weight: 1.85 },
      { name: 'Meta Platforms', ticker: 'META', weight: 1.63 },
      { name: 'Eli Lilly', ticker: 'LLY', weight: 1.34 },
    ],
    geography: { US: 73.28, Eurozone: 8.4, Japan: 5.37, 'Europe ex-Eurozone': 4.12, UK: 2.98 },
    sectors: { Technology: 29.55, 'Financial Services': 15.17, 'Consumer Cyclical': 12.5, Healthcare: 11.99, Industrials: 9.33, 'Communication Services': 9.09, 'Consumer Defensive': 3.62, 'Real Estate': 2.93, Utilities: 2.91, 'Basic Materials': 2.33, Energy: 0.57 },
  },
  NORDNET_EM_IDX: {
    topHoldings: [
      { name: 'TSMC', ticker: 'TSM', weight: 13.8 },
      { name: 'Alibaba', ticker: 'BABA', weight: 5.6 },
      { name: 'Tencent', ticker: '0700.HK', weight: 4.59 },
      { name: 'SK Hynix', ticker: '000660.KS', weight: 3.68 },
      { name: 'Samsung Electronics', ticker: '005930.KS', weight: 1.69 },
      { name: 'Xiaomi', ticker: '1810.HK', weight: 1.47 },
      { name: 'MediaTek', ticker: '2454.TW', weight: 1.47 },
      { name: 'Delta Electronics', ticker: '2308.TW', weight: 1.23 },
      { name: 'BYD Company', ticker: '1211.HK', weight: 1.11 },
      { name: 'PDD (Pinduoduo)', ticker: 'PDD', weight: 0.96 },
    ],
    geography: { 'Emerging Asia': 42.07, 'Asia Developed': 38.74, 'Latin America': 5.78, 'Middle East': 5.15, Africa: 3.36 },
    sectors: { Technology: 36.27, 'Financial Services': 21.05, 'Consumer Cyclical': 12.55, 'Communication Services': 8.3, Industrials: 5.95, Healthcare: 4.65, 'Basic Materials': 3.39, 'Consumer Defensive': 3.2, 'Real Estate': 2.48, Utilities: 1.27, Energy: 0.89 },
  },
  NORDNET_TECH_IDX: {
    topHoldings: [
      { name: 'Apple', ticker: 'AAPL', weight: 10.06 },
      { name: 'Microsoft', ticker: 'MSFT', weight: 10.04 },
      { name: 'NVIDIA', ticker: 'NVDA', weight: 9.69 },
      { name: 'Broadcom', ticker: 'AVGO', weight: 7.50 },
      { name: 'Meta Platforms', ticker: 'META', weight: 6.71 },
      { name: 'Alphabet A', ticker: 'GOOGL', weight: 5.44 },
      { name: 'Alphabet C', ticker: 'GOOG', weight: 4.54 },
      { name: 'ASML Holding', ticker: 'ASML', weight: 2.70 },
      { name: 'Micron Technology', ticker: 'MU', weight: 2.05 },
      { name: 'Palantir', ticker: 'PLTR', weight: 1.80 },
    ],
    geography: { US: 88.83, Eurozone: 4.97, Japan: 3.38, Canada: 1.29, 'Emerging Asia': 0.4 },
    sectors: { Technology: 79.72, 'Communication Services': 19.87, Industrials: 0.35, 'Consumer Cyclical': 0.06 },
  },
};

// ── 1. Portfolio → Formue Auto-Sync ──
// Keeps net-worth entries in sync with portfolio positions grouped by broker+account

function syncPortfolioToNetWorth() {
  const positions = APP_STATE.positions;
  const AUTO_PREFIX = '⚡ '; // marks auto-generated entries

  // Remove old auto-synced entries
  APP_STATE.entries = APP_STATE.entries.filter(e => !e.autoSynced);

  // Group positions by owner + broker + accountType
  const groups = {};
  positions.forEach(p => {
    const owner = p.owner || 'me';
    const key = `${owner}|${p.broker || 'other'}|${p.accountType || 'free'}`;
    if (!groups[key]) groups[key] = { broker: p.broker, accountType: p.accountType, owner, total: 0 };
    groups[key].total += (typeof toDKK === 'function') ? toDKK((p.shares || 0) * (p.currentPrice || 0), p.currency) : (p.shares || 0) * (p.currentPrice || 0);
  });

  const isEn = APP_STATE.lang === 'en';
  const brokerLabels = { saxo: 'Saxo', nordnet: 'Nordnet', lunar: 'Lunar', coinbase: 'Coinbase', revolut: 'Revolut', wise: 'Wise', kraken: 'Kraken', binance: 'Binance', crypto_com: 'Crypto.com', other: isEn ? 'Other' : 'Anden' };
  const accountLabels = { ask: 'ASK', free: isEn ? 'Free depot' : 'Frit depot', pension: 'Pension', isk: 'ISK', crypto: 'Crypto', other: isEn ? 'Other' : 'Anden' };

  Object.values(groups).forEach(g => {
    if (g.total <= 0) return;
    const broker = brokerLabels[g.broker] || g.broker || '—';
    const acct = accountLabels[g.accountType] || g.accountType || '—';
    APP_STATE.entries.push({
      id: crypto.randomUUID(),
      name: `${AUTO_PREFIX}${broker} — ${acct}`,
      amount: Math.round(g.total),
      type: 'asset',
      category: 'investment',
      autoSynced: true,
      broker: g.broker,
      accountType: g.accountType,
      owner: g.owner,
    });
  });

  saveData();
}

// ── 2. Live Price Fetching ──

async function fetchLivePrices() {
  // Also fetch FX rates in parallel
  if (typeof fetchFxRates === 'function') fetchFxRates().catch(() => {});

  const positions = APP_STATE.positions;
  if (!positions.length) return { updated: 0, failed: [] };

  // Skip proprietary fund tickers that aren't on Yahoo Finance (e.g. NORDNET_*)
  const isProprietaryTicker = (t) => /^NORDNET_/.test(t);
  const tickers = [...new Set(positions.map(p => p.ticker).filter(t => t && !isProprietaryTicker(t)))];
  if (!tickers.length) return { updated: 0, failed: [] };

  try {
    const resp = await fetch('/api/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers }),
    });
    const prices = await resp.json();
    if (prices.error) throw new Error(prices.error);

    let updated = 0;
    const failed = [];

    tickers.forEach(ticker => {
      const pd = prices[ticker];
      if (pd && pd.price) {
        positions.forEach(p => {
          if (p.ticker === ticker) {
            const oldPrice = p.currentPrice;
            p.currentPrice = pd.price;
            p.priceCurrency = pd.currency;
            if (pd.name && !p.name) p.name = pd.name;

            // Use server-provided change data if available, otherwise compute from old price
            if (pd.previousClose) {
              p.previousClose = pd.previousClose;
              p.priceChangePercent = pd.changePercent;
            } else if (pd.changePercent != null) {
              p.priceChangePercent = pd.changePercent;
            } else if (oldPrice && oldPrice !== pd.price) {
              // Fallback: compute change from the previous stored price
              p.priceChangePercent = Math.round(((pd.price - oldPrice) / oldPrice) * 10000) / 100;
            }

            // Store extended data if provided
            if (pd.history) p.history = pd.history;
            if (pd.fiftyTwoWeekHigh) p.fiftyTwoWeekHigh = pd.fiftyTwoWeekHigh;
            if (pd.fiftyTwoWeekLow) p.fiftyTwoWeekLow = pd.fiftyTwoWeekLow;
          }
        });
        updated++;
      } else {
        failed.push(ticker);
      }
    });

    APP_STATE.lastPriceUpdate = new Date().toISOString();
    saveData();
    if (typeof renderAll === 'function') renderAll();
    return { updated, failed };
  } catch (err) {
    console.error('Price fetch error:', err);
    return { updated: 0, failed: tickers, error: err.message };
  }
}

// ── 3. Overlap Analysis Engine ──

async function runOverlapAnalysis() {
  const positions = APP_STATE.positions;
  if (positions.length < 2) return null;

  const posData = positions.map(p => ({
    ticker: p.ticker,
    name: p.name,
    type: p.type,
    shares: p.shares,
    currentPrice: p.currentPrice,
    value: posValDKK(p),
  }));

  // Check if all positions are Nordnet proprietary funds with static data
  const allHaveStaticData = positions.every(p => NORDNET_FUND_DATA[p.ticker]);

  // If we have static data for all funds, compute overlap locally (no API call needed)
  if (allHaveStaticData) {
    const data = computeLocalOverlap(positions);
    APP_STATE.overlapData = data;
    saveData();
    return data;
  }

  try {
    // Include static fund data in the API request so the AI knows these funds
    const staticHints = positions
      .filter(p => NORDNET_FUND_DATA[p.ticker])
      .map(p => `\nKNOWN DATA for ${p.ticker} (${p.name}):\n  Top holdings: ${NORDNET_FUND_DATA[p.ticker].topHoldings.map(h => h.name + ' ' + h.weight + '%').join(', ')}\n  Sectors: ${Object.entries(NORDNET_FUND_DATA[p.ticker].sectors).map(([k,v]) => k + ' ' + v + '%').join(', ')}\n  Geography: ${Object.entries(NORDNET_FUND_DATA[p.ticker].geography).map(([k,v]) => k + ' ' + v + '%').join(', ')}`)
      .join('\n');

    const resp = await fetch('/api/overlap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions: posData, staticFundHints: staticHints }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);

    APP_STATE.overlapData = data;
    saveData();
    return data;
  } catch (err) {
    console.error('Overlap analysis error:', err);
    throw err;
  }
}

// Compute overlap analysis locally using static fund data (no API needed)
function computeLocalOverlap(positions) {
  const totalValue = positions.reduce((s, p) => s + posValDKK(p), 0);
  const holdings = {};
  const aggregatedSectors = {};
  const aggregatedGeo = {};
  const aggregatedTopHoldings = {};

  positions.forEach(p => {
    const fd = NORDNET_FUND_DATA[p.ticker];
    if (!fd) return;
    const weight = totalValue > 0 ? posValDKK(p) / totalValue : 0;

    holdings[p.ticker] = fd;

    // Weighted sector aggregation
    Object.entries(fd.sectors).forEach(([sector, pct]) => {
      aggregatedSectors[sector] = (aggregatedSectors[sector] || 0) + pct * weight;
    });

    // Weighted geo aggregation
    Object.entries(fd.geography).forEach(([geo, pct]) => {
      aggregatedGeo[geo] = (aggregatedGeo[geo] || 0) + pct * weight;
    });

    // Weighted top holdings
    fd.topHoldings.forEach(h => {
      const key = h.ticker || h.name;
      if (!aggregatedTopHoldings[key]) {
        aggregatedTopHoldings[key] = { name: h.name, ticker: h.ticker, weight: 0 };
      }
      aggregatedTopHoldings[key].weight += h.weight * weight;
    });
  });

  // Compute overlap matrix based on shared holdings
  const tickers = positions.map(p => p.ticker);
  const overlapMatrix = {};
  for (let i = 0; i < tickers.length; i++) {
    overlapMatrix[tickers[i]] = {};
    for (let j = 0; j < tickers.length; j++) {
      if (i === j) continue;
      const fd1 = NORDNET_FUND_DATA[tickers[i]];
      const fd2 = NORDNET_FUND_DATA[tickers[j]];
      if (!fd1 || !fd2) { overlapMatrix[tickers[i]][tickers[j]] = 0; continue; }
      // Overlap = sum of min weights for shared holdings
      let overlap = 0;
      fd1.topHoldings.forEach(h1 => {
        const h2 = fd2.topHoldings.find(h => h.ticker === h1.ticker || h.name === h1.name);
        if (h2) overlap += Math.min(h1.weight, h2.weight);
      });
      overlapMatrix[tickers[i]][tickers[j]] = Math.round(overlap * 10) / 10;
    }
  }

  const sortedTopHoldings = Object.values(aggregatedTopHoldings)
    .sort((a, b) => b.weight - a.weight)
    .map(h => ({ ...h, weight: Math.round(h.weight * 100) / 100 }));

  return {
    holdings,
    overlapMatrix,
    aggregated: {
      sectors: aggregatedSectors,
      geo: aggregatedGeo,
      geography: aggregatedGeo,
      topHoldings: sortedTopHoldings,
    },
  };
}

function renderOverlapMatrix(data) {
  const container = document.getElementById('overlap-matrix');
  if (!container || !data || !data.overlapMatrix) return;

  const tickers = Object.keys(data.overlapMatrix);
  if (tickers.length < 2) return;

  // Build matrix HTML
  let html = '<table class="overlap-table"><thead><tr><th></th>';
  tickers.forEach(t => { html += `<th>${escapeHTML(t)}</th>`; });
  html += '</tr></thead><tbody>';

  tickers.forEach(t1 => {
    html += `<tr><td class="row-label"><strong>${escapeHTML(t1)}</strong></td>`;
    tickers.forEach(t2 => {
      if (t1 === t2) {
        html += '<td class="overlap-self">—</td>';
      } else {
        const val = (data.overlapMatrix[t1] && data.overlapMatrix[t1][t2]) ||
                    (data.overlapMatrix[t2] && data.overlapMatrix[t2][t1]) || 0;
        const color = val > 30 ? 'var(--rose-400)' : val > 15 ? 'var(--amber-400)' : 'var(--emerald-400)';
        html += `<td style="color:${color};font-weight:600">${val.toFixed(1)}%</td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderSectorChart(data) {
  const canvas = document.getElementById('chart-sectors');
  if (!canvas || !data || !data.aggregated || !data.aggregated.sectors) return;

  const sectors = data.aggregated.sectors;
  const labels = Object.keys(sectors);
  const values = Object.values(sectors);
  const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#60a5fa', '#38bdf8', '#22d3ee', '#2dd4bf', '#34d399'];

  if (window._sectorChart) window._sectorChart.destroy();
  window._sectorChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: 'var(--text-secondary)', font: { size: 11 } } },
      },
    },
  });
}

function renderGeoChart(data) {
  const canvas = document.getElementById('chart-geo');
  if (!canvas || !data || !data.aggregated || !data.aggregated.geography) return;

  const geo = data.aggregated.geography;
  const labels = Object.keys(geo);
  const values = Object.values(geo);
  const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#60a5fa', '#38bdf8', '#22d3ee'];

  if (window._geoChart) window._geoChart.destroy();
  window._geoChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: 'var(--text-secondary)', font: { size: 11 } } },
      },
    },
  });
}

// ── 4. Scoring Engine (Bogle-style) ──

function computePortfolioScore() {
  const positions = APP_STATE.positions;
  if (!positions.length) return null;

  const totalValue = positions.reduce((s, p) => s + posValDKK(p), 0);
  if (totalValue <= 0) return null;

  const philosophy = APP_STATE.philosophy || 'bogle';
  const isEn = APP_STATE.lang === 'en';

  // ── Shared metrics ──
  const numPositions = positions.length;
  const weights = positions.map(p => posValDKK(p) / totalValue);
  const hhi = weights.reduce((s, w) => s + w * w, 0); // Herfindahl index
  const topWeight = Math.max(...weights);
  const etfRatio = positions.reduce((s, p) => s + ((p.type === 'etf' || p.type === 'fund') ? posValDKK(p) : 0), 0) / totalValue;
  const stockRatio = positions.reduce((s, p) => s + ((p.type === 'stock') ? posValDKK(p) : 0), 0) / totalValue;

  const brokerCounts = {};
  const accountCounts = {};
  positions.forEach(p => {
    brokerCounts[p.broker || 'other'] = (brokerCounts[p.broker || 'other'] || 0) + 1;
    accountCounts[p.accountType || 'free'] = (accountCounts[p.accountType || 'free'] || 0) + 1;
  });

  let geoRaw = 10;
  let geoRegions = 0;
  let geoMaxConc = 100;
  if (APP_STATE.overlapData?.aggregated?.geography) {
    const geo = APP_STATE.overlapData.aggregated.geography;
    geoRegions = Object.keys(geo).length;
    geoMaxConc = Math.max(...Object.values(geo));
    geoRaw = Math.min(25, Math.round((geoRegions >= 4 ? 10 : geoRegions * 2.5) + ((100 - geoMaxConc) / 100 * 15)));
  }

  // ── Philosophy-specific scoring ──
  const CONFIGS = {
    bogle: {
      name: { en: 'Bogle — Index investing', da: 'Bogle — Indeksinvestering' },
      dims: [
        { key: 'diversification', weight: 30, label: { en: 'Diversification', da: 'Diversificering' } },
        { key: 'lowCost',         weight: 30, label: { en: 'Low cost / Passive', da: 'Lave omkostninger' } },
        { key: 'accountOpt',      weight: 20, label: { en: 'Account optimization', da: 'Kontooptimering' } },
        { key: 'geoSpread',       weight: 20, label: { en: 'Geographic spread', da: 'Geografisk spredning' } },
      ],
    },
    buffett: {
      name: { en: 'Buffett — Value investing', da: 'Buffett — Værdiinvestering' },
      dims: [
        { key: 'concentration',  weight: 30, label: { en: 'Conviction / Focus', da: 'Overbevisning / Fokus' } },
        { key: 'quality',        weight: 30, label: { en: 'Quality holdings', da: 'Kvalitetsaktier' } },
        { key: 'accountOpt',     weight: 20, label: { en: 'Account optimization', da: 'Kontooptimering' } },
        { key: 'patience',       weight: 20, label: { en: 'Long-term mindset', da: 'Langsigtet tilgang' } },
      ],
    },
    dalio: {
      name: { en: 'Dalio — All-Weather', da: 'Dalio — All-Weather' },
      dims: [
        { key: 'assetBalance',   weight: 30, label: { en: 'Asset class balance', da: 'Aktivklasse-balance' } },
        { key: 'geoSpread',      weight: 25, label: { en: 'Geographic spread', da: 'Geografisk spredning' } },
        { key: 'riskParity',     weight: 25, label: { en: 'Risk parity', da: 'Risikoparitet' } },
        { key: 'accountOpt',     weight: 20, label: { en: 'Account optimization', da: 'Kontooptimering' } },
      ],
    },
    lynch: {
      name: { en: 'Lynch — Growth at fair price', da: 'Lynch — Vækst til fair pris' },
      dims: [
        { key: 'growthMix',      weight: 30, label: { en: 'Growth exposure', da: 'Væksteksponering' } },
        { key: 'diversification',weight: 25, label: { en: 'Diversification', da: 'Diversificering' } },
        { key: 'accountOpt',     weight: 20, label: { en: 'Account optimization', da: 'Kontooptimering' } },
        { key: 'geoSpread',      weight: 25, label: { en: 'Geographic spread', da: 'Geografisk spredning' } },
      ],
    },
  };

  // ── Compute raw dimension scores (0-100 scale, then weighted) ──
  function dimScore(key) {
    switch (key) {
      case 'diversification': {
        // Bogle/Lynch: broad = good. More positions, lower HHI = better
        const breadth = Math.min(40, numPositions * 4);
        const spread = (1 - hhi) * 60;
        const raw = Math.min(100, Math.round(breadth + spread));
        return { raw, detail: isEn ? `${numPositions} positions, HHI ${(hhi*100).toFixed(0)}%` : `${numPositions} positioner, HHI ${(hhi*100).toFixed(0)}%` };
      }
      case 'lowCost': {
        // Bogle: ETFs/funds = great, stocks = mediocre
        const raw = Math.round(etfRatio * 100);
        return { raw, detail: isEn ? `${(etfRatio*100).toFixed(0)}% in ETFs/funds` : `${(etfRatio*100).toFixed(0)}% i ETF'er/fonde` };
      }
      case 'concentration': {
        // Buffett: concentrated = good (opposite of diversification)
        // Ideal: 5-15 positions with high-conviction bets
        const idealCount = numPositions >= 5 && numPositions <= 15;
        const highConviction = topWeight >= 0.10; // top position at least 10%
        const raw = Math.min(100, Math.round(
          (idealCount ? 40 : (numPositions < 5 ? 30 : Math.max(0, 40 - (numPositions - 15) * 3))) +
          (highConviction ? 30 : 10) +
          (hhi >= 0.05 ? Math.min(30, hhi * 200) : 10) // reward concentration
        ));
        return { raw, detail: isEn ? `Top holding ${(topWeight*100).toFixed(0)}%, ${numPositions} positions` : `Største position ${(topWeight*100).toFixed(0)}%, ${numPositions} positioner` };
      }
      case 'quality': {
        // Buffett: stocks > ETFs, fewer crypto/other = better
        const raw = Math.min(100, Math.round(stockRatio * 80 + (1 - (positions.filter(p=>p.type==='crypto'||p.type==='other').length / Math.max(1, numPositions))) * 20));
        return { raw, detail: isEn ? `${(stockRatio*100).toFixed(0)}% individual stocks` : `${(stockRatio*100).toFixed(0)}% individuelle aktier` };
      }
      case 'patience': {
        // Buffett: having fewer positions and holding = patience indicator
        // Approximate: fewer recent additions, stable holdings
        const raw = Math.min(100, Math.round(
          (numPositions <= 20 ? 50 : Math.max(10, 50 - (numPositions - 20) * 3)) +
          (topWeight >= 0.15 ? 30 : 15) + // high-conviction = patient
          (accountCounts.ask || accountCounts.pension ? 20 : 5) // long-term accounts
        ));
        return { raw, detail: isEn ? `${numPositions} holdings, long-term accounts: ${accountCounts.ask ? 'ASK ✓' : '—'}` : `${numPositions} beholdninger, langsigtede konti: ${accountCounts.ask ? 'ASK ✓' : '—'}` };
      }
      case 'assetBalance': {
        // Dalio: wants stocks + bonds + alternatives. All stocks = bad
        const bondRatio = positions.reduce((s, p) => s + ((p.type === 'bond') ? posValDKK(p) : 0), 0) / totalValue;
        const hasStocks = stockRatio > 0 || etfRatio > 0;
        const hasBonds = bondRatio > 0;
        const typeCount = new Set(positions.map(p => p.type)).size;
        const raw = Math.min(100, Math.round(
          (hasBonds ? 40 : 5) +
          (hasStocks ? 20 : 0) +
          (typeCount >= 3 ? 25 : typeCount * 8) +
          (bondRatio >= 0.2 && bondRatio <= 0.5 ? 15 : bondRatio > 0 ? 8 : 0)
        ));
        return { raw, detail: isEn ? `${typeCount} asset types, ${(bondRatio*100).toFixed(0)}% bonds` : `${typeCount} aktivtyper, ${(bondRatio*100).toFixed(0)}% obligationer` };
      }
      case 'riskParity': {
        // Dalio: balanced risk across asset classes — penalize heavy concentration in one type
        const typeWeights = {};
        positions.forEach(p => {
          typeWeights[p.type] = (typeWeights[p.type] || 0) + posValDKK(p) / totalValue;
        });
        const maxTypeWeight = Math.max(...Object.values(typeWeights));
        const raw = Math.min(100, Math.round((1 - maxTypeWeight) * 100 + (Object.keys(typeWeights).length >= 3 ? 20 : 0)));
        return { raw, detail: isEn ? `Max type concentration: ${(maxTypeWeight*100).toFixed(0)}%` : `Maks. typekoncentration: ${(maxTypeWeight*100).toFixed(0)}%` };
      }
      case 'growthMix': {
        // Lynch: wants a mix of growth stocks + some stable. Individual stocks preferred
        const raw = Math.min(100, Math.round(
          stockRatio * 70 + // individual stock picking is Lynch's way
          (numPositions >= 8 && numPositions <= 30 ? 20 : 10) + // reasonable count
          (etfRatio <= 0.3 ? 10 : 0) // not too much passive
        ));
        return { raw, detail: isEn ? `${(stockRatio*100).toFixed(0)}% stocks, ${numPositions} picks` : `${(stockRatio*100).toFixed(0)}% aktier, ${numPositions} valg` };
      }
      case 'accountOpt': {
        let raw = 15; // base
        if (accountCounts.ask) raw += 35;
        if (Object.keys(brokerCounts).length >= 2) raw += 20;
        if (accountCounts.pension) raw += 20;
        raw = Math.min(100, raw + 10);
        return { raw, detail: isEn ? `${Object.keys(brokerCounts).length} broker(s), ${accountCounts.ask ? 'ASK ✓' : 'No ASK'}` : `${Object.keys(brokerCounts).length} mægler(e), ${accountCounts.ask ? 'ASK ✓' : 'Ingen ASK'}` };
      }
      case 'geoSpread': {
        const raw = Math.min(100, geoRaw * 4);
        return { raw, detail: APP_STATE.overlapData
          ? (isEn ? `${geoRegions} regions, max ${geoMaxConc.toFixed(0)}%` : `${geoRegions} regioner, maks ${geoMaxConc.toFixed(0)}%`)
          : (isEn ? 'Run overlap analysis for details' : 'Kør overlap-analyse for detaljer') };
      }
      default:
        return { raw: 50, detail: '' };
    }
  }

  const config = CONFIGS[philosophy] || CONFIGS.bogle;
  const scores = {};
  let totalWeighted = 0;

  config.dims.forEach(dim => {
    const { raw, detail } = dimScore(dim.key);
    const weighted = Math.round(raw * dim.weight / 100);
    scores[dim.key] = {
      score: weighted,
      max: dim.weight,
      label: dim.label[isEn ? 'en' : 'da'],
      detail,
      rawPercent: raw,
    };
    totalWeighted += weighted;
  });

  const total = totalWeighted;
  const label = total >= 80 ? (isEn ? 'Excellent' : 'Fremragende')
    : total >= 60 ? (isEn ? 'Good' : 'God')
    : total >= 40 ? (isEn ? 'Fair' : 'Rimelig')
    : (isEn ? 'Needs work' : 'Kan forbedres');

  return { total, max: 100, label, scores, philosophy, philosophyName: config.name[isEn ? 'en' : 'da'] };
}

function renderScoreGauge(scoreData) {
  if (!scoreData) return;

  // Large gauge on Score page
  const arc = document.getElementById('score-arc');
  const valueEl = document.getElementById('score-value');
  const labelEl = document.getElementById('score-label');
  if (arc && valueEl && labelEl) {
    const pct = scoreData.total / scoreData.max;
    arc.setAttribute('stroke-dasharray', `${pct * 251} 251`);
    valueEl.textContent = scoreData.total;
    labelEl.textContent = scoreData.label;
  }

  // Mini gauge on Overview
  const miniArc = document.getElementById('gauge-arc');
  const miniValue = document.getElementById('kpi-score-value');
  if (miniArc && miniValue) {
    const pct = scoreData.total / scoreData.max;
    miniArc.setAttribute('stroke-dasharray', `${pct * 157} 157`);
    miniValue.textContent = scoreData.total;
  }

  // Score breakdown
  const breakdown = document.getElementById('score-breakdown');
  if (breakdown && scoreData.scores) {
    breakdown.innerHTML = Object.values(scoreData.scores).map(s => `
      <div class="score-row">
        <div class="score-row-header">
          <span class="score-row-label">${s.label}</span>
          <span class="score-row-value">${s.score}/${s.max}</span>
        </div>
        <div class="score-bar-track">
          <div class="score-bar-fill" style="width:${(s.score / s.max * 100)}%;background:${s.score >= s.max * 0.7 ? 'var(--emerald-400)' : s.score >= s.max * 0.4 ? 'var(--amber-400)' : 'var(--rose-400)'}"></div>
        </div>
        <span class="score-row-detail">${s.detail}</span>
      </div>
    `).join('');
  }

  // Show/hide cards
  const scoreCard = document.getElementById('score-card');
  const scoreEmpty = document.getElementById('score-empty');
  if (scoreCard) scoreCard.hidden = false;
  if (scoreEmpty) scoreEmpty.hidden = true;
}

// ── 5. Rebalancing Engine ──

function computeRebalanceSuggestions() {
  const positions = APP_STATE.positions;
  if (!positions.length) return [];

  const isEn = APP_STATE.lang === 'en';
  const totalValue = positions.reduce((s, p) => s + posValDKK(p), 0);
  if (totalValue <= 0) return [];

  const suggestions = [];

  // Bogle-style target: broad index ETFs, low concentration, use ASK
  const weights = positions.map(p => {
    const val = posValDKK(p);
    return { ...p, value: val, weight: val / totalValue * 100 };
  });

  // 1. Concentration warnings (any position > 30%)
  weights.filter(p => p.weight > 30).forEach(p => {
    suggestions.push({
      type: 'warning',
      priority: 'high',
      title: isEn ? `${p.ticker} is ${p.weight.toFixed(0)}% of portfolio` : `${p.ticker} udgør ${p.weight.toFixed(0)}% af porteføljen`,
      detail: isEn
        ? `Consider reducing to under 25% for better diversification. Current value: ${formatCurrency(p.value)}`
        : `Overvej at reducere til under 25% for bedre diversificering. Nuværende værdi: ${formatCurrency(p.value)}`,
      ticker: p.ticker,
    });
  });

  // 2. ASK usage recommendation
  const hasAsk = positions.some(p => p.accountType === 'ask');
  const freeDepotTotal = weights.filter(p => p.accountType === 'free').reduce((s, p) => s + p.value, 0);
  if (!hasAsk && freeDepotTotal > 0) {
    suggestions.push({
      type: 'tax',
      priority: 'high',
      title: isEn ? 'Open an ASK (Aktiesparekonto)' : 'Åbn en ASK (Aktiesparekonto)',
      detail: isEn
        ? `You have ${formatCurrency(freeDepotTotal)} in free depot. ASK is taxed at only 17% vs. 27-42% for free depot.`
        : `Du har ${formatCurrency(freeDepotTotal)} i frit depot. ASK beskattes kun med 17% mod 27-42% for frit depot.`,
    });
  }

  // 3. ASK max check (2026 limit: 135.900 DKK deposits)
  const askValue = weights.filter(p => p.accountType === 'ask').reduce((s, p) => s + p.value, 0);
  if (askValue > 0) {
    const ASK_LIMIT = 135900;
    const pctUsed = (askValue / ASK_LIMIT * 100);
    if (pctUsed < 80) {
      suggestions.push({
        type: 'tax',
        priority: 'medium',
        title: isEn ? `ASK only ${pctUsed.toFixed(0)}% utilized` : `ASK kun ${pctUsed.toFixed(0)}% udnyttet`,
        detail: isEn
          ? `Your ASK value is ${formatCurrency(askValue)}. Max deposit limit is ${formatCurrency(ASK_LIMIT)}. Consider adding more.`
          : `Din ASK-værdi er ${formatCurrency(askValue)}. Maks. indskudsgrænse er ${formatCurrency(ASK_LIMIT)}. Overvej at tilføje mere.`,
      });
    }
  }

  // 4. Single-stock risk
  const stocks = weights.filter(p => p.type === 'stock');
  if (stocks.length > 0) {
    const stockPct = stocks.reduce((s, p) => s + p.weight, 0);
    if (stockPct > 20) {
      suggestions.push({
        type: 'risk',
        priority: 'medium',
        title: isEn ? `${stockPct.toFixed(0)}% in individual stocks` : `${stockPct.toFixed(0)}% i enkeltaktier`,
        detail: isEn
          ? 'Bogle philosophy recommends index funds over individual stocks for most of your portfolio.'
          : 'Bogle-filosofien anbefaler indeksfonde fremfor enkeltaktier for størstedelen af din portefølje.',
      });
    }
  }

  // 5. Crypto warning
  const crypto = weights.filter(p => p.type === 'crypto');
  if (crypto.length > 0) {
    const cryptoPct = crypto.reduce((s, p) => s + p.weight, 0);
    if (cryptoPct > 5) {
      suggestions.push({
        type: 'risk',
        priority: 'low',
        title: isEn ? `${cryptoPct.toFixed(0)}% in crypto` : `${cryptoPct.toFixed(0)}% i krypto`,
        detail: isEn
          ? 'Consider limiting crypto to 5% or less of total portfolio.'
          : 'Overvej at begrænse krypto til 5% eller mindre af den samlede portefølje.',
      });
    }
  }

  // 6. Overlap-based suggestions
  if (APP_STATE.overlapData && APP_STATE.overlapData.overlapMatrix) {
    const matrix = APP_STATE.overlapData.overlapMatrix;
    const seen = new Set();
    Object.keys(matrix).forEach(t1 => {
      Object.keys(matrix[t1]).forEach(t2 => {
        const pairKey = [t1, t2].sort().join('|');
        if (t1 !== t2 && !seen.has(pairKey) && matrix[t1][t2] > 40) {
          seen.add(pairKey);
          suggestions.push({
            type: 'overlap',
            priority: 'medium',
            title: isEn ? `High overlap: ${t1} & ${t2}` : `Højt overlap: ${t1} & ${t2}`,
            detail: isEn
              ? `${matrix[t1][t2].toFixed(0)}% overlap. Consider consolidating into one to reduce redundancy.`
              : `${matrix[t1][t2].toFixed(0)}% overlap. Overvej at samle i én for at reducere redundans.`,
          });
        }
      });
    });
  }

  // Sort by priority: high first, then medium, then low
  const highItems = suggestions.filter(s => s.priority === 'high');
  const mediumItems = suggestions.filter(s => s.priority === 'medium');
  const lowItems = suggestions.filter(s => s.priority === 'low');

  return [...highItems, ...mediumItems, ...lowItems];
}

function renderRebalanceSuggestions(suggestions) {
  const container = document.getElementById('rebalance-suggestions');
  const empty = document.getElementById('rebalance-empty');
  if (!container) return;

  if (!suggestions || !suggestions.length) {
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  const isEn = APP_STATE.lang === 'en';

  const typeIcons = {
    warning: '⚠️',
    tax: '🏛️',
    risk: '📊',
    overlap: '🔄',
  };
  const priorityColors = {
    high: 'var(--rose-400)',
    medium: 'var(--amber-400)',
    low: 'var(--emerald-400)',
  };
  const priorityLabels = {
    high: isEn ? 'High' : 'Høj',
    medium: isEn ? 'Medium' : 'Mellem',
    low: isEn ? 'Low' : 'Lav',
  };

  container.innerHTML = suggestions.map(s => `
    <div class="card suggestion-card">
      <div class="suggestion-header">
        <span class="suggestion-icon">${typeIcons[s.type] || '💡'}</span>
        <h4 class="suggestion-title">${escapeHTML(s.title)}</h4>
        <span class="badge" style="color:${priorityColors[s.priority]};border-color:${priorityColors[s.priority]}">${priorityLabels[s.priority]}</span>
      </div>
      <p class="suggestion-detail">${escapeHTML(s.detail)}</p>
    </div>
  `).join('');
}

// ── 6. Broker/Account KPI Breakdown ──

function renderBrokerBreakdown() {
  const wrapper = document.getElementById('broker-breakdown');
  const container = document.getElementById('broker-breakdown-content');
  if (!container || !wrapper) return;

  const positions = APP_STATE.positions;
  if (!positions.length) {
    wrapper.hidden = true;
    return;
  }

  wrapper.hidden = false;
  const isEn = APP_STATE.lang === 'en';
  const brokerLabels = { saxo: 'Saxo', nordnet: 'Nordnet', lunar: 'Lunar', other: isEn ? 'Other' : 'Anden' };
  const accountLabels = { ask: 'ASK', free: isEn ? 'Free depot' : 'Frit depot', pension: 'Pension', isk: 'ISK', other: isEn ? 'Other' : 'Anden' };

  const groups = {};
  positions.forEach(p => {
    const key = `${p.broker || 'other'}|${p.accountType || 'free'}`;
    if (!groups[key]) groups[key] = { broker: p.broker, accountType: p.accountType, total: 0, count: 0 };
    groups[key].total += (typeof toDKK === 'function') ? toDKK((p.shares || 0) * (p.currentPrice || 0), p.currency) : (p.shares || 0) * (p.currentPrice || 0);
    groups[key].count++;
  });

  const totalValue = Object.values(groups).reduce((s, g) => s + g.total, 0);
  const colors = ['var(--brand-400)', 'var(--emerald-400)', 'var(--amber-400)', 'var(--rose-400)', 'var(--sky-400)'];

  let html = '<div class="broker-bars">';
  Object.values(groups)
    .sort((a, b) => b.total - a.total)
    .forEach((g, i) => {
      const broker = brokerLabels[g.broker] || g.broker || '—';
      const acct = accountLabels[g.accountType] || g.accountType || '—';
      const pct = totalValue > 0 ? (g.total / totalValue * 100) : 0;
      html += `
        <div class="broker-row">
          <div class="broker-row-header">
            <span><strong>${escapeHTML(broker)}</strong> — ${escapeHTML(acct)}</span>
            <span>${formatCurrency(g.total)} <span style="opacity:0.6">(${pct.toFixed(0)}%)</span></span>
          </div>
          <div class="broker-bar-track">
            <div class="broker-bar-fill" style="width:${pct}%;background:${colors[i % colors.length]}"></div>
          </div>
          <span style="font-size:0.8em;color:var(--text-tertiary)">${g.count} ${isEn ? 'positions' : 'positioner'}</span>
        </div>`;
    });
  html += '</div>';
  container.innerHTML = html;
}

// ── 8. Pension Projection Engine ──
function computePensionProjection(currentValue, monthlyContribution, employerMatch, retirementAge, currentAge) {
  currentAge = currentAge || 30;
  retirementAge = retirementAge || 67;
  const yearsToRetire = Math.max(1, retirementAge - currentAge);
  const totalMonthly = (monthlyContribution || 0) * (1 + (employerMatch || 0) / 100);

  const scenarios = [
    { rate: 0.04, label: 'Conservative (4%)' , labelDa: 'Konservativ (4%)' },
    { rate: 0.07, label: 'Moderate (7%)'     , labelDa: 'Moderat (7%)' },
    { rate: 0.10, label: 'Aggressive (10%)'  , labelDa: 'Aggressiv (10%)' },
  ];

  return scenarios.map(s => {
    const monthlyRate = s.rate / 12;
    const points = [];
    let balance = currentValue || 0;
    for (let y = 0; y <= yearsToRetire; y++) {
      points.push({ year: currentAge + y, value: Math.round(balance) });
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + monthlyRate) + totalMonthly;
      }
    }
    return {
      ...s,
      points,
      finalValue: Math.round(balance),
      totalContributed: Math.round((currentValue || 0) + totalMonthly * 12 * yearsToRetire),
      totalGrowth: Math.round(balance - (currentValue || 0) - totalMonthly * 12 * yearsToRetire),
    };
  });
}

// ── 9. Mortgage / Home Equity Engine ──
function computeMortgageProjection(propertyValue, mortgageBalance, interestRate, monthlyPayment, remainingYears) {
  if (!propertyValue || !mortgageBalance) return null;

  const equity = propertyValue - mortgageBalance;
  const equityPct = propertyValue > 0 ? (equity / propertyValue * 100) : 0;
  const ltv = propertyValue > 0 ? (mortgageBalance / propertyValue * 100) : 0;

  const monthlyRate = (interestRate || 3) / 100 / 12;
  const totalMonths = (remainingYears || 25) * 12;

  const points = [];
  let balance = mortgageBalance;
  const payment = monthlyPayment || (balance * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);

  for (let y = 0; y <= (remainingYears || 25); y++) {
    const eq = propertyValue - Math.max(0, balance);
    points.push({ year: y, equity: Math.round(eq), debt: Math.round(Math.max(0, balance)), property: propertyValue });
    for (let m = 0; m < 12; m++) {
      const interest = balance * monthlyRate;
      const principal = Math.max(0, payment - interest);
      balance = Math.max(0, balance - principal);
    }
  }

  return {
    propertyValue,
    mortgageBalance,
    equity: Math.round(equity),
    equityPct: Math.round(equityPct * 10) / 10,
    ltv: Math.round(ltv * 10) / 10,
    monthlyPayment: Math.round(payment),
    totalInterest: Math.round(payment * totalMonths - mortgageBalance),
    points,
  };
}
