/* global React, ReactDOM, Icon, Sparkline, Gauge, Donut, AreaChart */
const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ── Globals from existing code ──
// APP_STATE, formatCurrency, formatPct, escapeHTML, t, applyTranslations
// syncPortfolioToNetWorth, fetchLivePrices, runOverlapAnalysis
// computePortfolioScore, computeRebalanceSuggestions, renderSectorChart, renderGeoChart

// ==========================================================================
// NAV CONFIG
// ==========================================================================
const NAV = [
  { id: "overview",  icon: "grid",    label: { en: "Overview", da: "Overblik" } },
  { id: "accounts",  icon: "layers",  label: { en: "Accounts", da: "Konti" } },
  { id: "huginn",    icon: "message", label: { en: "Huginn", da: "Huginn" } },
  { id: "settings",  icon: "settings", label: { en: "Settings", da: "Indstillinger" } },
];

// ==========================================================================
// HELPERS
// ==========================================================================
function useAppState() {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  return { state: window.APP_STATE, refresh, tick };
}

function fmtC(amount) {
  return window.formatCurrency ? window.formatCurrency(amount) : `${Math.round(amount).toLocaleString()} kr.`;
}
function fmtP(val, d = 1) {
  return window.formatPct ? window.formatPct(val, d) : val.toFixed(d) + "%";
}
function tl(key) {
  return window.t ? window.t(key) : key;
}
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function isEn() { return window.APP_STATE?.lang === 'en'; }

// ==========================================================================
// HOUSEHOLD MEMBERS
// ==========================================================================
// Each member: { id, name, relation: 'partner'|'child', dob?: 'YYYY-MM-DD' }
// "me" is always the primary user, never stored in the array.
function loadHousehold() {
  try { return JSON.parse(localStorage.getItem('pi-household')) || []; } catch { return []; }
}
function saveHousehold(members) {
  try { localStorage.setItem('pi-household', JSON.stringify(members)); } catch {}
}
function getMemberLabel(id, members) {
  if (id === 'me') return isEn() ? 'Me' : 'Mig';
  if (id === 'household') return isEn() ? 'Household' : 'Husstand';
  const m = members.find(m => m.id === id);
  return m ? m.name : id;
}
function getMemberIcon(id, members) {
  if (id === 'me') return 'user';
  if (id === 'household') return 'users';
  const m = members.find(m => m.id === id);
  return m?.relation === 'child' ? 'baby' : 'user';
}

const TICKER_COLORS = [
  "#4285F4","#FF9900","#000","#7c3aed","#1e40af","#db2777","#0ea5e9","#4267B2",
  "#16a34a","#f59e0b","#059669","#dc2626","#0f766e","#eab308","#22c55e","#1e293b",
  "#475569","#64748b","#94a3b8","#6366f1"
];
function tickerColor(idx) { return TICKER_COLORS[idx % TICKER_COLORS.length]; }

// ==========================================================================
// AUTH SCREEN
// ==========================================================================
const AuthScreen = ({ onLogin }) => {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    APP_STATE.user = { email: email || "demo@portfolio.dk", id: "demo-" + Date.now() };
    APP_STATE.demoMode = true;
    onLogin();
  };

  const handleDemo = () => {
    APP_STATE.user = { email: "demo@portfolio.dk", id: "demo-" + Date.now() };
    APP_STATE.demoMode = true;
    onLogin();
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="brand" style={{justifyContent:"center", borderBottom:"none", paddingBottom:8, marginBottom:8}}>
          <div className="brand-mark">P</div>
          <div className="brand-name">Portfolio<small>Intelligence</small></div>
        </div>
        <h2 style={{fontFamily:"var(--font-display)", fontSize:28, textAlign:"center", margin:"0 0 4px"}}>
          {tl("auth.subtitle")}
        </h2>
        <div className="auth-tabs">
          <button className={tab==="login"?"active":""} onClick={()=>setTab("login")}>{tl("auth.login")}</button>
          <button className={tab==="signup"?"active":""} onClick={()=>setTab("signup")}>{tl("auth.signup")}</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{tl("auth.email")}</label>
            <input type="email" placeholder="din@email.dk" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label>{tl("auth.password")}</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          {tab === "signup" && (
            <div className="form-group">
              <label>{tl("auth.confirmPassword")}</label>
              <input type="password" placeholder="••••••••" />
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full" style={{marginTop:8}}>
            {tab === "login" ? tl("auth.loginBtn") : tl("auth.signupBtn")}
          </button>
        </form>
        <div className="auth-footer">
          <button onClick={handleDemo}>{tl("auth.demoMode")}</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================================================
// OVERVIEW
// ==========================================================================
const Overview = ({ state, refresh, activeMember, privacyMode, navigateTo, sendQuickAsk }) => {
  const entries = state.entries || [];
  const positions = state.positions || [];

  const totalAssets = entries.filter(e=>e.type==="asset").reduce((s,e)=>s+e.amount, 0);
  const totalLiab = entries.filter(e=>e.type==="liability").reduce((s,e)=>s+e.amount, 0);
  const nw = totalAssets - totalLiab;
  const portfolioTotal = positions.reduce((s,p)=>s+toDKK((p.shares||0)*(p.currentPrice||0), p.currency), 0);

  // Cross-screen data: pension + home equity + investments
  const isHouseholdView = activeMember === 'household';
  const pensionTotal = entries.filter(e => e.category === 'pension').reduce((s, e) => s + (e.amount || 0), 0);
  // Property/mortgage are shared household assets — always read from raw state, not filtered
  const allEntries = window.APP_STATE?.entries || [];
  const propertyValueRaw = allEntries.filter(e => e.category === 'property').reduce((s, e) => s + (e.amount || 0), 0);
  const mortgageBalanceRaw = allEntries.filter(e => e.category === 'mortgage').reduce((s, e) => s + (e.amount || 0), 0);

  // Apply ownership split per member
  const propertySplit = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('pi-property-split')) || { me: 50 }; } catch { return { me: 50 }; }
  }, []);
  const hasPartnerMember = loadHousehold().some(m => m.relation === 'partner');
  const partnerMember = loadHousehold().find(m => m.relation === 'partner');
  const propSplitPct = useMemo(() => {
    if (!hasPartnerMember) return 100;
    if (isHouseholdView) return 100;
    if (activeMember === 'me' || !activeMember) return propertySplit.me ?? 50;
    if (partnerMember && activeMember === partnerMember.id) return 100 - (propertySplit.me ?? 50);
    return 0;
  }, [activeMember, isHouseholdView, hasPartnerMember, propertySplit]);

  const propertyValue = propertyValueRaw * propSplitPct / 100;
  const mortgageBalance = mortgageBalanceRaw * propSplitPct / 100;
  const homeEquity = propertyValue - mortgageBalance;
  const pensionConfigData = useMemo(() => {
    const loadCfg = (key) => {
      try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
    };
    if (isHouseholdView) {
      const myCfg = loadCfg('pi-pension-config');
      const hhMembers = loadHousehold();
      let totalLump = myCfg.lumpSum || 0;
      let totalMonthly = (myCfg.monthly || 0) * (1 + (myCfg.match || 0) / 100);
      hhMembers.forEach(m => {
        const c = loadCfg(`pi-pension-config-${m.id}`);
        totalLump += c.lumpSum || 0;
        totalMonthly += (c.monthly || 0) * (1 + (c.match || 0) / 100);
      });
      return { lumpSum: totalLump, monthly: totalMonthly };
    }
    if (activeMember && activeMember !== 'me') {
      const cfg = loadCfg(`pi-pension-config-${activeMember}`);
      return { lumpSum: cfg.lumpSum || 0, monthly: (cfg.monthly || 0) * (1 + (cfg.match || 0) / 100) };
    }
    const cfg = loadCfg('pi-pension-config');
    return { lumpSum: cfg.lumpSum || 0, monthly: (cfg.monthly || 0) * (1 + (cfg.match || 0) / 100) };
  }, [activeMember, isHouseholdView]);
  const pensionLumpSum = pensionConfigData.lumpSum;
  const pensionMonthly = pensionConfigData.monthly;
  const totalPensionSavings = pensionTotal + pensionLumpSum;

  // Investment breakdown by account type
  const investmentBreakdown = useMemo(() => {
    const byType = {};
    positions.forEach(p => {
      const accType = p.accountType || 'free';
      if (!byType[accType]) byType[accType] = 0;
      byType[accType] += toDKK((p.shares || 0) * (p.currentPrice || 0), p.currency);
    });
    return byType;
  }, [positions, state.tick]);
  const accountLabelsShort = { ask:'ASK', free: isEn()?'Free depot':'Frit depot', pension:'Pension', isk:'ISK', crypto:'Crypto' };

  // Portfolio daily change (currency-aware)
  const portfolioDayChange = useMemo(() => {
    let totalChange = 0, totalPrev = 0, hasChange = false;
    positions.forEach(p => {
      const valDKK = toDKK((p.shares || 0) * (p.currentPrice || 0), p.currency);
      if (p.priceChangePercent != null) {
        const prevVal = valDKK / (1 + p.priceChangePercent / 100);
        totalPrev += prevVal;
        totalChange += valDKK - prevVal;
        hasChange = true;
      }
    });
    if (!hasChange) return null;
    return { amount: totalChange, pct: totalPrev > 0 ? (totalChange / totalPrev * 100) : 0 };
  }, [positions, state.tick]);

  const scoreData = useMemo(() => window.computePortfolioScore ? computePortfolioScore() : null, [positions.length, state.overlapData, state.philosophy]);
  const suggestions = useMemo(() => window.computeRebalanceSuggestions ? computeRebalanceSuggestions() : [], [positions.length, state.overlapData]);

  // Sector allocation from overlap data
  const sectorAlloc = useMemo(() => {
    if (state.overlapData?.aggregated?.sectors) {
      const s = state.overlapData.aggregated.sectors;
      const colors = ["oklch(0.72 0.16 52)","oklch(0.55 0.10 45)","oklch(0.65 0.12 60)","oklch(0.80 0.10 70)","oklch(0.70 0.14 85)","oklch(0.85 0.06 55)","oklch(0.50 0.08 50)"];
      return Object.entries(s).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
    }
    return [];
  }, [state.overlapData]);

  // Broker breakdown
  const brokerGroups = useMemo(() => {
    const groups = {};
    positions.forEach(p => {
      const key = `${p.broker||'other'}|${p.accountType||'free'}`;
      if (!groups[key]) groups[key] = { broker: p.broker, accountType: p.accountType, total: 0, count: 0 };
      groups[key].total += toDKK((p.shares||0)*(p.currentPrice||0), p.currency);
      groups[key].count++;
    });
    return Object.values(groups).sort((a,b) => b.total - a.total);
  }, [positions, state.tick]);

  const brokerLabels = { saxo:'Saxo', nordnet:'Nordnet', lunar:'Lunar', coinbase:'Coinbase', revolut:'Revolut', wise:'Wise', kraken:'Kraken', binance:'Binance', crypto_com:'Crypto.com', other: isEn()?'Other':'Anden' };
  const accountLabels = { ask:'ASK', free: isEn()?'Free depot':'Frit depot', pension:'Pension', isk:'ISK', crypto:'Crypto', other: isEn()?'Other':'Anden' };

  const [priceStatus, setPriceStatus] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);

  const handleRefreshPrices = useCallback(async () => {
    setPriceLoading(true);
    setPriceStatus(isEn() ? "Fetching live prices..." : "Henter live kurser...");
    try {
      const result = await fetchLivePrices();
      if (result.error) {
        setPriceStatus("! " + result.error);
      } else if (result.updated > 0) {
        const failMsg = result.failed.length ? ` (${result.failed.join(', ')} ${isEn()?'not found':'ikke fundet'})` : '';
        setPriceStatus(`Done: ${result.updated} ${isEn()?'prices updated':'kurser opdateret'}${failMsg}`);
      } else {
        setPriceStatus(isEn() ? "No prices found" : "Ingen kurser fundet");
      }
    } catch(e) {
      setPriceStatus("! " + e.message);
    }
    setPriceLoading(false);
    refresh();
    setTimeout(() => setPriceStatus(""), 8000);
  }, [refresh]);

  // Expandable card state
  const [expandedCard, setExpandedCard] = useState(null);
  const toggleCard = (id) => setExpandedCard(prev => prev === id ? null : id);

  // Portfolio health expanded state
  const [healthExpanded, setHealthExpanded] = useState(false);

  // Quick ask state
  const [quickAsk, setQuickAsk] = useState("");
  const handleQuickAsk = () => {
    const text = quickAsk.trim();
    if (!text) return;
    setQuickAsk("");
    if (sendQuickAsk) sendQuickAsk(text);
  };

  // Onboarding: check if no positions AND no entries
  const hasNoData = positions.length === 0 && entries.length === 0;

  // Pension projection for expanded card
  const pensionProjection = useMemo(() => {
    if (!window.computePensionProjection) return null;
    const loadCfg = (key) => {
      try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
    };
    const cfg = loadCfg('pi-pension-config');
    const monthly = (cfg.monthly || 0);
    const match = cfg.match || 0;
    const retire = cfg.retireAge || 67;
    const age = cfg.currentAge || 39;
    const scenarios = computePensionProjection(totalPensionSavings, monthly, match, retire, age);
    if (!scenarios || scenarios.length < 2) return null;
    const moderate = scenarios[1];
    return { finalValue: moderate.finalValue, monthlyIncome: Math.round(moderate.finalValue * 0.04 / 12) };
  }, [totalPensionSavings]);

  // Top 5 positions for expanded investments card
  const top5Positions = useMemo(() => {
    return [...positions]
      .map(p => ({ ...p, valueDKK: toDKK((p.shares||0)*(p.currentPrice||0), p.currency) }))
      .sort((a, b) => b.valueDKK - a.valueDKK)
      .slice(0, 5);
  }, [positions, state.tick]);

  // Cash entries for expanded cash card
  const cashEntries = useMemo(() => entries.filter(e => e.type === 'asset' && (e.category === 'cash' || e.category === 'savings')), [entries]);
  const cashTotal = cashEntries.reduce((s, e) => s + (e.amount || 0), 0);

  // Overlap data for health section
  const overlapData = state.overlapData;
  const overlapTickers = overlapData?.overlapMatrix ? Object.keys(overlapData.overlapMatrix) : [];
  const getOverlap = (t1, t2) => {
    if (!overlapData?.overlapMatrix) return 0;
    return (overlapData.overlapMatrix[t1]?.[t2]) || (overlapData.overlapMatrix[t2]?.[t1]) || 0;
  };
  const getHeatLevel = (val) => val <= 0 ? 0 : val < 10 ? 1 : val < 25 ? 2 : val < 40 ? 3 : 4;

  // Philosophy for score
  const [activePhilosophy, setActivePhilosophy] = useState(state.philosophy || "bogle");
  const philosophies = [
    { id:"bogle", name:"Bogle", tag:"Index", desc: isEn()?"Low cost, broad diversification":"Lav omkostning, bred diversificering" },
    { id:"buffett", name:"Buffett", tag:"Value", desc: isEn()?"Quality, deep moat, long-term":"Kvalitet, dyb voldgrav, langsigtet" },
    { id:"dalio", name:"Dalio", tag:"Macro", desc: isEn()?"All-weather, risk parity":"All-weather, risiko-paritet" },
    { id:"lynch", name:"Lynch", tag:"Growth", desc: isEn()?"Growth at a reasonable price":"Vaekst til rimelig pris (GARP)" },
  ];

  // Overlap analysis runner
  const [overlapLoading, setOverlapLoading] = useState(false);
  const handleRunAnalysis = async () => {
    if (positions.length < 2) {
      alert(isEn() ? 'Need at least 2 positions.' : 'Du skal have mindst 2 positioner.');
      return;
    }
    setOverlapLoading(true);
    try {
      await runOverlapAnalysis();
      refresh();
    } catch(err) { alert(err.message); }
    setOverlapLoading(false);
  };

  // Rebalance done state (for health section)
  const [rebalDone, setRebalDone] = useState({});

  // ── ONBOARDING STATE ──
  if (hasNoData) {
    return (
      <div className="screen active">
        <div className="page-head">
          <div>
            <h1 className="page-title">{isEn() ? <>Welcome to <em>Portfolio Intelligence</em></> : <>Velkommen til <em>Portfolio Intelligence</em></>}</h1>
            <p className="page-subtitle">{isEn() ? 'Let\'s get your portfolio set up' : 'Lad os komme i gang med din portefolje'}</p>
          </div>
        </div>

        <div className="card" style={{textAlign:"center", padding:"48px 32px", maxWidth:560, margin:"40px auto"}}>
          <div style={{width:72, height:72, borderRadius:20, background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", opacity:0.9}}>
            <Icon name="upload" size={32} style={{color:"#fff"}}/>
          </div>
          <h2 style={{fontFamily:"var(--font-display)", fontSize:24, margin:"0 0 10px"}}>{isEn() ? 'Get started' : 'Kom i gang'}</h2>
          <p style={{color:"var(--text-muted)", fontSize:14, lineHeight:1.6, maxWidth:380, margin:"0 auto 24px"}}>
            {isEn() ? 'Import your portfolio from Saxo, Nordnet, or any broker. Upload a screenshot, PDF, or JSON file and our AI will parse your positions.' : 'Importer din portefolje fra Saxo, Nordnet eller en anden magler. Upload et skærmbillede, PDF eller JSON-fil, og vores AI parser dine positioner.'}
          </p>
          <button className="btn btn-primary" style={{fontSize:16, padding:"12px 32px"}} onClick={() => navigateTo && navigateTo('import')}>
            <Icon name="upload" size={16}/> {isEn() ? 'Import your portfolio' : 'Importer din portefolje'}
          </button>
          <div style={{marginTop:16}}>
            <button className="btn btn-ghost" onClick={() => navigateTo && navigateTo('add-position')}>
              {isEn() ? 'Or add manually' : 'Eller tilføj manuelt'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title">{isEn() ? <>Good afternoon, <em>Demo</em></> : <><em>Overblik</em></>}</h1>
          <p className="page-subtitle">{tl("overview.subtitle")}</p>
        </div>
        <div className="page-actions" style={{display:"flex", alignItems:"center", gap:12}}>
          {APP_STATE.lastPriceUpdate && !priceStatus && (
            <span style={{fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)"}}>
              {(() => {
                const d = new Date(APP_STATE.lastPriceUpdate);
                const mins = Math.round((Date.now() - d.getTime()) / 60000);
                if (mins < 1) return isEn() ? 'Updated just now' : 'Opdateret lige nu';
                if (mins < 60) return `${isEn() ? 'Updated' : 'Opdateret'} ${mins} min ${isEn() ? 'ago' : 'siden'}`;
                return `${isEn() ? 'Updated' : 'Opdateret'} ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
              })()}
              {' · '}{isEn() ? 'auto-refreshes every 5 min' : 'opdateres hvert 5. min'}
            </span>
          )}
          <button className="btn" onClick={handleRefreshPrices} disabled={priceLoading}>
            <Icon name="refresh" size={15}/> {tl("overview.refreshPrices")}
          </button>
        </div>
      </div>

      {priceStatus && <div style={{fontSize:12, color:"var(--text-muted)", marginBottom:12, fontFamily:"var(--font-mono)"}}>{priceStatus}</div>}

      {/* KPI row -- Net Worth + Score */}
      <div className="grid grid-12" style={{marginBottom: 20}}>
        <div className="card col-4 stat">
          <div className="eyebrow">{tl("overview.netWorth")}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize:32}}>{fmtC(nw)}</div>
          {portfolioDayChange ? (
            <div className="sub">
              <span className={`pill ${portfolioDayChange.amount >= 0 ? 'pos' : 'neg'}`}>
                <span className="pill-dot"/>
                <span className={privacyMode ? 'sensitive' : ''}>{portfolioDayChange.amount >= 0 ? '+' : ''}{fmtC(portfolioDayChange.amount)} · {portfolioDayChange.pct >= 0 ? '+' : ''}{portfolioDayChange.pct.toFixed(1)}%</span>
              </span>
              <span style={{fontSize:10, color:"var(--text-dim)", marginLeft:4}}>{isEn() ? 'today' : 'i dag'}</span>
            </div>
          ) : (
            <div className="sub"><span style={{fontSize:11, color:"var(--text-dim)"}}>{positions.length} {isEn()?'positions':'positioner'}</span></div>
          )}
        </div>

        {/* Investments breakdown -- expandable */}
        <div className="card col-4 stat" style={{cursor:"pointer"}} onClick={() => toggleCard('investments')}>
          <div className="eyebrow"><Icon name="layers" size={12} style={{marginRight:4}}/>{isEn() ? 'Investments' : 'Investeringer'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize:26}}>{fmtC(portfolioTotal)}</div>
          {expandedCard !== 'investments' ? (
            <>
              <div style={{display:"flex", flexDirection:"column", gap:4, marginTop:8}}>
                {Object.entries(investmentBreakdown).sort((a,b)=>b[1]-a[1]).map(([type, val]) => (
                  <div key={type} style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                    <span style={{color:"var(--text-dim)"}}>{accountLabelsShort[type] || type}</span>
                    <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(val)}</span>
                  </div>
                ))}
              </div>
              <div style={{fontSize:10, color:"var(--text-dim)", marginTop:6}}>
                {positions.filter(p=>p.type==="etf").length} ETFs · {positions.filter(p=>p.type==="stock").length} {isEn()?'stocks':'aktier'} · {isEn() ? 'click to expand' : 'klik for at udvide'}
              </div>
            </>
          ) : (
            <>
              {/* Expanded: top 5 positions */}
              <div style={{marginTop:12, borderTop:"1px solid var(--border)", paddingTop:10}}>
                <div style={{fontSize:11, fontWeight:600, color:"var(--text-dim)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em"}}>{isEn() ? 'Top 5 positions' : 'Top 5 positioner'}</div>
                {top5Positions.map((p, idx) => {
                  const weight = portfolioTotal > 0 ? (p.valueDKK / portfolioTotal * 100) : 0;
                  return (
                    <div key={p.id || idx} style={{display:"flex", alignItems:"center", gap:8, padding:"4px 0", fontSize:12}}>
                      <div className="ticker-mark" style={{background:tickerColor(idx), width:22, height:22, fontSize:8, borderRadius:5}}>{(p.ticker||'??').slice(0,2)}</div>
                      <span style={{flex:1, fontWeight:500}}>{p.ticker}</span>
                      <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontSize:11}}>{fmtC(p.valueDKK)}</span>
                      <span style={{color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:10, minWidth:36, textAlign:"right"}}>{fmtP(weight)}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:10, textAlign:"center"}}>
                <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); navigateTo && navigateTo('accounts', 'investments'); }}>
                  {isEn() ? 'See all' : 'Se alle'} &rarr;
                </button>
              </div>
            </>
          )}
        </div>

        {/* Portfolio Score */}
        <div className="card col-4 stat">
          <div className="eyebrow">{tl("overview.portfolioScore")}</div>
          {scoreData ? (
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <svg width="60" height="60" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" stroke="var(--bg-sunk)" strokeWidth="6" fill="none"/>
                <circle cx="36" cy="36" r="28" stroke="var(--accent)" strokeWidth="6" fill="none"
                  strokeDasharray={`${2*Math.PI*28*(scoreData.total/100)} 999`} strokeLinecap="round"
                  transform="rotate(-90 36 36)"/>
                <text x="36" y="42" textAnchor="middle" fontFamily="var(--font-display)" fontSize="24" fill="var(--text)">{scoreData.total}</text>
              </svg>
              <div>
                <div style={{fontWeight:600, fontSize:13}}>{scoreData.label}</div>
                <div style={{color:"var(--text-dim)", fontSize:11}}>{scoreData.philosophyName || 'Bogle'}</div>
              </div>
            </div>
          ) : <div className="value">&mdash;</div>}
        </div>
      </div>

      {/* Row 2 -- Pension + Home Equity + Cash (expandable) */}
      <div className="grid grid-12" style={{marginBottom: 20}}>
        {totalPensionSavings > 0 && (
          <div className="card col-4 stat" style={{cursor:"pointer"}} onClick={() => toggleCard('pension')}>
            <div className="eyebrow"><Icon name="trending" size={12} style={{marginRight:4}}/>{isEn() ? 'Pension' : 'Pension'}</div>
            <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize:26}}>{fmtC(totalPensionSavings)}</div>
            {expandedCard !== 'pension' ? (
              <>
                <div style={{display:"flex", flexDirection:"column", gap:4, marginTop:8}}>
                  {pensionLumpSum > 0 && (
                    <div style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                      <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Saved' : 'Opsparet'}</span>
                      <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(pensionLumpSum)}</span>
                    </div>
                  )}
                  {pensionTotal > 0 && (
                    <div style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                      <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Accounts' : 'Konti'}</span>
                      <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(pensionTotal)}</span>
                    </div>
                  )}
                  {pensionMonthly > 0 && (
                    <div style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                      <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Monthly' : 'Maanedlig'}</span>
                      <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(pensionMonthly)}/md</span>
                    </div>
                  )}
                </div>
                <div style={{fontSize:10, color:"var(--text-dim)", marginTop:6}}>{isEn() ? 'Click to expand' : 'Klik for at udvide'}</div>
              </>
            ) : (
              <>
                {/* Expanded pension: projection summary + monthly income */}
                <div style={{marginTop:12, borderTop:"1px solid var(--border)", paddingTop:10}}>
                  {pensionProjection ? (
                    <div style={{display:"grid", gap:8}}>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}>
                        <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Projected (moderate)' : 'Fremskrevet (moderat)'}</span>
                        <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:600, color:"var(--pos)"}}>{fmtC(pensionProjection.finalValue)}</span>
                      </div>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}>
                        <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Monthly income (4%)' : 'Maanedlig indkomst (4%)'}</span>
                        <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:600, color:"var(--pos)"}}>{fmtC(pensionProjection.monthlyIncome)}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{fontSize:12, color:"var(--text-dim)"}}>{isEn() ? 'Configure pension settings to see projections' : 'Konfigurer pensionsindstillinger for at se fremskrivninger'}</div>
                  )}
                </div>
                <div style={{marginTop:10, textAlign:"center"}}>
                  <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); navigateTo && navigateTo('accounts', 'pension'); }}>
                    {isEn() ? 'See all' : 'Se alle'} &rarr;
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {propertyValue > 0 && (
          <div className="card col-4 stat" style={{cursor:"pointer"}} onClick={() => toggleCard('home')}>
            <div className="eyebrow"><Icon name="home" size={12} style={{marginRight:4}}/>{isEn() ? 'Home equity' : 'Frivaerdi'}{propSplitPct < 100 ? ` (${propSplitPct}%)` : ''}</div>
            <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize:26, color: homeEquity >= 0 ? "var(--pos)" : "var(--neg)"}}>{fmtC(homeEquity)}</div>
            {expandedCard !== 'home' ? (
              <>
                <div style={{display:"flex", flexDirection:"column", gap:4, marginTop:8}}>
                  <div style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                    <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Property' : 'Ejendom'}</span>
                    <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(propertyValue)}</span>
                  </div>
                  <div style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                    <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Mortgage' : 'Laan'}</span>
                    <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500, color:"var(--neg)"}}>-{fmtC(mortgageBalance)}</span>
                  </div>
                  {isHouseholdView && hasPartnerMember && (
                    <>
                      <div style={{borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4, display:"flex", justifyContent:"space-between", fontSize:10}}>
                        <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Me' : 'Mig'} ({propertySplit.me ?? 50}%)</span>
                        <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC((propertyValueRaw - mortgageBalanceRaw) * (propertySplit.me ?? 50) / 100)}</span>
                      </div>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:10}}>
                        <span style={{color:"var(--text-dim)"}}>{partnerMember?.name} ({100 - (propertySplit.me ?? 50)}%)</span>
                        <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC((propertyValueRaw - mortgageBalanceRaw) * (100 - (propertySplit.me ?? 50)) / 100)}</span>
                      </div>
                    </>
                  )}
                </div>
                <div style={{fontSize:10, color:"var(--text-dim)", marginTop:6}}>{fmtP(propertyValue > 0 ? (homeEquity/propertyValue*100) : 0, 0)} {isEn() ? 'equity' : 'frivaerdi'} · {isEn() ? 'click to expand' : 'klik for at udvide'}</div>
              </>
            ) : (
              <>
                {/* Expanded: mortgage breakdown */}
                <div style={{marginTop:12, borderTop:"1px solid var(--border)", paddingTop:10}}>
                  <div style={{display:"grid", gap:8}}>
                    <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}>
                      <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Property value' : 'Ejendomsvaerdi'}</span>
                      <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(propertyValue)}</span>
                    </div>
                    <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}>
                      <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Mortgage balance' : 'Laanssaldo'}</span>
                      <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500, color:"var(--neg)"}}>-{fmtC(mortgageBalance)}</span>
                    </div>
                    <div style={{display:"flex", justifyContent:"space-between", fontSize:12}}>
                      <span style={{color:"var(--text-dim)"}}>LTV</span>
                      <span style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{propertyValue > 0 ? (mortgageBalance / propertyValue * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                </div>
                <div style={{marginTop:10, textAlign:"center"}}>
                  <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); navigateTo && navigateTo('accounts', 'property'); }}>
                    {isEn() ? 'See all' : 'Se alle'} &rarr;
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {/* Cash & other liquid -- expandable */}
        {cashTotal > 0 && (
          <div className="card col-4 stat" style={{cursor:"pointer"}} onClick={() => toggleCard('cash')}>
            <div className="eyebrow"><Icon name="dollar" size={12} style={{marginRight:4}}/>{isEn() ? 'Cash & Savings' : 'Kontant & Opsparing'}</div>
            <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize:26}}>{fmtC(cashTotal)}</div>
            {expandedCard !== 'cash' ? (
              <div style={{display:"flex", flexDirection:"column", gap:4, marginTop:8}}>
                {cashEntries.slice(0, 3).map((e, i) => (
                  <div key={i} style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                    <span style={{color:"var(--text-dim)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140}}>{e.name}</span>
                    <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(e.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Expanded: all cash accounts */}
                <div style={{marginTop:12, borderTop:"1px solid var(--border)", paddingTop:10}}>
                  {cashEntries.map((e, i) => (
                    <div key={i} style={{display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0"}}>
                      <span style={{color:"var(--text-dim)"}}>{e.name}</span>
                      <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(e.amount)}</span>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:10, textAlign:"center"}}>
                  <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); navigateTo && navigateTo('accounts', 'assets'); }}>
                    {isEn() ? 'See all' : 'Se alle'} &rarr;
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sector allocation + Broker breakdown */}
      <div className="grid grid-12">
        {sectorAlloc.length > 0 && (
          <div className="card col-6">
            <div className="card-head">
              <h3 className="card-title">{tl("overlap.sectorExposure")}</h3>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"200px 1fr", gap:24, alignItems:"center"}}>
              <Donut data={sectorAlloc}/>
              <div className="donut-legend">
                {sectorAlloc.slice(0, 7).map(s => (
                  <div key={s.name} className="legend-item">
                    <span className="legend-dot" style={{background:s.color}}/>
                    <span className="legend-name">{s.name}</span>
                    <span className="legend-pct">{fmtP(s.value)}</span>
                    <span className={`legend-val${privacyMode ? ' sensitive' : ''}`}>{fmtC(portfolioTotal * s.value / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {brokerGroups.length > 0 && (
          <div className={"card " + (sectorAlloc.length > 0 ? "col-6" : "col-12")}>
            <div className="card-head">
              <h3 className="card-title">{tl("overview.brokerBreakdown")}</h3>
            </div>
            <div style={{display:"grid", gap:14}}>
              {brokerGroups.map((g, i) => {
                const pct = portfolioTotal > 0 ? (g.total / portfolioTotal * 100) : 0;
                const colors = ["var(--accent)","var(--pos)","var(--warn)","var(--neg)","var(--info)"];
                return (
                  <div key={i}>
                    <div style={{display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6}}>
                      <span><strong>{brokerLabels[g.broker]||g.broker||'--'}</strong> -- {accountLabels[g.accountType]||g.accountType||'--'}</span>
                      <span className={`num${privacyMode ? ' sensitive' : ''}`} style={{fontSize:12}}>{fmtC(g.total)} <span style={{opacity:0.6}}>({fmtP(pct, 0)})</span></span>
                    </div>
                    <div style={{height:8, background:"var(--bg-sunk)", borderRadius:999, overflow:"hidden"}}>
                      <div style={{width:`${pct}%`, height:"100%", background:colors[i%colors.length], borderRadius:999, transition:"width 0.4s"}}/>
                    </div>
                    <div style={{fontSize:11, color:"var(--text-dim)", marginTop:4}}>{g.count} {isEn()?'positions':'positioner'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Portfolio Health Section */}
      {positions.length > 0 && (
        <div className="card" style={{marginTop:20}}>
          <div className="card-head" style={{cursor:"pointer"}} onClick={() => setHealthExpanded(!healthExpanded)}>
            <h3 className="card-title"><Icon name="activity" size={15} style={{marginRight:6, opacity:0.6}}/>{isEn() ? 'Portfolio Health' : 'Portefoljesundhed'}</h3>
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              {scoreData && <span style={{fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600}}>{scoreData.total}/100</span>}
              <Icon name={healthExpanded ? "chevron-up" : "chevron"} size={14} style={{opacity:0.5, transform: healthExpanded ? 'rotate(180deg)' : 'rotate(90deg)'}}/>
            </div>
          </div>

          {/* Compact summary */}
          {!healthExpanded && (
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginTop:4}}>
              {/* Score gauge mini */}
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                {scoreData ? (
                  <>
                    <svg width="44" height="44" viewBox="0 0 72 72">
                      <circle cx="36" cy="36" r="28" stroke="var(--bg-sunk)" strokeWidth="5" fill="none"/>
                      <circle cx="36" cy="36" r="28" stroke="var(--accent)" strokeWidth="5" fill="none"
                        strokeDasharray={`${2*Math.PI*28*(scoreData.total/100)} 999`} strokeLinecap="round"
                        transform="rotate(-90 36 36)"/>
                      <text x="36" y="42" textAnchor="middle" fontFamily="var(--font-display)" fontSize="22" fill="var(--text)">{scoreData.total}</text>
                    </svg>
                    <div>
                      <div style={{fontWeight:600, fontSize:12}}>{scoreData.label}</div>
                      <div style={{fontSize:10, color:"var(--text-dim)"}}>{isEn() ? 'Score' : 'Score'}</div>
                    </div>
                  </>
                ) : <div style={{fontSize:12, color:"var(--text-dim)"}}>{isEn() ? 'Run analysis first' : 'Kor analyse forst'}</div>}
              </div>

              {/* Top 3 suggestions */}
              <div>
                <div style={{fontSize:10, fontWeight:600, color:"var(--text-dim)", textTransform:"uppercase", marginBottom:6}}>{isEn() ? 'Top actions' : 'Top-handlinger'}</div>
                {suggestions.slice(0, 3).map((s, i) => (
                  <div key={i} style={{fontSize:11, color:"var(--text-muted)", padding:"2px 0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                    <span style={{color: s.priority==="high" ? "var(--neg)" : s.priority==="medium" ? "var(--accent)" : "var(--text-dim)", marginRight:4}}>*</span>
                    {s.title}
                  </div>
                ))}
                {suggestions.length === 0 && <div style={{fontSize:11, color:"var(--text-dim)"}}>{isEn() ? 'No actions' : 'Ingen handlinger'}</div>}
              </div>

              {/* Overlap heatmap preview */}
              <div>
                <div style={{fontSize:10, fontWeight:600, color:"var(--text-dim)", textTransform:"uppercase", marginBottom:6}}>{isEn() ? 'Overlap' : 'Overlap'}</div>
                {overlapTickers.length > 0 ? (
                  <div style={{display:"grid", gridTemplateColumns:`repeat(${Math.min(overlapTickers.length, 6)}, 1fr)`, gap:2, maxWidth:120}}>
                    {overlapTickers.slice(0, 6).map((row, i) =>
                      overlapTickers.slice(0, 6).map((col, j) => {
                        if (i === j) return <div key={`${i}-${j}`} style={{width:"100%", paddingBottom:"100%", background:"var(--bg-sunk)", borderRadius:2}}/>;
                        const val = getOverlap(row, col);
                        const level = getHeatLevel(val);
                        const bg = level===0?"var(--bg-sunk)":level===1?"oklch(0.95 0.04 55)":level===2?"oklch(0.88 0.09 55)":level===3?"oklch(0.78 0.14 50)":"oklch(0.64 0.17 48)";
                        return <div key={`${i}-${j}`} style={{width:"100%", paddingBottom:"100%", background:bg, borderRadius:2}} title={`${row} x ${col}: ${val.toFixed(0)}%`}/>;
                      })
                    )}
                  </div>
                ) : (
                  <div style={{fontSize:11, color:"var(--text-dim)"}}>{isEn() ? 'Run analysis' : 'Kor analyse'}</div>
                )}
              </div>
            </div>
          )}

          {/* Expanded: full content */}
          {healthExpanded && (
            <div style={{marginTop:16}}>
              {/* Philosophy picker */}
              <div style={{marginBottom:20}}>
                <div className="eyebrow" style={{marginBottom:10}}>{tl("score.choosePhilosophy")}</div>
                <div className="philosophies">
                  {philosophies.map(ph => (
                    <button key={ph.id} className={"philosophy " + (activePhilosophy===ph.id?"active":"")} onClick={()=>{setActivePhilosophy(ph.id); APP_STATE.philosophy=ph.id; window.savePreferences(); refresh();}}>
                      <div className="p-head">
                        <div className="p-name">{ph.name}</div>
                        <span className="p-tag">{ph.tag}</span>
                      </div>
                      <div className="p-desc">{ph.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Score breakdown */}
              {scoreData && (
                <div className="grid grid-12" style={{marginBottom:20}}>
                  <div className="card col-5" style={{border:"none", boxShadow:"none", background:"transparent", padding:0}}>
                    <div className="gauge-wrap">
                      <Gauge value={scoreData.total} max={100} size={220}/>
                    </div>
                    <div style={{marginTop:8, padding:10, background:"var(--bg-raised)", borderRadius:"var(--r-md)", fontSize:12, color:"var(--text-muted)", textAlign:"center"}}>
                      <strong style={{color:"var(--text)"}}>{scoreData.label}.</strong> {philosophies.find(p=>p.id===activePhilosophy)?.desc}
                    </div>
                  </div>
                  <div className="col-7" style={{padding:0}}>
                    <div style={{display:"grid", gap:14}}>
                      {Object.values(scoreData.scores).map((r, i) => {
                        const pct = r.score / r.max * 100;
                        const tone = pct >= 70 ? "strong" : pct < 40 ? "weak" : "";
                        return (
                          <div key={i} className="sbr-col">
                            <div className="sbr-head">
                              <div className="sbr-title">{r.label}</div>
                              <div className="sbr-val"><strong style={{color:"var(--text)", fontSize:13}}>{r.score}</strong> / {r.max}</div>
                            </div>
                            <div className="sbr-track">
                              <div className={"sbr-fill " + tone} style={{width: pct+"%"}}/>
                            </div>
                            <div className="sbr-note">{r.detail}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Overlap matrix */}
              {overlapTickers.length > 0 ? (
                <div style={{marginBottom:20}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
                    <h4 style={{margin:0, fontSize:14}}>{tl("overlap.matrix")}</h4>
                    <div style={{display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--text-muted)"}}>
                      <span>{isEn()?'Low':'Lav'}</span>
                      <div style={{display:"flex", gap:2}}>
                        {[0,1,2,3,4].map(v => <div key={v} style={{width:14, height:14, borderRadius:3,
                          background: v===0?"var(--bg-sunk)":v===1?"oklch(0.95 0.04 55)":v===2?"oklch(0.88 0.09 55)":v===3?"oklch(0.78 0.14 50)":"oklch(0.64 0.17 48)"}}/>)}
                      </div>
                      <span>{isEn()?'High':'Hoj'}</span>
                    </div>
                  </div>
                  <div className="matrix-wrap">
                    <table className="matrix">
                      <thead>
                        <tr>
                          <th></th>
                          {overlapTickers.map(t => <th key={t} style={{writingMode:"vertical-rl", transform:"rotate(180deg)", height:80}}>{t}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {overlapTickers.map((row, i) => (
                          <tr key={row}>
                            <th className="row-head">{row}</th>
                            {overlapTickers.map((col, j) => {
                              if (i === j) return <td key={j} className="diag">&mdash;</td>;
                              const val = getOverlap(row, col);
                              const level = getHeatLevel(val);
                              return (
                                <td key={j} data-v={level} style={{fontSize:10}} title={`${row} x ${col}: ${val.toFixed(1)}%`}>
                                  {val <= 0 ? "." : val.toFixed(0)+"%"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{textAlign:"center", padding:"20px 0", marginBottom:16}}>
                  <button className="btn btn-accent" onClick={handleRunAnalysis} disabled={overlapLoading}>
                    <Icon name="play" size={15}/> {overlapLoading ? (isEn()?'Analyzing...':'Analyserer...') : tl("overlap.runAnalysis")}
                  </button>
                </div>
              )}

              {/* Rebalance items */}
              {suggestions.length > 0 && (
                <div>
                  <h4 style={{margin:"0 0 12px", fontSize:14}}>{isEn() ? 'Rebalance suggestions' : 'Rebalanceringsforslag'}</h4>
                  <div style={{display:"grid", gap:10}}>
                    {suggestions.map((s, i) => (
                      <div key={i} className={"insight " + (s.priority==="high"?"alert":s.priority==="medium"?"warn":"good")} style={{opacity: rebalDone[i]?0.5:1}}>
                        <div className="insight-icon"><Icon name={s.type==="warning"?"alert":s.type==="tax"?"tax":s.type==="risk"?"pie":"overlap"} size={18}/></div>
                        <div className="insight-body">
                          <div className="insight-title">
                            {s.title}
                            <span className={"severity " + (s.priority==="high"?"high":s.priority==="medium"?"med":"low")}>{s.priority}</span>
                          </div>
                          <div className="insight-text">{s.detail}</div>
                          <div style={{marginTop:8}}>
                            <button className="btn btn-sm btn-ghost" onClick={()=>setRebalDone({...rebalDone, [i]:!rebalDone[i]})}>
                              <Icon name="check" size={13}/> {rebalDone[i]?(isEn()?'Done':'Faerdig'):(isEn()?'Mark done':'Marker faerdig')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick ask bar for Huginn */}
      <div style={{marginTop:20, position:"relative"}}>
        <div style={{
          display:"flex", alignItems:"center", gap:10,
          background:"var(--bg-card)", borderRadius:16,
          border:"1px solid var(--border)", padding:"8px 8px 8px 16px",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, opacity:0.7}}>
            <path d="M4 19c0-3 2-6 6-8l2-1c2-1 4-3 5-5l1-2s1 3-1 6c0 0 3-1 4 1s-1 4-3 5l-3 2c-2 1-4 3-5 5l-1 2"/>
            <circle cx="15" cy="7" r="0.8" fill="currentColor" stroke="none"/>
          </svg>
          <input
            value={quickAsk}
            onChange={e => setQuickAsk(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAsk(); }}}
            placeholder={isEn() ? "Quick ask Huginn about your portfolio..." : "Sporg Huginn hurtigt om din portefolje..."}
            style={{
              flex:1, border:"none", outline:"none", background:"transparent",
              color:"var(--text)", fontSize:13, padding:"6px 0", fontFamily:"inherit",
            }}
          />
          <button
            onClick={handleQuickAsk}
            disabled={!quickAsk.trim()}
            style={{
              width:34, height:34, borderRadius:10,
              background: quickAsk.trim() ? "var(--accent)" : "var(--bg-sunk)",
              border:"none", cursor: quickAsk.trim() ? "pointer" : "default",
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={quickAsk.trim() ? "#fff" : "var(--text-dim)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
            </svg>
          </button>
        </div>
        <div style={{fontSize:10, color:"var(--text-dim)", opacity:0.5, textAlign:"center", marginTop:4}}>
          {isEn() ? 'Press Enter to ask Huginn' : 'Tryk Enter for at sporge Huginn'}
        </div>
      </div>
    </div>
  );
};

// ==========================================================================
// ACCOUNTS SCREEN (Unified: Investments + Assets & Liabilities + Pension + Property)
// ==========================================================================
const AccountsScreen = ({ state, refresh, openModal, privacyMode, household, activeMember, initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || "investments");

  // Update tab when initialTab changes (from nav)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title">{isEn() ? <><em>Accounts</em></> : <><em>Konti</em></>}</h1>
          <p className="page-subtitle">{isEn() ? 'Your complete financial picture' : 'Dit samlede oekonomiske billede'}</p>
        </div>
        <div className="page-actions">
          {activeTab === 'investments' && (
            <>
              <button className="btn" onClick={()=>openModal('import')}>
                <Icon name="upload" size={15}/> {tl("portfolio.import")}
              </button>
              <button className="btn btn-accent" onClick={()=>openModal('position')}>
                <Icon name="plus" size={15}/> {tl("portfolio.addPosition")}
              </button>
            </>
          )}
          {activeTab === 'assets' && (
            <button className="btn btn-accent" onClick={() => openModal('entry')}>
              <Icon name="plus" size={15}/> {tl("networth.addEntry")}
            </button>
          )}
          {activeTab === 'pension' && (
            <button className="btn btn-accent" onClick={() => openModal('entry', { type: 'asset', category: 'pension' })}>
              <Icon name="plus" size={15}/> {isEn() ? 'Add pension' : 'Tilfoej pension'}
            </button>
          )}
          {activeTab === 'property' && (
            <button className="btn" onClick={() => openModal('entry', { type: 'asset', category: 'property' })}>
              <Icon name="plus" size={14}/> {isEn() ? 'Add entry' : 'Tilfoej post'}
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="segmented" style={{marginBottom:20}}>
        <button className={activeTab==="investments"?"active":""} onClick={()=>setActiveTab("investments")}>{isEn() ? 'Investments' : 'Investeringer'}</button>
        <button className={activeTab==="assets"?"active":""} onClick={()=>setActiveTab("assets")}>{isEn() ? 'Assets & Liabilities' : 'Aktiver & Passiver'}</button>
        <button className={activeTab==="pension"?"active":""} onClick={()=>setActiveTab("pension")}>{isEn() ? 'Pension' : 'Pension'}</button>
        <button className={activeTab==="property"?"active":""} onClick={()=>setActiveTab("property")}>{isEn() ? 'Property' : 'Ejendom'}</button>
      </div>

      {activeTab === 'investments' && <InvestmentsTab state={state} refresh={refresh} openModal={openModal} privacyMode={privacyMode} />}
      {activeTab === 'assets' && <AssetsTab state={state} refresh={refresh} openModal={openModal} privacyMode={privacyMode} />}
      {activeTab === 'pension' && <PensionTab state={state} refresh={refresh} openModal={openModal} activeMember={activeMember} privacyMode={privacyMode} />}
      {activeTab === 'property' && <PropertyTab state={state} refresh={refresh} openModal={openModal} household={household} activeMember={activeMember} privacyMode={privacyMode} />}
    </div>
  );
};

// -- Investments Tab (from PortfolioScreen) --
const InvestmentsTab = ({ state, refresh, openModal, privacyMode }) => {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [acctFilter, setAcctFilter] = useState("all");
  const [sortCol, setSortCol] = useState("value");
  const [sortDir, setSortDir] = useState("desc");
  const positions = state.positions || [];
  const posVal = (p) => toDKK((p.shares||0)*(p.currentPrice||0), p.currency);
  const totalValue = positions.reduce((s,p)=>s+posVal(p), 0);

  const accountOptions = useMemo(() => {
    const seen = {};
    positions.forEach(p => {
      const key = `${p.broker||'other'}|${p.accountType||'free'}`;
      if (!seen[key]) seen[key] = { broker: p.broker, accountType: p.accountType, count: 0 };
      seen[key].count++;
    });
    return Object.values(seen);
  }, [positions]);

  const brokerLabels = { saxo:'Saxo', nordnet:'Nordnet', lunar:'Lunar', coinbase:'Coinbase', revolut:'Revolut', wise:'Wise', kraken:'Kraken', binance:'Binance', crypto_com:'Crypto.com', other: isEn()?'Other':'Anden' };
  const accountLabels = { ask:'ASK', free: isEn()?'Free depot':'Frit depot', pension:'Pension', isk:'ISK', crypto:'Crypto', other: isEn()?'Other':'Anden' };

  const handleSort = (col) => {
    if (sortCol === col) { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }
    else { setSortCol(col); setSortDir('desc'); }
  };
  const sortArrow = (col) => sortCol === col ? (sortDir === 'desc' ? ' ▾' : ' ▴') : '';

  const filtered = useMemo(() => {
    let list = positions
      .filter(h => {
        if (q && !h.ticker?.toLowerCase().includes(q.toLowerCase()) && !h.name?.toLowerCase().includes(q.toLowerCase())) return false;
        if (typeFilter !== "all" && h.type !== typeFilter) return false;
        if (acctFilter !== "all") {
          const [b, a] = acctFilter.split('|');
          if (h.broker !== b || h.accountType !== a) return false;
        }
        return true;
      });

    // Consolidate duplicate tickers when showing all accounts
    if (acctFilter === "all") {
      const groups = {};
      list.forEach(h => {
        const key = (h.ticker||'??').toUpperCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(h);
      });
      list = Object.values(groups).map(items => {
        if (items.length === 1) return items[0];
        // Merge: weighted-average avgPrice, sum shares, keep latest price/history/daily change
        const totalShares = items.reduce((s, p) => s + (p.shares || 0), 0);
        // Weighted avg price: sum(shares * avgPrice) / totalShares — only count positions with avgPrice
        const withAvg = items.filter(p => p.avgPrice && p.avgPrice > 0 && p.shares > 0);
        const weightedAvg = withAvg.length > 0 && totalShares > 0
          ? withAvg.reduce((s, p) => s + (p.shares * p.avgPrice), 0) / totalShares
          : null;
        // Use the first item as template (for ticker, name, type, currency, etc.)
        const base = items[0];
        // Collect all account labels for display
        const acctLabels = items.map(p => {
          const bl = brokerLabels[p.broker] || p.broker || '';
          const al = accountLabels[p.accountType] || p.accountType || '';
          return `${bl}·${al}`;
        });
        return {
          ...base,
          shares: totalShares,
          avgPrice: weightedAvg,
          currentPrice: base.currentPrice, // same ticker = same live price
          priceChangePercent: base.priceChangePercent,
          history: base.history,
          _consolidated: true,
          _sourceIds: items.map(p => p.id),
          _acctLabels: acctLabels,
        };
      });
    }

    return list.sort((a,b) => {
        let va, vb;
        switch (sortCol) {
          case 'ticker': va = (a.ticker||'').toLowerCase(); vb = (b.ticker||'').toLowerCase(); return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
          case 'shares': va = a.shares||0; vb = b.shares||0; break;
          case 'price': va = toDKK(a.currentPrice||0, a.currency); vb = toDKK(b.currentPrice||0, b.currency); break;
          case 'avgPrice': va = toDKK(a.avgPrice||0, a.currency); vb = toDKK(b.avgPrice||0, b.currency); break;
          case 'pnl': {
            va = (a.avgPrice && a.avgPrice > 0 && a.currentPrice) ? ((a.currentPrice - a.avgPrice) / a.avgPrice * 100) : -9999;
            vb = (b.avgPrice && b.avgPrice > 0 && b.currentPrice) ? ((b.currentPrice - b.avgPrice) / b.avgPrice * 100) : -9999;
            break;
          }
          case 'change': {
            va = a.priceChangePercent || 0;
            vb = b.priceChangePercent || 0;
            break;
          }
          case 'weight':
          case 'value': default: va = posVal(a); vb = posVal(b); break;
        }
        return sortDir === 'asc' ? va - vb : vb - va;
      });
  }, [positions, q, typeFilter, acctFilter, sortCol, sortDir]);

  const deletePosition = (id) => {
    APP_STATE.positions = APP_STATE.positions.filter(p => p.id !== id);
    window.saveData();
    if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
    refresh();
  };

  return (
    <>
      <div className="grid grid-12" style={{marginBottom:20}}>
        <div className="card col-4 stat">
          <div className="eyebrow">{tl("portfolio.totalValue")}</div>
          <div className="value">{fmtC(totalValue)}</div>
        </div>
        <div className="card col-4 stat">
          <div className="eyebrow">{tl("portfolio.positions")}</div>
          <div className="value">{positions.length}</div>
          <div className="sub">
            <span className="pill">{positions.filter(p=>p.type==="etf").length} ETFs</span>
            <span className="pill">{positions.filter(p=>p.type==="stock").length} {isEn()?'stocks':'aktier'}</span>
            {positions.filter(p=>p.type==="fund").length > 0 && <span className="pill">{positions.filter(p=>p.type==="fund").length} {isEn()?'funds':'fonde'}</span>}
            {positions.filter(p=>p.type==="crypto").length > 0 && <span className="pill">{positions.filter(p=>p.type==="crypto").length} crypto</span>}
          </div>
        </div>
        <div className="card col-4 stat">
          <div className="eyebrow">{tl("portfolio.topSector")}</div>
          <div className="value" style={{fontSize:28}}>
            {state.overlapData?.aggregated?.sectors ? Object.entries(state.overlapData.aggregated.sectors).sort((a,b)=>b[1]-a[1])[0]?.[0] || '--' : '--'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{flexDirection:"column", alignItems:"stretch", gap:12}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap"}}>
            <div style={{display:"flex", alignItems:"center", gap:16, flexWrap:"wrap"}}>
              <h3 className="card-title">{tl("portfolio.holdings")}</h3>
              <div className="segmented">
                <button className={typeFilter==="all"?"active":""} onClick={()=>setTypeFilter("all")}>{isEn()?'All':'Alle'}</button>
                <button className={typeFilter==="stock"?"active":""} onClick={()=>setTypeFilter("stock")}>{isEn()?'Stocks':'Aktier'}</button>
                <button className={typeFilter==="etf"?"active":""} onClick={()=>setTypeFilter("etf")}>ETFs</button>
                <button className={typeFilter==="fund"?"active":""} onClick={()=>setTypeFilter("fund")}>{isEn()?'Funds':'Fonde'}</button>
                <button className={typeFilter==="crypto"?"active":""} onClick={()=>setTypeFilter("crypto")}>Crypto</button>
              </div>
            </div>
            <div className="search" style={{minWidth:220}}>
              <Icon name="search" size={14}/>
              <input placeholder={isEn()?"Search ticker or name...":"Sog ticker eller navn..."} value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
          </div>
          {accountOptions.length > 1 && (
            <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
              <span style={{fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:600}}>{isEn()?'Account':'Konto'}:</span>
              <div className="segmented" style={{fontSize:12}}>
                <button className={acctFilter==="all"?"active":""} onClick={()=>setAcctFilter("all")}>{isEn()?'All':'Alle'}</button>
                {accountOptions.map(opt => {
                  const key = `${opt.broker||'other'}|${opt.accountType||'free'}`;
                  const label = `${brokerLabels[opt.broker]||opt.broker||'--'} · ${accountLabels[opt.accountType]||opt.accountType||'--'}`;
                  return <button key={key} className={acctFilter===key?"active":""} onClick={()=>setAcctFilter(key)}>{label} ({opt.count})</button>;
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{overflowX:"auto", margin:"0 -22px", padding:"0 22px"}}>
          <table className="t">
            <thead>
              <tr>
                <th style={{width:44}}></th>
                <th style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('ticker')}>Ticker / {isEn()?'Name':'Navn'}{sortArrow('ticker')}</th>
                <th>Type</th>
                <th>{tl("portfolio.thAccount")}</th>
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('shares')}>{tl("portfolio.thShares")}{sortArrow('shares')}</th>
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('price')}>{tl("portfolio.thPrice")}{sortArrow('price')}</th>
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('avgPrice')}>{isEn()?'Avg Price':'GAK'}{sortArrow('avgPrice')}</th>
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('pnl')}>{isEn()?'P&L %':'Afkast %'}{sortArrow('pnl')}</th>
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('change')}>{isEn()?'1D %':'1D %'}{sortArrow('change')}</th>
                <th style={{width:60, textAlign:"center"}}>{isEn()?'5D':'5D'}</th>
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('value')}>{tl("portfolio.thValue")}{sortArrow('value')}</th>
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('weight')}>{tl("portfolio.thWeight")}{sortArrow('weight')}</th>
                <th style={{width:60}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} style={{textAlign:"center", color:"var(--text-dim)", padding:40}}>{tl("portfolio.noHoldings")}</td></tr>
              ) : filtered.map((h, idx) => {
                const rawValue = (h.shares||0) * (h.currentPrice||0);
                const value = toDKK(rawValue, h.currency);
                const weight = totalValue > 0 ? (value / totalValue * 100) : 0;
                const broker = brokerLabels[h.broker]||h.broker||'--';
                const acct = accountLabels[h.accountType]||h.accountType||'--';
                return (
                  <tr key={h.id || idx}>
                    <td><div className="ticker-mark" style={{background:tickerColor(idx)}}>{(h.ticker||'??').slice(0,2)}</div></td>
                    <td>
                      <div className="ticker-meta">
                        <div className="sym">{h.ticker}</div>
                        <div className="name">{h.name || '--'}</div>
                      </div>
                    </td>
                    <td><span className="pill" style={{textTransform:"uppercase", fontSize:10, letterSpacing:"0.06em"}}>{h.type}</span></td>
                    <td style={{color:"var(--text-muted)", fontSize:12.5}}>
                      {h._consolidated ? (
                        <div style={{display:"flex", flexDirection:"column", gap:1}}>
                          {h._acctLabels.map((lbl, i) => <div key={i} style={{fontSize:11, lineHeight:"1.3"}}>{lbl}</div>)}
                        </div>
                      ) : `${broker} · ${acct}`}
                    </td>
                    <td className="num">{h.shares}</td>
                    <td className="num">
                      {h.currency && h.currency !== (APP_STATE.currency || 'DKK') ? (
                        <>
                          <div style={{fontFamily:"var(--font-mono)", fontSize:12.5}}>{h.currency === 'USD' ? '$' : h.currency === 'EUR' ? '?' : h.currency === 'GBP' ? '?' : ''}{(h.currentPrice||0).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:2})}</div>
                          <div style={{fontSize:9, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginTop:1}}>{fmtC(toDKK(h.currentPrice||0, h.currency))}</div>
                        </>
                      ) : (
                        <div>{fmtC(h.currentPrice||0)}</div>
                      )}
                    </td>
                    <td className="num">
                      {h.avgPrice && h.avgPrice > 0 ? (
                        h.currency && h.currency !== (APP_STATE.currency || 'DKK') ? (
                          <>
                            <div style={{fontFamily:"var(--font-mono)", fontSize:12.5}}>{h.currency === 'USD' ? '$' : h.currency === 'EUR' ? '€' : h.currency === 'GBP' ? '£' : ''}{h.avgPrice.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:2})}</div>
                            <div style={{fontSize:9, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginTop:1}}>{fmtC(toDKK(h.avgPrice, h.currency))}</div>
                          </>
                        ) : (
                          <div style={{fontFamily:"var(--font-mono)", fontSize:12.5}}>{fmtC(h.avgPrice)}</div>
                        )
                      ) : <span style={{color:"var(--text-dim)", fontSize:11}}>&mdash;</span>}
                    </td>
                    <td className="num">
                      {(() => {
                        const pnl = (h.avgPrice && h.avgPrice > 0 && h.currentPrice)
                          ? ((h.currentPrice - h.avgPrice) / h.avgPrice * 100) : null;
                        if (pnl == null) return <span style={{color:"var(--text-dim)", fontSize:11}}>&mdash;</span>;
                        return (
                          <span style={{
                            color: pnl > 0 ? "var(--pos)" : pnl < 0 ? "var(--neg)" : "var(--text-muted)",
                            fontFamily:"var(--font-mono)", fontSize:12, fontWeight:600,
                            padding:"2px 6px", borderRadius:6,
                            background: pnl > 0 ? "oklch(0.45 0.12 145 / 0.12)" : pnl < 0 ? "oklch(0.55 0.15 25 / 0.12)" : "transparent",
                          }}>
                            {pnl > 0 ? "+" : ""}{pnl.toFixed(2)}%
                          </span>
                        );
                      })()}
                    </td>
                    <td className="num">
                      {(() => {
                        const daily = h.priceChangePercent;
                        if (daily == null) return <span style={{color:"var(--text-dim)", fontSize:11}}>&mdash;</span>;
                        return (
                          <span style={{
                            color: daily > 0 ? "var(--pos)" : daily < 0 ? "var(--neg)" : "var(--text-muted)",
                            fontFamily:"var(--font-mono)", fontSize:11.5, fontWeight:500,
                          }}>
                            {daily > 0 ? "+" : ""}{daily.toFixed(2)}%
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{padding:"4px 2px"}}>
                      {h.history && h.history.length > 1 ? (
                        <Sparkline data={h.history} width={56} height={20} color={
                          h.history[h.history.length - 1] >= h.history[0] ? "var(--pos)" : "var(--neg)"
                        } />
                      ) : <span style={{display:"block", width:56, height:20}} />}
                    </td>
                    <td className="num" style={{fontWeight:500}}>{fmtC(value)}</td>
                    <td className="num">
                      <div style={{display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end"}}>
                        <div style={{width:40, height:5, background:"var(--bg-sunk)", borderRadius:999, overflow:"hidden"}}>
                          <div style={{width:`${Math.min(100, weight*3)}%`, height:"100%", background: weight>25?"var(--neg)":weight>10?"var(--accent)":"var(--text-muted)"}}/>
                        </div>
                        <span style={{minWidth:38, fontSize:12}}>{fmtP(weight)}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{display:"flex", gap:2, justifyContent:"flex-end"}}>
                        {h._consolidated ? (
                          <span style={{fontSize:10, color:"var(--text-dim)", padding:"4px 6px", background:"var(--bg-sunk)", borderRadius:6}}>{h._sourceIds.length} pos</span>
                        ) : (
                          <>
                            <button className="icon-btn" style={{width:26, height:26}} onClick={()=>openModal('position', h)}><Icon name="edit" size={12}/></button>
                            <button className="icon-btn" style={{width:26, height:26}} onClick={()=>deletePosition(h.id)}><Icon name="trash" size={12}/></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// -- Assets & Liabilities Tab (from NetWorthScreen) --
const AssetsTab = ({ state, refresh, openModal, privacyMode }) => {
  const entries = state.entries || [];
  const assets = entries.filter(e => e.type === 'asset');
  const liabilities = entries.filter(e => e.type === 'liability');
  const totalA = assets.reduce((s,e)=>s+e.amount, 0);
  const totalL = liabilities.reduce((s,e)=>s+e.amount, 0);
  const net = totalA - totalL;

  const deleteEntry = (id) => {
    APP_STATE.entries = APP_STATE.entries.filter(e => e.id !== id);
    window.saveData();
    if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
    refresh();
  };

  return (
    <>
      <div className="waterfall" style={{marginBottom:20}}>
        <div className="wf-col assets">
          <span className="eyebrow">{tl("networth.assets")}</span>
          <div className={`big${privacyMode ? ' sensitive' : ''}`} style={{color:"var(--pos)"}}>{fmtC(totalA)}</div>
          <div style={{marginTop:8, fontSize:12, color:"var(--text-muted)"}}>{assets.length} {isEn()?'accounts':'konti'}</div>
        </div>
        <div className="wf-col liab">
          <span className="eyebrow">{tl("networth.liabilities")}</span>
          <div className={`big${privacyMode ? ' sensitive' : ''}`} style={{color: totalL>0?"var(--neg)":"var(--text)"}}>- {fmtC(totalL)}</div>
          <div style={{marginTop:8, fontSize:12, color:"var(--text-muted)"}}>{liabilities.length} {isEn()?'obligations':'forpligtelser'}</div>
        </div>
        <div className="wf-col net">
          <span className="eyebrow">{tl("networth.netWorth")}</span>
          <div className={`big${privacyMode ? ' sensitive' : ''}`}>{fmtC(net)}</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">{tl("networth.assets")}</h3>
              <div style={{fontSize:12, color:"var(--text-dim)", marginTop:4}}>{assets.length} {isEn()?'accounts':'konti'}</div>
            </div>
            <button className="btn btn-sm" onClick={()=>openModal('entry', {type:'asset'})}>
              <Icon name="plus" size={14}/> {isEn()?'Add':'Tilfoej'}
            </button>
          </div>
          {assets.length === 0 ? <div style={{color:"var(--text-dim)", fontSize:13}}>{tl("networth.noAssets")}</div> :
            assets.map(a => {
              const catLabels = { cash: isEn()?'Bank account':'Bankkonto', savings: isEn()?'Savings':'Opsparing', investment: isEn()?'Investment':'Investering', property: isEn()?'Property':'Ejendom', pension: 'Pension', vehicle: isEn()?'Vehicle':'Koretoj', other_asset: isEn()?'Other':'Andet' };
              const catIcons = { cash:'dollar', savings:'shield', investment:'trending', property:'home', pension:'briefcase', vehicle:'zap', other_asset:'briefcase' };
              return (
                <div key={a.id} className="line-row">
                  <div className="line-mark"><Icon name={a.autoSynced?"zap":(catIcons[a.category]||"dollar")}/></div>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="line-name">{a.name}</div>
                    <div className="line-sub">
                      {catLabels[a.category]||a.category}
                      {a.interestRate ? ` · ${a.interestRate}%` : ''}
                      {a.notes ? ` · ${a.notes}` : ''}
                      {a.autoSynced ? (isEn()?' · Auto-synced':' · Auto-synkroniseret') : ''}
                    </div>
                  </div>
                  <div className={`line-val${privacyMode ? ' sensitive' : ''}`} style={{color:"var(--pos)"}}>{fmtC(a.amount)}</div>
                  <div className="line-actions">
                    <button className="icon-btn" style={{width:28, height:28}} onClick={()=>openModal('entry', a)}><Icon name="edit" size={13}/></button>
                    <button className="icon-btn" style={{width:28, height:28}} onClick={()=>deleteEntry(a.id)}><Icon name="trash" size={13}/></button>
                  </div>
                </div>
              );
            })
          }
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">{tl("networth.liabilities")}</h3>
              <div style={{fontSize:12, color:"var(--text-dim)", marginTop:4}}>{liabilities.length} {isEn()?'active':'aktive'}</div>
            </div>
            <button className="btn btn-sm" onClick={()=>openModal('entry', {type:'liability'})}>
              <Icon name="plus" size={14}/> {isEn()?'Add':'Tilfoej'}
            </button>
          </div>
          {liabilities.length === 0 ? <div style={{color:"var(--text-dim)", fontSize:13}}>{tl("networth.noLiabilities")}</div> :
            liabilities.map(a => {
              const catLabels = { mortgage: isEn()?'Mortgage':'Realkreditlaan', student_loan: isEn()?'Student loan':'Studielaan', car_loan: isEn()?'Car loan':'Billaan', credit_card: isEn()?'Credit card':'Kreditkort', other_liability: isEn()?'Other':'Andet' };
              const catIcons = { mortgage:'home', student_loan:'edit', car_loan:'zap', credit_card:'alert', other_liability:'briefcase' };
              return (
                <div key={a.id} className="line-row">
                  <div className="line-mark"><Icon name={catIcons[a.category]||"briefcase"}/></div>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="line-name">{a.name}</div>
                    <div className="line-sub">
                      {catLabels[a.category]||a.category}
                      {a.interestRate ? ` · ${a.interestRate}%` : ''}
                      {a.notes ? ` · ${a.notes}` : ''}
                    </div>
                  </div>
                  <div className={`line-val${privacyMode ? ' sensitive' : ''}`} style={{color:"var(--neg)"}}>- {fmtC(a.amount)}</div>
                  <div className="line-actions">
                    <button className="icon-btn" style={{width:28, height:28}} onClick={()=>openModal('entry', a)}><Icon name="edit" size={13}/></button>
                    <button className="icon-btn" style={{width:28, height:28}} onClick={()=>deleteEntry(a.id)}><Icon name="trash" size={13}/></button>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </>
  );
};

// -- Pension Tab (from PensionScreen) --
const PensionTab = ({ state, refresh, openModal, activeMember, privacyMode }) => {
  const isHousehold = activeMember === 'household';
  const pensionEntries = (state.entries || []).filter(e => e.category === 'pension');
  const currentPension = pensionEntries.reduce((s, e) => s + (e.amount || 0), 0);

  const configKey = activeMember && activeMember !== 'me' && activeMember !== 'household'
    ? `pi-pension-config-${activeMember}` : 'pi-pension-config';
  const defaults = { monthly: 2000, match: 0, currentAge: 39, retireAge: 67, lumpSum: 0 };

  const householdMembers = useMemo(() => loadHousehold(), []);
  const aggregatedConfig = useMemo(() => {
    if (!isHousehold) return null;
    const loadCfg = (key) => {
      try { return { ...defaults, ...(JSON.parse(localStorage.getItem(key)) || {}) }; } catch { return defaults; }
    };
    const myCfg = loadCfg('pi-pension-config');
    const allCfgs = [{ label: 'Me', cfg: myCfg }];
    householdMembers.forEach(m => {
      allCfgs.push({ label: m.name, cfg: loadCfg(`pi-pension-config-${m.id}`) });
    });
    const totalLump = allCfgs.reduce((s, c) => s + (c.cfg.lumpSum || 0), 0);
    const totalMonthly = allCfgs.reduce((s, c) => s + (c.cfg.monthly || 0) * (1 + (c.cfg.match || 0) / 100), 0);
    const youngestAge = Math.min(...allCfgs.map(c => c.cfg.currentAge || 39));
    const latestRetire = Math.max(...allCfgs.map(c => c.cfg.retireAge || 67));
    return { lumpSum: totalLump, monthly: totalMonthly, match: 0, currentAge: youngestAge, retireAge: latestRetire, members: allCfgs };
  }, [isHousehold, householdMembers]);

  const [config, setConfig] = useState(() => {
    if (isHousehold && aggregatedConfig) return { ...defaults, ...aggregatedConfig };
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(configKey)) || {}) }; } catch { return defaults; }
  });
  const [activeScenario, setActiveScenario] = useState(1);
  const [hoverYear, setHoverYear] = useState(null);

  const updateConfig = (key, val) => {
    if (isHousehold) return;
    const next = { ...config, [key]: parseFloat(val) || 0 };
    setConfig(next);
    try { localStorage.setItem(configKey, JSON.stringify(next)); } catch {}
  };

  const effectiveConfig = isHousehold && aggregatedConfig ? aggregatedConfig : config;
  const yearsToRetire = Math.max(0, (effectiveConfig.retireAge || 67) - (effectiveConfig.currentAge || 30));
  const totalMonthlyWithMatch = isHousehold ? (aggregatedConfig?.monthly || 0) : (config.monthly || 0) * (1 + (config.match || 0) / 100);
  const totalCurrentPension = currentPension + (effectiveConfig.lumpSum || 0);

  const scenarios = useMemo(() =>
    window.computePensionProjection
      ? computePensionProjection(totalCurrentPension,
          isHousehold ? totalMonthlyWithMatch : config.monthly,
          isHousehold ? 0 : config.match,
          effectiveConfig.retireAge, effectiveConfig.currentAge)
      : [],
    [totalCurrentPension, config.monthly, config.match, effectiveConfig.retireAge, effectiveConfig.currentAge, totalMonthlyWithMatch, isHousehold]
  );

  const scenarioColors = ["oklch(0.60 0.14 45)", "oklch(0.55 0.16 145)", "oklch(0.55 0.14 265)"];
  const scenarioNames = ["Conservative", "Moderate", "Aggressive"];
  const scenarioNamesDa = ["Konservativ", "Moderat", "Aggressiv"];
  const scenarioIcons = ["shield", "target", "zap"];

  const maxVal = scenarios.length ? Math.max(...scenarios.flatMap(s => s.points.map(p => p.value))) : 0;
  const chartW = 640, chartH = 260, padL = 70, padR = 20, padT = 24, padB = 36;
  const plotW = chartW - padL - padR, plotH = chartH - padT - padB;
  const monthlyIncome = scenarios.length > 0 ? Math.round(scenarios[activeScenario].finalValue * 0.04 / 12) : 0;

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--bg-sunk)",
    color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 16,
    fontWeight: 500, textAlign: "right", outline: "none", transition: "border-color 0.2s",
  };
  const labelStyle = { fontSize: 12, color: "var(--text-dim)", marginBottom: 6, display: "block", fontWeight: 500 };

  return (
    <>
      {/* Hero KPI row */}
      <div className="grid grid-12" style={{marginBottom: 24}}>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Current pension' : 'Nuvaerende pension'}</div>
          <div className="value" style={{fontSize: 28}}>{fmtC(totalCurrentPension)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
            {totalCurrentPension > 0 ? (isEn() ? 'starting balance' : 'startsaldo') : (isEn() ? 'set below' : 'indstil nedenfor')}
          </div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Years to retirement' : 'AAr til pension'}</div>
          <div className="value" style={{fontSize: 28}}>{yearsToRetire}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
            {isEn() ? `Age ${effectiveConfig.currentAge} -> ${effectiveConfig.retireAge}` : `Alder ${effectiveConfig.currentAge} -> ${effectiveConfig.retireAge}`}
          </div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Monthly savings' : 'Maanedlig opsparing'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28}}>{fmtC(totalMonthlyWithMatch)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
            {config.match > 0 ? (isEn() ? `incl. ${config.match}% match` : `inkl. ${config.match}% match`) : (isEn() ? 'your contribution' : 'dit bidrag')}
          </div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Est. monthly income' : 'Est. maanedlig indkomst'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28, color: "var(--pos)"}}>{fmtC(monthlyIncome)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
            {isEn() ? '4% withdrawal rule' : '4% udtraekningsregel'}
          </div>
        </div>
      </div>

      {/* Settings card */}
      <div className="card" style={{marginBottom: 24}}>
        <div className="card-head">
          <h3 className="card-title"><Icon name="sliders" size={15} style={{marginRight: 6, opacity: 0.5}}/>{isHousehold ? (isEn() ? 'Household breakdown' : 'Husstandsoversigt') : (isEn() ? 'Projection settings' : 'Fremskrivningsindstillinger')}</h3>
        </div>
        {isHousehold && aggregatedConfig ? (
          <>
            <div style={{display: "grid", gridTemplateColumns: `repeat(${aggregatedConfig.members.length}, 1fr)`, gap: 16, marginBottom: 16}}>
              {aggregatedConfig.members.map((m, i) => {
                const c = m.cfg;
                const mMonthly = (c.monthly || 0) * (1 + (c.match || 0) / 100);
                return (
                  <div key={i} style={{padding: 16, borderRadius: 12, background: "var(--bg-sunk)", border: "1px solid var(--border)"}}>
                    <div style={{fontWeight: 600, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6}}>
                      <Icon name={i === 0 ? "user" : (householdMembers[i-1]?.role === 'child' ? "baby" : "user")} size={14} style={{opacity: 0.5}} />
                      {m.label}
                    </div>
                    <div style={{display: "grid", gap: 8}}>
                      <div style={{display: "flex", justifyContent: "space-between", fontSize: 12}}>
                        <span style={{color: "var(--text-dim)"}}>{isEn() ? 'Savings' : 'Opsparing'}</span>
                        <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily: "var(--font-mono)", fontWeight: 500}}>{fmtC(c.lumpSum || 0)}</span>
                      </div>
                      <div style={{display: "flex", justifyContent: "space-between", fontSize: 12}}>
                        <span style={{color: "var(--text-dim)"}}>{isEn() ? 'Monthly' : 'Maanedlig'}</span>
                        <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily: "var(--font-mono)", fontWeight: 500}}>{fmtC(mMonthly)}</span>
                      </div>
                      <div style={{display: "flex", justifyContent: "space-between", fontSize: 12}}>
                        <span style={{color: "var(--text-dim)"}}>{isEn() ? 'Age' : 'Alder'}</span>
                        <span style={{fontFamily: "var(--font-mono)", fontWeight: 500}}>{c.currentAge || 39} -> {c.retireAge || 67}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{fontSize: 11, color: "var(--text-dim)", textAlign: "center", padding: "4px 0"}}>
              {isEn() ? 'Projection uses combined savings & contributions. Switch to an individual member to edit.' : 'Fremskrivning bruger samlede opsparinger. Skift til et enkelt medlem for at redigere.'}
            </div>
          </>
        ) : (
          <>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20}}>
              <div>
                <label style={labelStyle}>{isEn() ? 'Current pension savings' : 'Nuvaerende pensionsopsparing'}</label>
                <input type="number" value={config.lumpSum || ''} step="10000" min="0"
                  placeholder={isEn() ? 'e.g. 250000' : 'f.eks. 250000'}
                  onChange={e => updateConfig('lumpSum', e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  style={inputStyle} />
                <div style={{fontSize: 10, color: "var(--text-dim)", marginTop: 4, textAlign: "right"}}>{isEn() ? 'total saved so far (kr.)' : 'samlet opsparet (kr.)'}</div>
              </div>
              <div>
                <label style={labelStyle}>{isEn() ? 'Monthly contribution' : 'Maanedligt bidrag'}</label>
                <input type="number" value={config.monthly} step="500"
                  onChange={e => updateConfig('monthly', e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  style={inputStyle} />
                <div style={{fontSize: 10, color: "var(--text-dim)", marginTop: 4, textAlign: "right"}}>kr. / {isEn() ? 'month' : 'maaned'}</div>
              </div>
              <div>
                <label style={labelStyle}>{isEn() ? 'Employer match' : 'Arbejdsgiver match'}</label>
                <input type="number" value={config.match} step="1" min="0" max="100"
                  onChange={e => updateConfig('match', e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  style={inputStyle} />
                <div style={{fontSize: 10, color: "var(--text-dim)", marginTop: 4, textAlign: "right"}}>%</div>
              </div>
            </div>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20}}>
              <div>
                <label style={labelStyle}>{isEn() ? 'Current age' : 'Nuvaerende alder'}: <strong style={{color: "var(--text)"}}>{config.currentAge}</strong></label>
                <input type="range" min="18" max="65" value={config.currentAge}
                  onChange={e => updateConfig('currentAge', e.target.value)}
                  style={{width: "100%", marginTop: 8, accentColor: "var(--accent)"}} />
                <div style={{display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)", marginTop: 2}}>
                  <span>18</span><span>65</span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>{isEn() ? 'Retirement age' : 'Pensionsalder'}: <strong style={{color: "var(--text)"}}>{config.retireAge}</strong></label>
                <input type="range" min="55" max="80" value={config.retireAge}
                  onChange={e => updateConfig('retireAge', e.target.value)}
                  style={{width: "100%", marginTop: 8, accentColor: "var(--accent)"}} />
                <div style={{display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)", marginTop: 2}}>
                  <span>55</span><span>80</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Scenario cards */}
      {scenarios.length > 0 && (
        <>
          <div className="grid grid-12" style={{marginBottom: 24}}>
            {scenarios.map((s, i) => {
              const isActive = activeScenario === i;
              const growthPct = s.totalContributed > 0 ? ((s.totalGrowth / s.totalContributed) * 100) : 0;
              const contribFrac = s.finalValue > 0 ? (s.totalContributed / s.finalValue * 100) : 0;
              return (
                <div key={i} className="card col-4" onClick={() => setActiveScenario(i)}
                  style={{
                    cursor: "pointer", transition: "all 0.25s",
                    borderColor: isActive ? scenarioColors[i] : "var(--border)",
                    boxShadow: isActive ? `0 0 0 1px ${scenarioColors[i]}, 0 4px 20px ${scenarioColors[i]}22` : "none",
                    opacity: isActive ? 1 : 0.7,
                    transform: isActive ? "translateY(-2px)" : "none",
                  }}>
                  <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 14}}>
                    <div style={{width: 32, height: 32, borderRadius: 8, background: `${scenarioColors[i]}18`, display: "flex", alignItems: "center", justifyContent: "center"}}>
                      <Icon name={scenarioIcons[i]} size={16} style={{color: scenarioColors[i]}} />
                    </div>
                    <div>
                      <div style={{fontWeight: 600, fontSize: 13}}>{isEn() ? scenarioNames[i] : scenarioNamesDa[i]}</div>
                      <div style={{fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)"}}>{(s.rate * 100).toFixed(0)}% p.a.</div>
                    </div>
                    {isActive && <div style={{marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: scenarioColors[i]}} />}
                  </div>
                  <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 26, marginBottom: 8}}>{fmtC(s.finalValue)}</div>
                  <div style={{height: 6, borderRadius: 3, overflow: "hidden", display: "flex", background: "var(--bg-sunk)", marginBottom: 10}}>
                    <div style={{width: `${contribFrac}%`, background: "var(--text-muted)", opacity: 0.4, transition: "width 0.3s"}} />
                    <div style={{flex: 1, background: scenarioColors[i], opacity: 0.5, transition: "width 0.3s"}} />
                  </div>
                  <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8}}>
                    <div>
                      <div style={{fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em"}}>{isEn() ? 'Contributed' : 'Indbetalt'}</div>
                      <div className={privacyMode ? 'sensitive' : ''} style={{fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)"}}>{fmtC(s.totalContributed)}</div>
                    </div>
                    <div>
                      <div style={{fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em"}}>{isEn() ? 'Growth' : 'Afkast'}</div>
                      <div className={privacyMode ? 'sensitive' : ''} style={{fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--pos)"}}>{fmtC(s.totalGrowth)} <span style={{fontSize: 10, opacity: 0.7}}>({growthPct.toFixed(0)}%)</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive projection chart */}
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">{isEn() ? 'Projection to retirement' : 'Fremskrivning til pension'}</h3>
              <div style={{display: "flex", gap: 14}}>
                {scenarios.map((s, i) => (
                  <span key={i} onClick={() => setActiveScenario(i)} style={{
                    display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11,
                    opacity: activeScenario === i ? 1 : 0.45, transition: "opacity 0.2s",
                    fontWeight: activeScenario === i ? 600 : 400,
                  }}>
                    <span style={{width: 8, height: 8, borderRadius: 2, background: scenarioColors[i]}} />
                    {(s.rate * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
            <div style={{position: "relative"}}>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{width: "100%", height: 300}}
                onMouseLeave={() => setHoverYear(null)}>
                {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                  const val = maxVal * frac;
                  const y = padT + plotH - (frac * plotH);
                  return (
                    <g key={frac}>
                      <line x1={padL} x2={chartW - padR} y1={y} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,3" />
                      <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="var(--font-mono)">{fmtC(val)}</text>
                    </g>
                  );
                })}
                {scenarios.map((s, si) => {
                  const isActive = activeScenario === si;
                  const pts = s.points.map((p, pi) => {
                    const x = padL + (pi / Math.max(1, s.points.length - 1)) * plotW;
                    const y = padT + plotH - (maxVal > 0 ? (p.value / maxVal) * plotH : 0);
                    return `${x},${y}`;
                  }).join(' ');
                  const firstX = padL, lastX = padL + plotW, baseline = padT + plotH;
                  return (
                    <g key={si} style={{transition: "opacity 0.3s", opacity: isActive ? 1 : 0.2}}>
                      <polygon points={`${firstX},${baseline} ${pts} ${lastX},${baseline}`} fill={scenarioColors[si]} opacity={isActive ? 0.12 : 0.05} />
                      <polyline points={pts} fill="none" stroke={scenarioColors[si]} strokeWidth={isActive ? 2.5 : 1.5} />
                      {s.points.length > 0 && (() => {
                        const lastPt = s.points[s.points.length - 1];
                        const lx = padL + plotW;
                        const ly = padT + plotH - (maxVal > 0 ? (lastPt.value / maxVal) * plotH : 0);
                        return isActive ? <circle cx={lx} cy={ly} r={4} fill={scenarioColors[si]} stroke="var(--bg-card)" strokeWidth="2" /> : null;
                      })()}
                    </g>
                  );
                })}
                {scenarios[0]?.points.map((p, pi) => {
                  const x = padL + (pi / Math.max(1, scenarios[0].points.length - 1)) * plotW;
                  const w = plotW / Math.max(1, scenarios[0].points.length - 1);
                  return (
                    <rect key={pi} x={x - w / 2} y={padT} width={w} height={plotH}
                      fill="transparent" style={{cursor: "crosshair"}}
                      onMouseEnter={() => setHoverYear(pi)} />
                  );
                })}
                {hoverYear != null && scenarios[0]?.points[hoverYear] && (() => {
                  const x = padL + (hoverYear / Math.max(1, scenarios[0].points.length - 1)) * plotW;
                  const activeS = scenarios[activeScenario];
                  const pt = activeS.points[hoverYear];
                  const y = padT + plotH - (maxVal > 0 ? (pt.value / maxVal) * plotH : 0);
                  return (
                    <g>
                      <line x1={x} x2={x} y1={padT} y2={padT + plotH} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                      <circle cx={x} cy={y} r={5} fill={scenarioColors[activeScenario]} stroke="var(--bg-card)" strokeWidth="2" />
                      <rect x={x - 50} y={y - 28} width={100} height={22} rx={6} fill="var(--bg-raised)" stroke="var(--border)" strokeWidth="0.5" />
                      <text x={x} y={y - 14} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fontWeight="600" fill="var(--text)">{fmtC(pt.value)}</text>
                      <text x={x} y={padT + plotH + 14} textAnchor="middle" fontSize="9" fill="var(--accent)" fontFamily="var(--font-mono)" fontWeight="600">{isEn() ? `Age ${pt.year}` : `Alder ${pt.year}`}</text>
                    </g>
                  );
                })()}
                {hoverYear == null && scenarios[0]?.points.filter((_, i) => i % 5 === 0 || i === scenarios[0].points.length - 1).map((p, pi) => {
                  const idx = scenarios[0].points.indexOf(p);
                  const x = padL + (idx / Math.max(1, scenarios[0].points.length - 1)) * plotW;
                  return <text key={pi} x={x} y={chartH - 8} textAnchor="middle" fontSize="9" fill="var(--text-dim)" fontFamily="var(--font-mono)">{isEn() ? `Age ${p.year}` : `${p.year}`}</text>;
                })}
              </svg>
            </div>
          </div>

          {/* Pension accounts list */}
          <div className="card" style={{marginTop: 24}}>
            <div className="card-head">
              <h3 className="card-title">{isEn() ? 'Your pension accounts' : 'Dine pensionskonti'}</h3>
              <button className="btn btn-sm" onClick={() => openModal('entry', { type: 'asset', category: 'pension' })}>
                <Icon name="plus" size={13}/> {isEn() ? 'Add' : 'Tilfoej'}
              </button>
            </div>
            {pensionEntries.length === 0 ? (
              <div style={{textAlign: "center", padding: "24px 16px", color: "var(--text-dim)", fontSize: 13}}>
                {isEn() ? 'No pension accounts yet. Add one to track your retirement savings.' : 'Ingen pensionskonti endnu. Tilfoej en for at folge din pensionsopsparing.'}
              </div>
            ) : pensionEntries.map((e, i) => (
              <div key={e.id || i} className="line-row" style={{alignItems: "center"}}>
                <div className="line-mark"><Icon name="briefcase" /></div>
                <div style={{flex: 1}}>
                  <div className="line-name">{e.name || (isEn() ? 'Pension account' : 'Pensionskonto')}</div>
                  <div className="line-sub">{e.provider || e.category}</div>
                </div>
                <div className="line-val" style={{marginRight: 8}}>{fmtC(e.amount)}</div>
                <div style={{display: "flex", gap: 2}}>
                  <button className="icon-btn" style={{width: 28, height: 28}} onClick={() => openModal('entry', e)}><Icon name="edit" size={13}/></button>
                  <button className="icon-btn" style={{width: 28, height: 28}} onClick={() => {
                    if (confirm(isEn() ? `Delete "${e.name}"?` : `Slet "${e.name}"?`)) {
                      APP_STATE.entries = APP_STATE.entries.filter(x => x.id !== e.id);
                      window.saveData();
                      if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
                      refresh();
                    }
                  }}><Icon name="trash" size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {currentPension === 0 && scenarios.length > 0 && (
        <div className="card" style={{textAlign: "center", padding: "32px 24px", marginTop: 16, background: "var(--bg-sunk)", borderStyle: "dashed"}}>
          <Icon name="trending" size={36} style={{color: "var(--text-dim)", marginBottom: 10}} />
          <p style={{color: "var(--text-muted)", fontSize: 13, maxWidth: 360, margin: "0 auto", lineHeight: 1.5}}>
            {isEn()
              ? 'Your projections are based on contributions only. Add pension entries to include your current balance.'
              : 'Dine fremskrivninger er kun baseret paa bidrag. Tilfoej pensionsposter for at inkludere din nuvaerende saldo.'}
          </p>
        </div>
      )}
    </>
  );
};

// -- Property Tab (from MortgageScreen) --
const PropertyTab = ({ state, refresh, openModal, household, activeMember, privacyMode }) => {
  const entries = state.entries || [];

  const assetCategories = {
    property:    { icon: "home",      en: "Real estate",    da: "Ejendom",     color: "oklch(0.55 0.14 145)" },
    vehicle:     { icon: "zap",       en: "Vehicles",       da: "Koeretoejer",   color: "oklch(0.55 0.14 265)" },
    other_asset: { icon: "briefcase", en: "Other assets",   da: "Andre aktiver",color: "oklch(0.60 0.14 45)" },
  };
  const loanCategories = {
    mortgage:       { icon: "home",      en: "Mortgage",       da: "Realkreditlaan",  color: "oklch(0.55 0.15 25)" },
    car_loan:       { icon: "zap",       en: "Car loan",       da: "Billaan",         color: "oklch(0.55 0.14 350)" },
    student_loan:   { icon: "edit",      en: "Student loan",   da: "Studielaan",      color: "oklch(0.60 0.12 265)" },
    credit_card:    { icon: "alert",     en: "Credit card",    da: "Kreditkort",     color: "oklch(0.55 0.16 45)" },
    other_liability:{ icon: "briefcase", en: "Other loans",    da: "Anden gaeld",     color: "oklch(0.55 0.10 200)" },
  };

  const bigAssets = entries.filter(e => e.type === 'asset' && assetCategories[e.category]);
  const allLoans = entries.filter(e => e.type === 'liability');

  const totalBigAssets = bigAssets.reduce((s, e) => s + (e.amount || 0), 0);
  const totalLoans = allLoans.reduce((s, e) => s + (e.amount || 0), 0);
  const netPosition = totalBigAssets - totalLoans;

  const propertyValue = entries.filter(e => e.category === 'property').reduce((s, e) => s + (e.amount || 0), 0);
  const mortgageBalance = entries.filter(e => e.category === 'mortgage').reduce((s, e) => s + (e.amount || 0), 0);

  const defaults = { rate: 3.5, payment: 8000, years: 25 };
  const [config, setConfig] = useState(() => {
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem('pi-mortgage-config')) || {}) }; } catch { return defaults; }
  });
  const updateConfig = (key, val) => {
    const next = { ...config, [key]: parseFloat(val) || 0 };
    setConfig(next);
    try { localStorage.setItem('pi-mortgage-config', JSON.stringify(next)); } catch {}
  };

  const hasPartner = (household || []).some(m => m.relation === 'partner');
  const partner = (household || []).find(m => m.relation === 'partner');
  const [ownershipSplit, setOwnershipSplit] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pi-property-split')) || { me: 50 }; } catch { return { me: 50 }; }
  });
  const myPct = ownershipSplit.me ?? 50;
  const partnerPct = 100 - myPct;
  const updateSplit = (meVal) => {
    const clamped = Math.max(0, Math.min(100, parseInt(meVal) || 0));
    const next = { me: clamped };
    setOwnershipSplit(next);
    try { localStorage.setItem('pi-property-split', JSON.stringify(next)); } catch {}
  };

  const projection = useMemo(() =>
    window.computeMortgageProjection
      ? computeMortgageProjection(propertyValue, mortgageBalance, config.rate, config.payment, config.years)
      : null,
    [propertyValue, mortgageBalance, config.rate, config.payment, config.years]
  );

  const homeEquity = propertyValue - mortgageBalance;
  const ltv = propertyValue > 0 ? (mortgageBalance / propertyValue * 100) : 0;

  const chartW = 640, chartH = 240, padL = 70, padR = 20, padT = 24, padB = 36;
  const plotW = chartW - padL - padR, plotH = chartH - padT - padB;

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--bg-sunk)",
    color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 16,
    fontWeight: 500, textAlign: "right", outline: "none", transition: "border-color 0.2s",
  };
  const labelStyle = { fontSize: 12, color: "var(--text-dim)", marginBottom: 6, display: "block", fontWeight: 500 };

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-12" style={{marginBottom: 24}}>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Total assets' : 'Aktiver i alt'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28}}>{fmtC(totalBigAssets)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>{bigAssets.length} {isEn() ? 'items' : 'poster'}</div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Total loans' : 'Laan i alt'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28, color: "var(--neg)"}}>{fmtC(totalLoans)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>{allLoans.length} {isEn() ? 'loans' : 'laan'}</div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Net position' : 'Netto'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28, color: netPosition >= 0 ? "var(--pos)" : "var(--neg)"}}>{fmtC(netPosition)}</div>
        </div>
        {propertyValue > 0 && (
          <div className="card col-3 stat">
            <div className="eyebrow">LTV</div>
            <div className="value" style={{fontSize: 28, color: ltv > 80 ? "var(--neg)" : ltv > 60 ? "var(--accent)" : "var(--pos)"}}>{ltv.toFixed(1)}%</div>
            <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
              <span className={privacyMode ? 'sensitive' : ''}>{fmtC(homeEquity)}</span> {isEn() ? 'equity' : 'frivaerdi'}
            </div>
          </div>
        )}
      </div>

      {/* Property ownership split */}
      {hasPartner && propertyValue > 0 && (
        <div className="card" style={{marginBottom: 24}}>
          <div className="card-head">
            <h3 className="card-title"><Icon name="users" size={15} style={{marginRight: 6, opacity: 0.5}}/>{isEn() ? 'Property ownership' : 'Ejendomsejerskab'}</h3>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr auto 1fr", gap: 20, alignItems: "center"}}>
            <div style={{textAlign: "center"}}>
              <div style={{fontSize: 12, color: "var(--text-dim)", marginBottom: 6, fontWeight: 500}}>
                <Icon name="user" size={12} style={{marginRight: 4, opacity: 0.5}}/>{isEn() ? 'Me' : 'Mig'}
              </div>
              <div style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600}}>{myPct}%</div>
              <div className={privacyMode ? 'sensitive' : ''} style={{fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--pos)", marginTop: 4}}>
                {fmtC(homeEquity * myPct / 100)}
              </div>
            </div>
            <div style={{width: 200, textAlign: "center"}}>
              <input type="range" min="0" max="100" step="5" value={myPct}
                onChange={e => updateSplit(e.target.value)}
                style={{width: "100%", accentColor: "var(--accent)"}} />
              <div style={{display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)", marginTop: 2}}>
                <span>0%</span><span>50/50</span><span>100%</span>
              </div>
            </div>
            <div style={{textAlign: "center"}}>
              <div style={{fontSize: 12, color: "var(--text-dim)", marginBottom: 6, fontWeight: 500}}>
                <Icon name="user" size={12} style={{marginRight: 4, opacity: 0.5}}/>{partner?.name || 'Partner'}
              </div>
              <div style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600}}>{partnerPct}%</div>
              <div className={privacyMode ? 'sensitive' : ''} style={{fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--pos)", marginTop: 4}}>
                {fmtC(homeEquity * partnerPct / 100)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mortgage amortization */}
      {propertyValue > 0 && mortgageBalance > 0 && (
        <div className="card" style={{marginBottom: 24}}>
          <div className="card-head">
            <h3 className="card-title"><Icon name="home" size={15} style={{marginRight: 6, opacity: 0.5}}/>{isEn() ? 'Mortgage amortization' : 'Realkreditlaan afdrag'}</h3>
          </div>
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 16}}>
            <div>
              <label style={labelStyle}>{isEn() ? 'Interest rate %' : 'Rente %'}</label>
              <input type="number" step="0.1" value={config.rate}
                onChange={e => updateConfig('rate', e.target.value)}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isEn() ? 'Monthly payment' : 'Maanedlig ydelse'}</label>
              <input type="number" step="500" value={config.payment}
                onChange={e => updateConfig('payment', e.target.value)}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isEn() ? 'Remaining years' : 'Resterende aar'}: <strong style={{color: "var(--text)"}}>{config.years}</strong></label>
              <input type="range" min="1" max="30" value={config.years}
                onChange={e => updateConfig('years', e.target.value)}
                style={{width: "100%", marginTop: 12, accentColor: "var(--accent)"}} />
            </div>
          </div>
          {projection && (
            <div style={{display: "flex", gap: 24, padding: "12px 0", borderTop: "1px solid var(--border)", fontSize: 13}}>
              <span style={{color: "var(--text-muted)"}}>{isEn() ? 'Monthly payment' : 'Ydelse'}: <strong style={{color: "var(--text)"}}>{fmtC(projection.monthlyPayment)}</strong></span>
              <span style={{color: "var(--text-muted)"}}>{isEn() ? 'Total interest' : 'Samlet rente'}: <strong style={{color: "var(--neg)"}}>{fmtC(projection.totalInterest)}</strong></span>
              <span style={{color: "var(--text-muted)", marginLeft: "auto"}}>{isEn() ? 'Debt free in' : 'Gaeldfri om'} <strong style={{color: "var(--pos)"}}>{config.years} {isEn() ? 'years' : 'aar'}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Equity growth chart */}
      {projection && projection.points && projection.points.length > 1 && (
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">{isEn() ? 'Equity growth over time' : 'Frivaerdivaekst over tid'}</h3>
          </div>
          <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{width: "100%", height: 280}}>
            {[0, 0.25, 0.5, 0.75, 1].map(frac => {
              const val = propertyValue * frac;
              const y = padT + plotH - (frac * plotH);
              return (
                <g key={frac}>
                  <line x1={padL} x2={chartW - padR} y1={y} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,3" />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="var(--font-mono)">{fmtC(val)}</text>
                </g>
              );
            })}
            {(() => {
              const pts = projection.points.map((p, i) => {
                const x = padL + (i / Math.max(1, projection.points.length - 1)) * plotW;
                const yDebt = padT + plotH - (propertyValue > 0 ? (p.debt / propertyValue) * plotH : 0);
                return `${x},${yDebt}`;
              }).join(' ');
              const baseline = padT + plotH;
              const firstX = padL, lastX = padL + plotW;
              return <polygon points={`${firstX},${baseline} ${pts} ${lastX},${baseline}`} fill="oklch(0.55 0.15 25 / 0.15)" />;
            })()}
            {(() => {
              const pts = projection.points.map((p, i) => {
                const x = padL + (i / Math.max(1, projection.points.length - 1)) * plotW;
                const yTop = padT;
                const yDebt = padT + plotH - (propertyValue > 0 ? (p.debt / propertyValue) * plotH : 0);
                return { x, yTop, yDebt };
              });
              const topPts = pts.map(p => `${p.x},${p.yTop}`).join(' ');
              const bottomPts = pts.map(p => `${p.x},${p.yDebt}`).reverse().join(' ');
              return <polygon points={`${topPts} ${bottomPts}`} fill="oklch(0.45 0.12 145 / 0.12)" />;
            })()}
            <polyline points={projection.points.map((p, i) => {
              const x = padL + (i / Math.max(1, projection.points.length - 1)) * plotW;
              const y = padT + plotH - (propertyValue > 0 ? (p.debt / propertyValue) * plotH : 0);
              return `${x},${y}`;
            }).join(' ')} fill="none" stroke="oklch(0.55 0.15 25)" strokeWidth="2" />
            {projection.points.filter((_, i) => i % 5 === 0 || i === projection.points.length - 1).map((p, pi) => {
              const idx = projection.points.indexOf(p);
              const x = padL + (idx / Math.max(1, projection.points.length - 1)) * plotW;
              return <text key={pi} x={x} y={chartH - 8} textAnchor="middle" fontSize="9" fill="var(--text-dim)" fontFamily="var(--font-mono)">{isEn() ? `Yr ${p.year}` : `Aar ${p.year}`}</text>;
            })}
          </svg>
        </div>
      )}

      {/* Empty state */}
      {totalBigAssets === 0 && totalLoans === 0 && (
        <div className="card" style={{textAlign: "center", padding: 40, background: "var(--bg-sunk)", borderStyle: "dashed"}}>
          <Icon name="home" size={36} style={{color: "var(--text-dim)", marginBottom: 10}} />
          <p style={{color: "var(--text-muted)", fontSize: 13, maxWidth: 400, margin: "0 auto", lineHeight: 1.5}}>
            {isEn()
              ? 'Add property, vehicles, and loans to see your full asset and liability picture here.'
              : 'Tilfoej ejendom, koeretoejer og laan for at se dit samlede aktiv- og gaeldsbillede her.'}
          </p>
        </div>
      )}
    </>
  );
};

// ==========================================================================
// HUGINN -- Portfolio Chatbot
// ==========================================================================
const HuginnScreen = ({ state, refresh, privacyMode, initialMessage }) => {
  // ── Chat persistence helpers ──────────────────────────────
  const CHATS_KEY = 'pi-huginn-chats';
  const ACTIVE_KEY = 'pi-huginn-active';

  const loadChats = () => {
    try { return JSON.parse(localStorage.getItem(CHATS_KEY)) || []; } catch { return []; }
  };
  const saveChats = (chats) => {
    try { localStorage.setItem(CHATS_KEY, JSON.stringify(chats)); } catch {}
  };
  const loadActiveId = () => {
    try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
  };
  const saveActiveId = (id) => {
    try { localStorage.setItem(ACTIVE_KEY, id || ''); } catch {}
  };

  // Initialize: load saved conversations or migrate from old in-memory state
  const [chats, setChatsState] = useState(() => {
    const saved = loadChats();
    // Migrate old in-memory messages if any
    if (saved.length === 0 && APP_STATE._huginnMessages && APP_STATE._huginnMessages.length > 0) {
      const migrated = [{
        id: 'chat-' + Date.now(),
        title: APP_STATE._huginnMessages.find(m => m.role === 'user')?.content?.substring(0, 50) || 'Portfolio overview',
        messages: APP_STATE._huginnMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
      saveChats(migrated);
      saveActiveId(migrated[0].id);
      return migrated;
    }
    return saved;
  });
  const setChats = (updater) => {
    setChatsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveChats(next);
      return next;
    });
  };

  const [activeChatId, _setActiveChatId] = useState(() => {
    const saved = loadActiveId();
    const allChats = loadChats();
    if (saved && allChats.find(c => c.id === saved)) return saved;
    if (allChats.length > 0) return allChats[0].id;
    return null;
  });
  const setActiveChatId = (id) => { _setActiveChatId(id); saveActiveId(id); };

  const activeChat = chats.find(c => c.id === activeChatId) || null;
  const messages = activeChat?.messages || [];

  // Wrapper: update messages for the active chat
  const setMessages = (updater) => {
    setChats(prev => prev.map(c => {
      if (c.id !== activeChatId) return c;
      const newMsgs = typeof updater === 'function' ? updater(c.messages) : updater;
      // Auto-title from first user message
      let title = c.title;
      if (title === 'New chat' || title === 'Ny chat') {
        const firstUser = newMsgs.find(m => m.role === 'user');
        if (firstUser) title = firstUser.content.substring(0, 60) + (firstUser.content.length > 60 ? '...' : '');
      }
      return { ...c, messages: newMsgs, title, updatedAt: new Date().toISOString() };
    }));
    // Keep APP_STATE in sync for tab navigation
    APP_STATE._huginnMessages = typeof updater === 'function' ? updater(messages) : updater;
  };

  // Create a new chat
  const createNewChat = () => {
    const newChat = {
      id: 'chat-' + Date.now(),
      title: isEn() ? 'New chat' : 'Ny chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    APP_STATE._huginnMessages = [];
    APP_STATE._huginnSessionStarted = false;
    return newChat.id;
  };

  // Delete a chat
  const deleteChat = (chatId) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      const remaining = chats.filter(c => c.id !== chatId);
      if (remaining.length > 0) {
        setActiveChatId(remaining[0].id);
        APP_STATE._huginnMessages = remaining[0].messages;
      } else {
        createNewChat();
      }
    }
  };

  // Switch to a chat
  const switchChat = (chatId) => {
    setActiveChatId(chatId);
    const chat = chats.find(c => c.id === chatId);
    APP_STATE._huginnMessages = chat?.messages || [];
    APP_STATE._huginnSessionStarted = chat?.messages?.length > 0;
  };

  // Sidebar toggle
  const [showHistory, setShowHistory] = useState(false);

  if (!APP_STATE._huginnSessionStarted) APP_STATE._huginnSessionStarted = false;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Build portfolio context string for the AI
  const buildPortfolioContext = () => {
    const positions = state.positions || [];
    const entries = state.entries || [];
    const scoreData = window.computePortfolioScore ? computePortfolioScore() : null;

    const totalPortfolio = positions.reduce((s, p) => s + toDKK((p.shares||0)*(p.currentPrice||0), p.currency), 0);
    const totalAssets = entries.filter(e => e.type === 'asset').reduce((s, e) => s + (e.amount||0), 0);
    const totalLiabilities = entries.filter(e => e.type === 'liability').reduce((s, e) => s + (e.amount||0), 0);

    const positionLines = positions.map(p => {
      const val = toDKK((p.shares||0)*(p.currentPrice||0), p.currency);
      const weight = totalPortfolio > 0 ? (val / totalPortfolio * 100).toFixed(1) : 0;
      const pnl = (p.avgPrice && p.avgPrice > 0 && p.currentPrice)
        ? ((p.currentPrice - p.avgPrice) / p.avgPrice * 100).toFixed(1) + '%' : 'n/a';
      const ownerLabel = p.owner && p.owner !== 'me' ? (() => { const m = loadHousehold().find(h => h.id === p.owner); return m ? ` [${m.name}]` : ''; })() : '';
      return `  ${p.ticker} (${p.type||'stock'}) — ${p.shares} shares @ ${(p.currentPrice||0).toFixed(2)} ${p.currency||'DKK'} — Value: ${Math.round(val).toLocaleString()} DKK (${weight}%) — P&L: ${pnl} — Broker: ${p.broker||'unknown'} / ${p.accountType||'free'}${ownerLabel}`;
    }).join('\n');

    const brokerGroups = {};
    positions.forEach(p => {
      const key = `${p.broker||'other'} / ${p.accountType||'free'}`;
      if (!brokerGroups[key]) brokerGroups[key] = { count: 0, value: 0 };
      brokerGroups[key].count++;
      brokerGroups[key].value += toDKK((p.shares||0)*(p.currentPrice||0), p.currency);
    });
    const brokerLines = Object.entries(brokerGroups).map(([k, v]) =>
      `  ${k}: ${v.count} positions, ${Math.round(v.value).toLocaleString()} DKK`
    ).join('\n');

    const typeGroups = {};
    positions.forEach(p => {
      const t = p.type || 'stock';
      if (!typeGroups[t]) typeGroups[t] = { count: 0, value: 0 };
      typeGroups[t].count++;
      typeGroups[t].value += toDKK((p.shares||0)*(p.currentPrice||0), p.currency);
    });
    const typeLines = Object.entries(typeGroups).map(([k, v]) =>
      `  ${k}: ${v.count} positions, ${Math.round(v.value).toLocaleString()} DKK (${totalPortfolio > 0 ? (v.value/totalPortfolio*100).toFixed(1) : 0}%)`
    ).join('\n');

    // ASK (Aktiesparekonto) cap analysis
    const ASK_CONTRIBUTION_CAP_2026 = 135300; // 2026 limit
    const askPositions = positions.filter(p => p.accountType === 'ask');
    const askTotalValue = askPositions.reduce((s, p) => s + toDKK((p.shares||0)*(p.currentPrice||0), p.currency), 0);
    let askSection = '';
    if (askPositions.length > 0) {
      const overCap = askTotalValue > ASK_CONTRIBUTION_CAP_2026;
      askSection = `\nAKTIESPAREKONTO (ASK) STATUS:
  Current ASK value: ${Math.round(askTotalValue).toLocaleString()} DKK
  2026 contribution cap: ${ASK_CONTRIBUTION_CAP_2026.toLocaleString()} DKK
  Status: ${overCap ? 'OVER CAP -- value (' + Math.round(askTotalValue).toLocaleString() + ' DKK) exceeds the contribution limit. No new deposits allowed, but growth above cap is fine. The cap applies to deposits, not total value.' : 'Under cap -- room for ' + Math.round(ASK_CONTRIBUTION_CAP_2026 - askTotalValue).toLocaleString() + ' DKK more in contributions.'}
  Positions in ASK: ${askPositions.map(p => p.ticker).join(', ')}
  Note: ASK is taxed at 17% lagerbeskatning (unrealized gains taxed annually). Free depot uses realisationsbeskatning (taxed on sale) at 27%/42%.`;
    }

    let scoreSection = '';
    if (scoreData) {
      scoreSection = `\nPORTFOLIO SCORE: ${scoreData.total}/100\nBreakdown:\n`;
      if (scoreData.categories) {
        scoreSection += Object.entries(scoreData.categories).map(([k, v]) =>
          `  ${k}: ${v.score}/${v.max} — ${v.comment || ''}`
        ).join('\n');
      }
    }

    // Consolidated exposure: same ticker across multiple accounts
    const tickerExposure = {};
    positions.forEach(p => {
      const t = (p.ticker || 'UNKNOWN').toUpperCase();
      const val = toDKK((p.shares||0)*(p.currentPrice||0), p.currency);
      if (!tickerExposure[t]) tickerExposure[t] = { totalValue: 0, accounts: [] };
      tickerExposure[t].totalValue += val;
      tickerExposure[t].accounts.push(`${p.broker||'?'}/${p.accountType||'?'}: ${p.shares} shares (${Math.round(val).toLocaleString()} DKK)`);
    });
    const dupeLines = Object.entries(tickerExposure)
      .filter(([, v]) => v.accounts.length > 1)
      .map(([t, v]) => `  ${t}: TOTAL ${Math.round(v.totalValue).toLocaleString()} DKK (${totalPortfolio > 0 ? (v.totalValue/totalPortfolio*100).toFixed(1) : 0}%) across ${v.accounts.length} accounts:\n    ${v.accounts.join('\n    ')}`)
      .join('\n');

    // Overlap data
    const overlapData = state.overlapData;
    let overlapSection = '';
    if (overlapData?.aggregated) {
      const agg = overlapData.aggregated;
      if (agg.topHoldings && agg.topHoldings.length > 0) {
        overlapSection += '\nUNDERLYING HOLDINGS (from ETFs/funds — shows TOTAL effective exposure including direct holdings):\n';
        overlapSection += agg.topHoldings.slice(0, 20).map(h =>
          `  ${h.name || h.ticker}: ${(h.weight||0).toFixed(1)}% of portfolio`
        ).join('\n');
      }
      if (agg.sectors && Object.keys(agg.sectors).length > 0) {
        overlapSection += '\n\nSECTOR BREAKDOWN (including underlying ETF/fund holdings):\n';
        overlapSection += Object.entries(agg.sectors).sort((a,b) => b[1]-a[1]).map(([s, w]) =>
          `  ${s}: ${w.toFixed(1)}%`
        ).join('\n');
      }
      if (agg.geo && Object.keys(agg.geo).length > 0) {
        overlapSection += '\n\nGEOGRAPHIC BREAKDOWN:\n';
        overlapSection += Object.entries(agg.geo).sort((a,b) => b[1]-a[1]).map(([g, w]) =>
          `  ${g}: ${w.toFixed(1)}%`
        ).join('\n');
      }
    }

    // Pension data
    const buildPensionBlock = (label, configKeyName, memberEntries) => {
      const cfg = (() => {
        try { return JSON.parse(localStorage.getItem(configKeyName)) || {}; } catch { return {}; }
      })();
      const fromEntries = memberEntries.reduce((s, e) => s + (e.amount||0), 0);
      const lumpSum = cfg.lumpSum || 0;
      const total = fromEntries + lumpSum;
      const monthly = cfg.monthly || 0;
      const match = cfg.match || 0;
      const age = cfg.currentAge || 39;
      const retire = cfg.retireAge || 67;
      const ytr = Math.max(0, retire - age);
      const totalM = monthly * (1 + match / 100);
      let block = `\n  ${label}:`;
      block += `\n    Current pension savings: ${Math.round(total).toLocaleString()} DKK${lumpSum > 0 ? ` (${Math.round(lumpSum).toLocaleString()} lump sum)` : ''}`;
      block += `\n    Monthly contribution: ${Math.round(monthly).toLocaleString()} DKK/month${match > 0 ? ` + ${match}% match = ${Math.round(totalM).toLocaleString()} DKK total` : ''}`;
      block += `\n    Age: ${age}, Retire: ${retire} (${ytr} years)`;
      if (window.computePensionProjection) {
        const sc = computePensionProjection(total, monthly, match, retire, age);
        if (sc && sc.length >= 3) {
          block += `\n    Projected: Conservative ${Math.round(sc[0].finalValue).toLocaleString()} DKK | Moderate ${Math.round(sc[1].finalValue).toLocaleString()} DKK | Aggressive ${Math.round(sc[2].finalValue).toLocaleString()} DKK`;
        }
      }
      return { block, total, monthly: totalM };
    };

    const allPensionEntries = entries.filter(e => e.category === 'pension');
    const myPensionEntries = allPensionEntries.filter(e => !e.owner || e.owner === 'me');
    const myPension = buildPensionBlock('Me', 'pi-pension-config', myPensionEntries);

    let pensionSection = `\nPENSION:${myPension.block}`;
    const hhMembers2 = loadHousehold();
    hhMembers2.forEach(m => {
      const mEntries = allPensionEntries.filter(e => e.owner === m.id);
      const mp = buildPensionBlock(m.name, `pi-pension-config-${m.id}`, mEntries);
      pensionSection += mp.block;
    });

    // Net worth detail
    const assetEntries = entries.filter(e => e.type === 'asset');
    const liabilityEntries = entries.filter(e => e.type === 'liability');
    let networthDetail = '\nNET WORTH DETAIL:';
    networthDetail += '\n  Assets:';
    assetEntries.forEach(e => {
      const eOwner = e.owner && e.owner !== 'me' ? (() => { const m = loadHousehold().find(h => h.id === e.owner); return m ? ` [${m.name}]` : ''; })() : '';
      networthDetail += `\n    ${e.name}: ${Math.round(e.amount||0).toLocaleString()} DKK (${e.category})${e.interestRate ? ` @ ${e.interestRate}%` : ''}${e.autoSynced ? ' [auto-synced from portfolio]' : ''}${eOwner}`;
    });
    networthDetail += '\n  Liabilities:';
    liabilityEntries.forEach(e => {
      const eOwner = e.owner && e.owner !== 'me' ? (() => { const m = loadHousehold().find(h => h.id === e.owner); return m ? ` [${m.name}]` : ''; })() : '';
      networthDetail += `\n    ${e.name}: ${Math.round(e.amount||0).toLocaleString()} DKK (${e.category})${e.interestRate ? ` @ ${e.interestRate}%` : ''}${eOwner}`;
    });

    // Property/mortgage data
    const propertyEntries = entries.filter(e => e.category === 'property');
    const mortgageEntries = entries.filter(e => e.category === 'mortgage');
    let propertySection = '';
    if (propertyEntries.length > 0 || mortgageEntries.length > 0) {
      propertySection = '\nPROPERTY & MORTGAGE:';
      propertyEntries.forEach(e => {
        propertySection += `\n  Property: ${e.name} - ${Math.round(e.amount||0).toLocaleString()} DKK`;
      });
      mortgageEntries.forEach(e => {
        const equity = (propertyEntries[0]?.amount||0) - (e.amount||0);
        const ltv = propertyEntries[0]?.amount > 0 ? (e.amount / propertyEntries[0].amount * 100).toFixed(1) : 'n/a';
        propertySection += `\n  Mortgage: ${e.name} - ${Math.round(e.amount||0).toLocaleString()} DKK${e.interestRate ? ` @ ${e.interestRate}%` : ''}`;
        propertySection += `\n  Equity: ${Math.round(equity).toLocaleString()} DKK, LTV: ${ltv}%`;
      });
    }

    // Household context
    const hhMembers = loadHousehold();
    let householdSection = '';
    if (hhMembers.length > 0) {
      householdSection = `\nHOUSEHOLD MEMBERS:
  Primary user (me)
${hhMembers.map(m => `  ${m.name} (${m.relation}${m.dob ? ', born ' + m.dob : ''})`).join('\n')}
  Note: Each entry and position has an "owner" field. When analyzing, consider household totals AND per-member breakdowns.\n`;
      const allMembers = [{id:'me', name: isEn()?'Primary user':'Primaer bruger'}, ...hhMembers];
      allMembers.forEach(member => {
        const mPositions = positions.filter(p => member.id === 'me' ? (!p.owner || p.owner === 'me') : p.owner === member.id);
        const mEntries = entries.filter(e => member.id === 'me' ? (!e.owner || e.owner === 'me') : e.owner === member.id);
        const mAssets = mEntries.filter(e => e.type === 'asset').reduce((s,e) => s + (e.amount||0), 0);
        const mLiab = mEntries.filter(e => e.type === 'liability').reduce((s,e) => s + (e.amount||0), 0);
        const mPortfolio = mPositions.reduce((s,p) => s + toDKK((p.shares||0)*(p.currentPrice||0), p.currency), 0);
        if (mPositions.length > 0 || mEntries.length > 0) {
          householdSection += `\n  ${member.name}: NW ${Math.round(mAssets - mLiab).toLocaleString()} DKK (assets ${Math.round(mAssets).toLocaleString()}, liabilities ${Math.round(mLiab).toLocaleString()}), Portfolio ${Math.round(mPortfolio).toLocaleString()} DKK (${mPositions.length} positions)`;
        }
      });
      householdSection += '\n';
    }

    return `${householdSection}NET WORTH OVERVIEW:
  Total assets: ${Math.round(totalAssets).toLocaleString()} DKK
  Total liabilities: ${Math.round(totalLiabilities).toLocaleString()} DKK
  Net worth: ${Math.round(totalAssets - totalLiabilities).toLocaleString()} DKK
${networthDetail}${propertySection}${pensionSection}

PORTFOLIO (${positions.length} positions, total ${Math.round(totalPortfolio).toLocaleString()} DKK):
${positionLines || '  No positions yet.'}

BY ACCOUNT:
${brokerLines || '  None.'}

BY TYPE:
${typeLines || '  None.'}
${dupeLines ? '\nSTOCKS HELD IN MULTIPLE ACCOUNTS (consolidated exposure):\n' + dupeLines : ''}
${scoreSection}${overlapSection}${askSection}

IMPORTANT: When the user asks about their exposure to a specific stock (e.g. Google/GOOGL), consider ALL sources: direct holdings across all accounts AND indirect exposure through ETFs/funds that hold that stock. The overlap/underlying holdings data above shows the effective total exposure.`;
  };

  // Send initial portfolio overview on first visit (only once per app session)
  useEffect(() => {
    // If no chats exist at all, create one and auto-send overview
    if (chats.length === 0) {
      const newId = createNewChat();
      APP_STATE._huginnSessionStarted = true;
      const initMsg = [{ role: 'user', content: 'Give me a quick overview of my portfolio — what stands out, what tensions do you see, and what should I be thinking about?' }];
      // Delay slightly to let state settle
      setTimeout(() => sendToHuginn(initMsg), 50);
    } else if (activeChatId && messages.length === 0 && !APP_STATE._huginnSessionStarted) {
      // Active chat is empty and session not started — send overview
      APP_STATE._huginnSessionStarted = true;
      const initMsg = [{ role: 'user', content: 'Give me a quick overview of my portfolio — what stands out, what tensions do you see, and what should I be thinking about?' }];
      sendToHuginn(initMsg);
    }
  }, [activeChatId]);

  // Handle initial message from quick ask bar
  useEffect(() => {
    if (initialMessage && initialMessage.trim()) {
      // Create a new chat for quick-ask messages
      const newId = createNewChat();
      setTimeout(() => {
        const userMsg = { role: 'user', content: initialMessage.trim() };
        const newMessages = [userMsg];
        setMessages(newMessages);
        sendToHuginn(newMessages);
      }, 50);
    }
  }, [initialMessage]);

  const fetchMarketContext = async () => {
    try {
      const positions = APP_STATE?.positions || [];
      const tickers = [...new Set(positions.map(p => p.ticker).filter(Boolean))];
      if (tickers.length === 0) return '';
      const resp = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      });
      const data = await resp.json();
      if (!data.news || data.news.length === 0) return '';
      let ctx = 'LIVE MARKET DATA (today):';
      data.news.forEach(n => {
        const chg = n.change ? `${n.change > 0 ? '+' : ''}${n.change}%` : 'n/a';
        const range52 = (n.fiftyTwoWeekLow && n.fiftyTwoWeekHigh) ? ` | 52w: ${n.fiftyTwoWeekLow.toFixed(2)} – ${n.fiftyTwoWeekHigh.toFixed(2)}` : '';
        ctx += `\n  ${n.ticker} (${n.name}): ${n.price?.toFixed(2)} ${n.currency || ''} (${chg} today)${range52}`;
      });
      return ctx;
    } catch (err) {
      console.warn('Market context fetch failed:', err);
      return '';
    }
  };

  const sendToHuginn = async (chatHistory) => {
    setLoading(true);
    try {
      // Fetch live market data in parallel with building portfolio context
      const [marketContext, portfolioContext] = await Promise.all([
        fetchMarketContext(),
        Promise.resolve(buildPortfolioContext()),
      ]);
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          portfolioContext,
          marketContext: marketContext || undefined,
        }),
      });
      const data = await resp.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Huginn is silent.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection lost. Huginn has returned to Asgard.' }]);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    await sendToHuginn(newMessages);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    createNewChat();
  };

  // Raven SVG icon
  const RavenIcon = ({ size = 20, style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M4 19c0-3 2-6 6-8l2-1c2-1 4-3 5-5l1-2s1 3-1 6c0 0 3-1 4 1s-1 4-3 5l-3 2c-2 1-4 3-5 5l-1 2"/>
      <circle cx="15" cy="7" r="0.8" fill="currentColor" stroke="none"/>
    </svg>
  );

  // Format message text with basic markdown
  const formatMsg = (text) => {
    if (!text) return '';
    // Bold
    let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Line breaks
    html = html.replace(/\n/g, '<br/>');
    return html;
  };

  // Format date for history sidebar
  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return isEn() ? 'Today' : 'I dag';
    if (diff < 172800000) return isEn() ? 'Yesterday' : 'I gaar';
    if (diff < 604800000) return d.toLocaleDateString(isEn() ? 'en' : 'da', { weekday: 'short' });
    return d.toLocaleDateString(isEn() ? 'en' : 'da', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="screen active" style={{display: "flex", height: "calc(100vh - 80px)", maxHeight: "calc(100vh - 80px)"}}>

      {/* ── Chat history sidebar ── */}
      <div style={{
        width: showHistory ? 260 : 0, overflow: "hidden", transition: "width 0.25s ease",
        borderRight: showHistory ? "1px solid var(--border)" : "none",
        display: "flex", flexDirection: "column", flexShrink: 0,
        background: "var(--bg-sunk)",
      }}>
        <div style={{width: 260, height: "100%", display: "flex", flexDirection: "column"}}>
          <div style={{padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
            <span style={{fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)"}}>{isEn() ? 'Chat History' : 'Chathistorik'}</span>
            <button onClick={() => setShowHistory(false)} style={{background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4}}>
              <Icon name="x" size={14}/>
            </button>
          </div>
          <div style={{flex: 1, overflowY: "auto", padding: "0 8px 8px"}}>
            {chats.map(c => (
              <div key={c.id}
                onClick={() => { switchChat(c.id); setShowHistory(false); }}
                style={{
                  padding: "10px 12px", borderRadius: 10, marginBottom: 4, cursor: "pointer",
                  background: c.id === activeChatId ? "var(--accent-10, rgba(200,149,108,0.12))" : "transparent",
                  border: c.id === activeChatId ? "1px solid var(--accent-20, rgba(200,149,108,0.2))" : "1px solid transparent",
                  transition: "background 0.15s",
                }}>
                <div style={{fontSize: 13, fontWeight: c.id === activeChatId ? 600 : 400, color: "var(--text)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{c.title}</div>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4}}>
                  <span style={{fontSize: 11, color: "var(--text-dim)"}}>{fmtDate(c.updatedAt)} &middot; {c.messages.length} {isEn() ? 'msgs' : 'besk.'}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}
                    style={{background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: "2px 4px", fontSize: 11, opacity: 0.5, borderRadius: 4}}
                    onMouseOver={e => e.target.style.opacity = 1}
                    onMouseOut={e => e.target.style.opacity = 0.5}>
                    <Icon name="trash" size={12}/>
                  </button>
                </div>
              </div>
            ))}
            {chats.length === 0 && (
              <div style={{padding: 16, textAlign: "center", color: "var(--text-dim)", fontSize: 13}}>
                {isEn() ? 'No conversations yet' : 'Ingen samtaler endnu'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main chat column ── */}
      <div style={{flex: 1, display: "flex", flexDirection: "column", minWidth: 0}}>
        {/* Header */}
        <div className="page-head" style={{flexShrink: 0}}>
          <div>
            <h1 className="page-title" style={{display: "flex", alignItems: "center", gap: 10}}>
              <RavenIcon size={32} style={{color: "var(--accent)", opacity: 0.8}}/>
              <span><em>Huginn</em></span>
            </h1>
            <p className="page-subtitle">{isEn() ? "Odin's raven sees your portfolio" : "Odins ravn ser din portefolje"}</p>
          </div>
          <div className="page-actions" style={{display: "flex", gap: 6}}>
            <button className="btn" onClick={() => setShowHistory(!showHistory)} style={{fontSize: 12}}
              title={isEn() ? 'Chat history' : 'Chathistorik'}>
              <Icon name="clock" size={13}/> {isEn() ? 'History' : 'Historik'}
              {chats.length > 1 && <span style={{marginLeft: 4, padding: "1px 6px", borderRadius: 10, background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 700}}>{chats.length}</span>}
            </button>
            <button className="btn" onClick={clearChat} style={{fontSize: 12}}>
              <Icon name="plus" size={13}/> {isEn() ? 'New chat' : 'Ny chat'}
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "0 0 16px 0",
          display: "flex", flexDirection: "column", gap: 0,
          minHeight: 0,
        }}>
          {/* Intro card — only when no messages yet */}
          {messages.length === 0 && !loading && (
            <div style={{
              textAlign: "center", padding: "48px 24px", color: "var(--text-dim)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            }}>
              <RavenIcon size={48} style={{color: "var(--text-dim)", opacity: 0.3}}/>
              <div style={{fontSize: 14, maxWidth: 400, lineHeight: 1.6}}>
                {isEn()
                  ? 'Huginn flies out each day, observes your portfolio through the eyes of legendary investors, and returns with what it saw.'
                  : 'Huginn flyver ud hver dag, observerer din portefolje gennem legendariske investorers ojne og vender tilbage med hvad den saa.'}
              </div>
            </div>
          )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: msg.role === 'user' ? "flex-end" : "flex-start",
            padding: "6px 0",
          }}>
            <div style={{
              maxWidth: msg.role === 'user' ? "70%" : "85%",
              padding: msg.role === 'user' ? "10px 16px" : "14px 20px",
              borderRadius: msg.role === 'user' ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.role === 'user'
                ? "var(--accent)"
                : "var(--bg-card)",
              color: msg.role === 'user'
                ? "#fff"
                : "var(--text)",
              fontSize: msg.role === 'user' ? 13.5 : 13.5,
              lineHeight: 1.6,
              boxShadow: msg.role === 'user' ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
              border: msg.role === 'user' ? "none" : "1px solid var(--border)",
            }}>
              {msg.role === 'assistant' && (
                <div style={{display: "flex", alignItems: "center", gap: 6, marginBottom: 6, opacity: 0.5}}>
                  <RavenIcon size={13}/>
                  <span style={{fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em"}}>Huginn</span>
                </div>
              )}
              <div dangerouslySetInnerHTML={{__html: formatMsg(msg.content)}} />
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div style={{display: "flex", justifyContent: "flex-start", padding: "6px 0"}}>
            <div style={{
              padding: "14px 20px", borderRadius: "18px 18px 18px 4px",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <RavenIcon size={14} style={{opacity: 0.4}}/>
              <div style={{display: "flex", gap: 4}}>
                <span style={{width:6, height:6, borderRadius:"50%", background:"var(--text-dim)", animation:"huginnPulse 1.4s ease-in-out infinite", animationDelay:"0s"}}/>
                <span style={{width:6, height:6, borderRadius:"50%", background:"var(--text-dim)", animation:"huginnPulse 1.4s ease-in-out infinite", animationDelay:"0.2s"}}/>
                <span style={{width:6, height:6, borderRadius:"50%", background:"var(--text-dim)", animation:"huginnPulse 1.4s ease-in-out infinite", animationDelay:"0.4s"}}/>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div style={{
        flexShrink: 0, padding: "12px 0 0 0",
        borderTop: "1px solid var(--border)",
      }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 10,
          background: "var(--bg-card)", borderRadius: 16,
          border: "1px solid var(--border)", padding: "8px 8px 8px 16px",
          transition: "border-color 0.2s",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isEn() ? "Ask Huginn about your portfolio..." : "Spoerg Huginn om din portefolje..."}
            rows={1}
            style={{
              flex: 1, border: "none", outline: "none", resize: "none",
              background: "transparent", color: "var(--text)",
              fontSize: 14, lineHeight: 1.5, padding: "6px 0",
              fontFamily: "inherit", maxHeight: 120, overflowY: "auto",
            }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              width: 38, height: 38, borderRadius: 12,
              background: (loading || !input.trim()) ? "var(--bg-sunk)" : "var(--accent)",
              border: "none", cursor: (loading || !input.trim()) ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s, transform 0.1s",
              flexShrink: 0,
            }}
            onMouseDown={e => { if (!loading && input.trim()) e.target.style.transform = 'scale(0.93)'; }}
            onMouseUp={e => e.target.style.transform = ''}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={loading || !input.trim() ? "var(--text-dim)" : "#fff"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
            </svg>
          </button>
        </div>
        <div style={{textAlign: "center", padding: "8px 0 2px", fontSize: 10, color: "var(--text-dim)", opacity: 0.5}}>
          {isEn() ? 'Framework commentary, not financial advice. Huginn sees through legendary lenses.' : 'Ramme-kommentar, ikke finansiel raadgivning. Huginn ser gennem legendariske linser.'}
        </div>
      </div>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes huginnPulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
      </div>{/* end main chat column */}
    </div>
  );
};

// ==========================================================================
// SETTINGS
// ==========================================================================
const SettingsScreen = ({ state, refresh, theme, setTheme, lang, setLang, household, setHousehold, privacyMode }) => {
  const handleExport = () => {
    const data = { entries: state.entries.filter(e=>!e.autoSynced), positions: state.positions, overlapData: state.overlapData };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-intelligence-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
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
          if (data.overlapData) APP_STATE.overlapData = data.overlapData;
          window.saveData();
          if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
          refresh();
        } catch (err) {
          alert('Error: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  };

  return (
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title"><em>{tl("settings.title")}</em></h1>
          <p className="page-subtitle">{tl("settings.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>{tl("settings.language")}</h3>
          <div className="segmented" style={{width:"100%", display:"flex"}}>
            <button style={{flex:1}} className={lang==="da"?"active":""} onClick={()=>setLang("da")}>Dansk</button>
            <button style={{flex:1}} className={lang==="en"?"active":""} onClick={()=>setLang("en")}>English</button>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>{tl("settings.theme")}</h3>
          <div className="segmented" style={{width:"100%", display:"flex"}}>
            <button style={{flex:1}} className={theme==="light"?"active":""} onClick={()=>setTheme("light")}>{tl("settings.light")}</button>
            <button style={{flex:1}} className={theme==="dark"?"active":""} onClick={()=>setTheme("dark")}>{tl("settings.dark")}</button>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>{tl("settings.currency")}</h3>
          <select className="form-group" style={{width:"100%", padding:"10px 14px", border:"1px solid var(--border)", borderRadius:"var(--r-md)", background:"var(--bg-panel)", color:"var(--text)", fontSize:14}}
            value={state.currency} onChange={e=>{APP_STATE.currency=e.target.value; window.savePreferences(); refresh();}}>
            <option value="DKK">DKK (kr.)</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD ($)</option>
            <option value="SEK">SEK (kr)</option>
            <option value="NOK">NOK (kr)</option>
          </select>
        </div>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>{tl("settings.dataManagement")}</h3>
          <div style={{display:"flex", gap:10}}>
            <button className="btn" onClick={handleExport}>{tl("settings.exportData")}</button>
            <button className="btn" onClick={handleImport}>{tl("settings.importData")}</button>
          </div>
        </div>
      </div>

      {/* Household Members */}
      <div className="card" style={{marginTop:20}}>
        <h3 className="card-title" style={{marginBottom:12}}>
          <Icon name="users" size={15} style={{marginRight:6, verticalAlign:"-2px"}}/>
          {isEn() ? 'Household' : 'Husstand'}
        </h3>
        <p style={{color:"var(--text-muted)", fontSize:13, marginBottom:14}}>
          {isEn() ? 'Add your partner and up to 2 children. Each member gets their own portfolio, net worth, and pension data — and you can view everything combined as a household.'
                   : 'Tilfoej din partner og op til 2 boern. Hvert medlem faar sin egen portefolje, formue og pension — og du kan se det hele samlet som husstand.'}
        </p>

        {/* Primary user (always shown) */}
        <div style={{display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid var(--border)"}}>
          <Icon name="user" size={16}/>
          <span style={{flex:1, fontWeight:500}}>{isEn() ? 'Me (primary)' : 'Mig (primaer)'}</span>
          <span className="badge" style={{fontSize:11}}>owner</span>
        </div>

        {/* Household members */}
        {household.map((m, i) => (
          <div key={m.id} style={{display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid var(--border)"}}>
            <Icon name={m.relation === 'child' ? 'baby' : 'user'} size={16}/>
            <span style={{flex:1, fontWeight:500}}>{m.name}</span>
            <span style={{color:"var(--text-dim)", fontSize:12}}>
              {m.relation === 'partner' ? (isEn() ? 'Partner' : 'Partner') : (isEn() ? 'Child' : 'Barn')}
              {m.dob ? ` · ${m.dob}` : ''}
            </span>
            <button className="icon-btn" onClick={() => {
              const name = prompt(isEn() ? 'Edit name:' : 'Rediger navn:', m.name);
              if (name && name.trim()) {
                const updated = household.map(h => h.id === m.id ? {...h, name: name.trim()} : h);
                setHousehold(updated);
              }
            }}><Icon name="edit" size={13}/></button>
            <button className="icon-btn" onClick={() => {
              if (confirm(isEn() ? `Remove ${m.name}? Their data (entries, positions) will remain but be unassigned.` : `Fjern ${m.name}? Deres data forbliver men bliver utildelt.`)) {
                setHousehold(household.filter(h => h.id !== m.id));
              }
            }}><Icon name="trash" size={13}/></button>
          </div>
        ))}

        {/* Add buttons */}
        <div style={{display:"flex", gap:10, marginTop:14, flexWrap:"wrap"}}>
          {!household.some(m => m.relation === 'partner') && (
            <button className="btn" onClick={() => {
              const name = prompt(isEn() ? 'Partner name:' : 'Partners navn:');
              if (name && name.trim()) {
                setHousehold([...household, { id: crypto.randomUUID(), name: name.trim(), relation: 'partner' }]);
              }
            }}>
              <Icon name="plus" size={13}/> {isEn() ? 'Add partner' : 'Tilfoej partner'}
            </button>
          )}
          {household.filter(m => m.relation === 'child').length < 2 && (
            <button className="btn" onClick={() => {
              const name = prompt(isEn() ? 'Child name:' : 'Barnets navn:');
              if (name && name.trim()) {
                const dob = prompt(isEn() ? 'Date of birth (optional, YYYY-MM-DD):' : 'Foedselsdato (valgfri, YYYY-MM-DD):');
                setHousehold([...household, { id: crypto.randomUUID(), name: name.trim(), relation: 'child', dob: dob || '' }]);
              }
            }}>
              <Icon name="plus" size={13}/> {isEn() ? 'Add child' : 'Tilfoej barn'}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{marginTop:20, borderColor:"oklch(0.55 0.15 25 / 0.3)"}}>
        <h3 className="card-title" style={{color:"var(--neg)"}}>{isEn() ? 'Danger zone' : 'Farezone'}</h3>
        <p style={{color:"var(--text-muted)", fontSize:13, margin:"8px 0 14px"}}>{isEn() ? 'This will permanently delete all your data -- entries, positions, preferences, and projections.' : 'Dette sletter permanent alle dine data -- poster, positioner, praeferencer og fremskrivninger.'}</p>
        <button className="btn" style={{background:"oklch(0.55 0.15 25 / 0.12)", color:"var(--neg)", borderColor:"oklch(0.55 0.15 25 / 0.3)"}}
          onClick={() => {
            if (confirm(isEn() ? 'Are you sure? This cannot be undone.' : 'Er du sikker? Dette kan ikke fortrydes.')) {
              Object.keys(localStorage).filter(k => k.startsWith('pi-')).forEach(k => localStorage.removeItem(k));
              location.reload();
            }
          }}>
          <Icon name="trash" size={14}/> {isEn() ? 'Reset all data' : 'Nulstil alle data'}
        </button>
      </div>

      <div className="card" style={{marginTop:20}}>
        <h3 className="card-title">{tl("settings.about")}</h3>
        <p style={{color:"var(--text-muted)", marginTop:8}}>Portfolio Intelligence v3.0.0</p>
        <p style={{color:"var(--text-dim)", fontSize:12, marginTop:4}}>{isEn()?'Made by':'Lavet af'} <a href="https://github.com/therealkranup" style={{color:"var(--accent)"}} target="_blank">therealkranup</a></p>
      </div>
    </div>
  );
};

// ==========================================================================
// MODALS
// ==========================================================================
const EntryModal = ({ open, onClose, editData, refresh, household, activeMember }) => {
  const ref = useRef(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("asset");
  const [category, setCategory] = useState("cash");
  const [interestRate, setInterestRate] = useState("");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState("me");

  useEffect(() => {
    if (open) {
      if (editData?.id) {
        setName(editData.name||""); setAmount(editData.amount||""); setType(editData.type||"asset");
        setCategory(editData.category||"cash"); setInterestRate(editData.interestRate||""); setNotes(editData.notes||"");
        setOwner(editData.owner||"me");
      } else {
        setName(""); setAmount(""); setType(editData?.type||"asset");
        setCategory(editData?.category||"cash"); setInterestRate(""); setNotes("");
        setOwner(activeMember === 'household' ? 'me' : (activeMember || 'me'));
      }
      requestAnimationFrame(() => {
        if (ref.current && !ref.current.open) ref.current.showModal();
      });
    }
  }, [open, editData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const entry = {
      id: editData?.id || crypto.randomUUID(), name, amount: parseFloat(amount)||0, type, category,
      owner,
      ...(interestRate ? { interestRate: parseFloat(interestRate) } : {}),
      ...(notes ? { notes } : {}),
    };
    if (editData?.id) {
      const idx = APP_STATE.entries.findIndex(e=>e.id===editData.id);
      if (idx>=0) APP_STATE.entries[idx] = entry;
    } else { APP_STATE.entries.push(entry); }
    window.saveData();
    if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
    refresh();
    ref.current?.close();
    onClose();
  };

  const showInterest = ['cash', 'savings'].includes(category) || category === 'mortgage' || category === 'student_loan' || category === 'car_loan' || category === 'credit_card';

  if (!open) return null;
  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-header">
        <h2 className="modal-title">{editData?.id ? tl("modal.editEntry") : tl("modal.addEntry")}</h2>
        <button className="modal-close" onClick={()=>{ref.current?.close(); onClose();}}>&times;</button>
      </div>
      <form className="modal-body" onSubmit={handleSubmit}>
        <div className="form-group"><label>{tl("modal.entryName")}</label><input value={name} onChange={e=>setName(e.target.value)} required placeholder={isEn()?"e.g. Budget account, Savings...":"f.eks. Budgetkonto, Opsparing..."}/></div>
        <div className="form-group"><label>{tl("modal.entryAmount")}</label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} required min="0" step="any"/></div>
        <div className="form-group"><label>{tl("modal.entryType")}</label>
          <select value={type} onChange={e=>setType(e.target.value)}><option value="asset">{tl("modal.asset")}</option><option value="liability">{tl("modal.liability")}</option></select>
        </div>
        <div className="form-group"><label>{tl("modal.entryCategory")}</label>
          <select value={category} onChange={e=>setCategory(e.target.value)}>
            {type === 'asset' ? (<>
              <option value="cash">{isEn()?'Bank account':'Bankkonto'}</option>
              <option value="savings">{isEn()?'Savings account':'Opsparingskonto'}</option>
              <option value="investment">{isEn()?'Investment':'Investering'}</option>
              <option value="property">{isEn()?'Real estate':'Ejendom'}</option>
              <option value="pension">{isEn()?'Pension':'Pension'}</option>
              <option value="vehicle">{isEn()?'Vehicle':'Koretoj'}</option>
              <option value="other_asset">{isEn()?'Other asset':'Andet aktiv'}</option>
            </>) : (<>
              <option value="mortgage">{isEn()?'Mortgage':'Realkreditlaan'}</option>
              <option value="student_loan">{isEn()?'Student loan':'Studielaan'}</option>
              <option value="car_loan">{isEn()?'Car loan':'Billaan'}</option>
              <option value="credit_card">{isEn()?'Credit card':'Kreditkort'}</option>
              <option value="other_liability">{isEn()?'Other loan':'Anden gaeld'}</option>
            </>)}
          </select>
        </div>
        {showInterest && (
          <div className="form-group">
            <label>{isEn()?'Interest rate % (optional)':'Rente % (valgfri)'}</label>
            <input type="number" step="0.01" min="0" max="100" value={interestRate} onChange={e=>setInterestRate(e.target.value)} placeholder={isEn()?"e.g. 3.0":"f.eks. 3,0"}/>
          </div>
        )}
        <div className="form-group">
          <label>{isEn()?'Notes (optional)':'Noter (valgfri)'}</label>
          <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder={isEn()?"e.g. Lunar, Nordea...":"f.eks. Lunar, Nordea..."}/>
        </div>
        {household && household.length > 0 && (
          <div className="form-group">
            <label>{isEn()?'Owner':'Ejer'}</label>
            <select value={owner} onChange={e=>setOwner(e.target.value)}>
              <option value="me">{isEn()?'Me':'Mig'}</option>
              {household.map(m => <option key={m.id} value={m.id}>{m.name} ({m.relation === 'partner' ? (isEn()?'Partner':'Partner') : (isEn()?'Child':'Barn')})</option>)}
            </select>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={()=>{ref.current?.close(); onClose();}}>{tl("modal.cancel")}</button>
          <button type="submit" className="btn btn-primary">{tl("modal.save")}</button>
        </div>
      </form>
    </dialog>
  );
};

const PositionModal = ({ open, onClose, editData, refresh, household, activeMember }) => {
  const ref = useRef(null);
  const [broker, setBroker] = useState("saxo");
  const [accountType, setAccountType] = useState("ask");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [posType, setPosType] = useState("stock");
  const [shares, setShares] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [currency, setCurrency] = useState("DKK");
  const [owner, setOwner] = useState("me");

  useEffect(() => {
    if (open) {
      if (editData?.id) {
        setBroker(editData.broker||"saxo"); setAccountType(editData.accountType||"free");
        setTicker(editData.ticker||""); setName(editData.name||""); setPosType(editData.type||"stock");
        setShares(editData.shares||""); setAvgPrice(editData.avgPrice||""); setCurrentPrice(editData.currentPrice||"");
        setCurrency(editData.currency||"DKK"); setOwner(editData.owner||"me");
      } else {
        setBroker("saxo"); setAccountType("ask"); setTicker(""); setName(""); setPosType("stock");
        setShares(""); setAvgPrice(""); setCurrentPrice(""); setCurrency("DKK");
        setOwner(activeMember === 'household' ? 'me' : (activeMember || 'me'));
      }
      requestAnimationFrame(() => {
        if (ref.current && !ref.current.open) ref.current.showModal();
      });
    }
  }, [open, editData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const pos = { id: editData?.id || crypto.randomUUID(), broker, accountType, ticker: ticker.toUpperCase(), name, type: posType, shares: parseFloat(shares)||0, avgPrice: parseFloat(avgPrice)||0, currentPrice: parseFloat(currentPrice)||0, currency, owner };
    if (editData?.id) {
      const idx = APP_STATE.positions.findIndex(p=>p.id===editData.id);
      if (idx>=0) APP_STATE.positions[idx] = pos;
    } else { APP_STATE.positions.push(pos); }
    window.saveData();
    if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
    refresh();
    ref.current?.close();
    onClose();
  };

  if (!open) return null;
  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-header">
        <h2 className="modal-title">{editData?.id ? tl("modal.editPosition") : tl("modal.addPosition")}</h2>
        <button className="modal-close" onClick={()=>{ref.current?.close(); onClose();}}>&times;</button>
      </div>
      <form className="modal-body" onSubmit={handleSubmit}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          <div className="form-group"><label>{tl("modal.broker")}</label>
            <select value={broker} onChange={e=>setBroker(e.target.value)}><option value="saxo">Saxo Bank</option><option value="nordnet">Nordnet</option><option value="lunar">Lunar</option><option value="coinbase">Coinbase</option><option value="revolut">Revolut</option><option value="wise">Wise</option><option value="kraken">Kraken</option><option value="binance">Binance</option><option value="crypto_com">Crypto.com</option><option value="other">{isEn()?'Other':'Anden'}</option></select>
          </div>
          <div className="form-group"><label>{tl("modal.accountType")}</label>
            <select value={accountType} onChange={e=>setAccountType(e.target.value)}><option value="ask">ASK</option><option value="free">{isEn()?'Free depot':'Frit depot'}</option><option value="pension">Pension</option><option value="isk">ISK</option><option value="crypto">Crypto</option><option value="other">{isEn()?'Other':'Anden'}</option></select>
          </div>
        </div>
        <div className="form-group"><label>{tl("modal.ticker")}</label><input value={ticker} onChange={e=>setTicker(e.target.value)} required placeholder="NOVO-B, VWCE, DK0060534915"/></div>
        <div className="form-group"><label>{tl("modal.positionName")}</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Novo Nordisk B"/></div>
        <div className="form-group"><label>{tl("modal.positionType")}</label>
          <select value={posType} onChange={e=>setPosType(e.target.value)}><option value="stock">{isEn()?'Stock':'Aktie'}</option><option value="etf">ETF</option><option value="fund">{isEn()?'Fund':'Fond'}</option><option value="bond">{isEn()?'Bond':'Obligation'}</option><option value="crypto">Krypto</option><option value="other">{isEn()?'Other':'Andet'}</option></select>
        </div>
        <div className="form-group"><label>{tl("modal.shares")}</label><input type="number" value={shares} onChange={e=>setShares(e.target.value)} required min="0" step="any"/></div>
        <div className="form-group"><label>{isEn()?'Currency':'Valuta'}</label>
          <select value={currency} onChange={e=>setCurrency(e.target.value)}>
            <option value="DKK">DKK (kr.)</option><option value="USD">USD ($)</option><option value="EUR">EUR</option><option value="SEK">SEK</option><option value="NOK">NOK</option><option value="GBP">GBP</option>
          </select>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          <div className="form-group"><label>{isEn()?`Avg. buy price (${currency})`:`Gns. kobspris (${currency})`}</label><input type="number" value={avgPrice} onChange={e=>setAvgPrice(e.target.value)} min="0" step="any"/></div>
          <div className="form-group"><label>{isEn()?`Current price (${currency})`:`Aktuel kurs (${currency})`}</label><input type="number" value={currentPrice} onChange={e=>setCurrentPrice(e.target.value)} min="0" step="any"/></div>
        </div>
        {household && household.length > 0 && (
          <div className="form-group">
            <label>{isEn()?'Owner':'Ejer'}</label>
            <select value={owner} onChange={e=>setOwner(e.target.value)}>
              <option value="me">{isEn()?'Me':'Mig'}</option>
              {household.map(m => <option key={m.id} value={m.id}>{m.name} ({m.relation === 'partner' ? (isEn()?'Partner':'Partner') : (isEn()?'Child':'Barn')})</option>)}
            </select>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={()=>{ref.current?.close(); onClose();}}>{tl("modal.cancel")}</button>
          <button type="submit" className="btn btn-primary">{tl("modal.save")}</button>
        </div>
      </form>
    </dialog>
  );
};

const ImportModal = ({ open, onClose, refresh, activeMember }) => {
  const ref = useRef(null);
  const [broker, setBroker] = useState("saxo");
  const [accountType, setAccountType] = useState("ask");
  const [owner, setOwner] = useState(activeMember || "me");
  const [status, setStatus] = useState("");
  const householdMembers = useMemo(() => loadHousehold(), [open]);
  const [pastedImages, setPastedImages] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const pasteZoneRef = useRef(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => { if (ref.current && !ref.current.open) ref.current.showModal(); });
      // Default owner to current active member (but not "household")
      if (activeMember && activeMember !== 'household') setOwner(activeMember);
      else setOwner('me');
    }
    if (!open) setPastedImages([]);
  }, [open, activeMember]);

  // Handle paste events (Ctrl+V / Cmd+V)
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        setPastedImages(prev => [...prev, ...imageFiles]);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open]);

  // Handle drag & drop images
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) setPastedImages(prev => [...prev, ...files]);
  };

  const removePastedImage = (idx) => {
    setPastedImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Process pasted/dropped images through AI scan
  const processImages = async (imageFiles) => {
    setStatus(isEn() ? `Preparing ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} for AI scan...` : `Forbereder ${imageFiles.length} billede${imageFiles.length > 1 ? 'r' : ''} til AI-scanning...`);
    try {
      const allBlocks = [];
      for (const file of imageFiles) {
        const blocks = await window.prepareFileForScan(file);
        allBlocks.push(...blocks);
      }
      setStatus(isEn() ? 'Analyzing with AI...' : 'Analyserer med AI...');
      return allBlocks;
    } catch (err) {
      setStatus("! " + err.message);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fileInput = e.target.querySelector('input[type=file]');
    const file = fileInput?.files[0];
    if (!file && pastedImages.length === 0) return;

    // If we have pasted images (with or without a file), process them together
    if (pastedImages.length > 0) {
      const allFiles = [...pastedImages];
      if (file && file.type.startsWith('image/')) allFiles.push(file);
      if (file && !file.type.startsWith('image/') && !file.name.endsWith('.json')) allFiles.push(file);

      const imageBlocks = await processImages(allFiles.filter(f => f.type.startsWith('image/')));
      if (!imageBlocks) return;
      // If there's also a PDF, add its blocks
      const pdfFiles = allFiles.filter(f => f.type === 'application/pdf');
      for (const pf of pdfFiles) {
        const pdfBlocks = await window.prepareFileForScan(pf);
        imageBlocks.push(...pdfBlocks);
      }
      await scanWithAI(imageBlocks);
      return;
    }

    // Original file-only flow
    if (!file) return;

    if (file.name.endsWith('.json')) {
      setStatus(isEn()?'Reading JSON...':'Laeser JSON...');
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const positions = Array.isArray(data) ? data : (data.positions || []);
          let imported = 0;
          positions.forEach(p => {
            if (p.ticker || p.name) {
              APP_STATE.positions.push({
                id: crypto.randomUUID(), broker: p.broker||broker, accountType: p.accountType||accountType,
                ticker: (p.ticker||'').toUpperCase(), name: p.name||p.ticker||'', type: p.type||'stock',
                shares: parseFloat(p.shares||p.quantity||0), avgPrice: parseFloat(p.avgPrice||0), currentPrice: parseFloat(p.currentPrice||p.price||0),
                currency: p.currency || 'DKK',
                owner: owner === 'me' ? undefined : owner,
              });
              imported++;
            }
          });
          window.saveData();
          if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
          refresh();
          setStatus(`Done: ${imported} ${isEn()?'positions imported':'positioner importeret'}`);
          setTimeout(() => { ref.current?.close(); onClose(); setStatus(""); }, 1500);
        } catch(err) { setStatus("! " + err.message); }
      };
      reader.readAsText(file);
    } else {
      // AI scan for PDF/images
      setStatus(isEn()?'Preparing for AI scan...':'Forbereder AI-scanning...');
      try {
        const imageBlocks = await window.prepareFileForScan(file);
        await scanWithAI(imageBlocks);
      } catch(err) {
        console.error('Import error:', err);
        setStatus("! " + err.message);
      }
    }
  };

  const scanWithAI = async (imageBlocks) => {
    try {
      setStatus(isEn()?'Analyzing with AI...':'Analyserer med AI...');
      const resp = await fetch('/api/scan', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001', max_tokens: 8192,
            messages: [{ role:'user', content: [...imageBlocks, { type:'text', text: `Analyze this financial document (likely a broker/bank portfolio screenshot from Nordnet, Saxo Bank, Aktiesparekonto, or similar Scandinavian broker).

CRITICAL RULES for extracting positions:

NORDNET COLUMN MAPPING (CRITICAL — these are the exact Danish column headers):
- "Antal" = shares (number of units owned). Use this directly.
- "GAK" (Gennemsnitlig Anskaffelseskurs) = avgPrice (average purchase price per share). ALWAYS map GAK → avgPrice.
- "Indre værdi" = NAV = currentPrice (current price per share/unit). ALWAYS map this → currentPrice.
- "Anskaffelsessum" or "Anskaffelsess..." = total cost basis (NOT used directly, but can verify: cost = shares × avgPrice).
- "Værdi DKK" = total market value. Include as "value" in output.
- "Ureal.afka..." = unrealized return percentage (informational only).
- "Afkast DKK" = unrealized return in DKK (informational only).
- "1 dag %" = daily change percentage (informational only).

SHARES:
- "shares" = the NUMBER OF UNITS/SHARES owned. Look for "Antal" column first.
- If there is NO shares/quantity column but there IS a "Value" AND a per-unit price (NAV/Kurs), CALCULATE: shares = Value / NAV.
- NEVER set shares to 0 if you can calculate or read it.

PRICES:
- "currentPrice" = the CURRENT/LATEST price PER SINGLE SHARE. Use "Indre værdi", "NAV", "Kurs", "Last", "Seneste". For mutual funds, NAV IS the currentPrice. NEVER leave it as 0 when a NAV is visible.
- "avgPrice" = the average purchase price per share. Use "GAK", "Gns. kurs", "Open price", "Avg price", "Købskurs". IMPORTANT: On Nordnet, "GAK" is ALWAYS the average purchase price. On Saxo, "Open price" = average purchase price.
- VERIFICATION: After extracting, check every position. If shares > 0 but currentPrice = 0 and you can see ANY price/NAV, you MUST set currentPrice. If GAK is visible, avgPrice MUST NOT be 0.

NORDNET INDEX FUNDS — CRITICAL:
- Nordnet has proprietary index funds that are NOT on Yahoo Finance. Use these EXACT ticker mappings:
  "Nordnet Danmark Indeks A" → ticker: "NORDNET_DK_IDX", name: "Nordnet Danmark Indeks A", type: "fund"
  "Nordnet Global Indeks 125 DKK" → ticker: "NORDNET_GLOBAL_125", name: "Nordnet Global Indeks 125 DKK", type: "fund"
  "Nordnet Global Indeks DKK" → ticker: "NORDNET_GLOBAL_DKK", name: "Nordnet Global Indeks DKK", type: "fund"
  "Nordnet Nye Markeder Indeks" → ticker: "NORDNET_EM_IDX", name: "Nordnet Nye Markeder Indeks", type: "fund"
  "Nordnet Teknologi Indeks DKK" → ticker: "NORDNET_TECH_IDX", name: "Nordnet Teknologi Indeks DKK", type: "fund"
  "Nordnet Stabile Aktier Indeks" → ticker: "NORDNET_STABLE_IDX", name: "Nordnet Stabile Aktier Indeks", type: "fund"
  "Nordnet Indeks" → ticker: "NORDNET_IDX", name: "Nordnet Indeks", type: "fund"
- For ALL Nordnet index funds: currency is ALWAYS "DKK"

CRYPTO (Lunar app, Coinbase, etc.) — CRITICAL:
- Set type to "crypto" for ALL cryptocurrency positions
- Use the coin symbol as ticker (BTC, ETH, SOL, etc.) — do NOT append -USD, the app handles that
- Lunar shows all values in DKK. Set currency to "DKK"
- "shares" = the fractional amount (e.g. 4.10856821 for ETH). Keep ALL decimal places
- The main DKK value shown is the current market value = "value"
- currentPrice = value / shares (calculate if not shown per-unit)
- The green/red DKK amount with arrow (↗ or ↘) followed by "All" is the TOTAL COST BASIS (not per-unit avgPrice)
- avgPrice = totalCostBasis / shares. E.g. if cost basis is "DKK 37,757.52 All" and shares is 4.10856821, then avgPrice = 37757.52 / 4.10856821 = 9190.14
- IMPORTANT: You MUST calculate avgPrice as costBasis/shares for every crypto position

CURRENCY — THIS IS CRITICAL:
- Each position may be traded in a DIFFERENT currency (DKK, USD, EUR, SEK, NOK, GBP, etc.)
- If there is a "Currency" column, USE IT directly for each row
- US stocks (AAPL, MSFT, GOOGL, META, TSLA, AMZN, NVDA, NIO, PYPL, MRVL, SENS, BRK etc.) are ALWAYS in USD
- Danish stocks (.CO suffix like NOVO-B.CO, VWS.CO, DSV.CO) are in DKK
- Return "currency" per position with the 3-letter ISO code (USD, DKK, EUR, SEK, NOK, GBP)

TICKER — VERY IMPORTANT:
- NEVER use ISINs (e.g. US5949181045). ALWAYS convert to Yahoo Finance ticker symbols.
- Common mappings: Alphabet=GOOGL, Microsoft=MSFT, Tesla=TSLA, Meta=META, Amazon=AMZN, Apple=AAPL, Nvidia=NVDA, Nio=NIO, PayPal=PYPL, Marvell=MRVL, Senseonics=SENS, Berkshire Hathaway B=BRK-B, D-Wave=QBTS, Archer Aviation=ACHR, Nano Dimension=NNDM, Norwegian Air Shuttle=NAS.OL, Oklo=OKLO, Ørsted=ORSTED.CO
- For Danish stocks, append .CO (e.g. Novo Nordisk B=NOVO-B.CO, Vestas=VWS.CO)
- "type" should be "etf" for ETFs, "fund" for mutual funds/index funds, "stock" for individual stocks, "crypto" for cryptocurrencies
- CRYPTO DETECTION: If tickers are BTC, ETH, SOL, ADA, DOGE, LINK, LTC, UNI, ZEC, BAT, XRP, DOT, AVAX, MATIC, SHIB, or any other cryptocurrency — set type to "crypto". Crypto portfolios typically show fractional holdings (e.g. 4.10856821 ETH, 0.05717538 BTC). The platform "Lunar" is a Danish crypto app.
- If the document shows ISINs, you MUST look up and return the correct Yahoo Finance ticker instead

Return ONLY valid JSON (no markdown, no code fences, no explanation). Use this exact schema:
{"entries":[],"positions":[{"ticker":"MSFT","name":"Microsoft Corp.","type":"stock","shares":17,"currentPrice":425.50,"avgPrice":390.43,"currency":"USD","value":7233.5}]}

IMPORTANT: Always include "value" (total market value of the position) AND "currentPrice" (price per share/unit). For funds with NAV shown, currentPrice = NAV. Never return currentPrice as 0 when you can see a price or NAV.` }] }]
          })
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('Scan API error:', resp.status, errText);
          setStatus(`! API error ${resp.status}: ${errText.slice(0,100)}`);
          return;
        }
        const data = await resp.json();
        console.log('AI scan response:', JSON.stringify(data).slice(0,500));
        if (data.error) {
          setStatus(`! ${data.error}`);
          return;
        }
        if (data.content?.[0]?.text) {
          const rawText = data.content[0].text;
          console.log('AI raw text:', rawText);
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('Parsed positions:', parsed.positions?.length, parsed.positions);
            let imported = 0;
            // Clear existing positions for this account type + broker to avoid duplicates on re-import
            if (parsed.positions?.length > 0) {
              APP_STATE.positions = APP_STATE.positions.filter(p => !(p.broker === broker && p.accountType === accountType));
            }
            if (parsed.entries) parsed.entries.forEach(e => { APP_STATE.entries.push({...e, id: crypto.randomUUID()}); });
            // Normalize common ticker variants AI models return inconsistently
            const TICKER_FIX = {
              'NOVOB': 'NOVO-B.CO', 'NOVOB.CO': 'NOVO-B.CO', 'NOVO-B': 'NOVO-B.CO', 'NOVO': 'NOVO-B.CO',
              'VWS': 'VWS.CO', 'VESTAS': 'VWS.CO',
              'ORSTED': 'ORSTED.CO',
              'BRK.B': 'BRK-B', 'BRKB': 'BRK-B', 'BRK': 'BRK-B',
              'NAS': 'NAS.OL', 'NORWEGIAN': 'NAS.OL',
              // Nordnet proprietary index funds
              'NORDNET_DANMARK_INDEKS_A': 'NORDNET_DK_IDX',
              'NORDNET_GLOBAL_INDEKS_125_DKK': 'NORDNET_GLOBAL_125',
              'NORDNET_GLOBAL_INDEKS_DKK': 'NORDNET_GLOBAL_DKK',
              'NORDNET_NYE_MARKEDER_INDEKS': 'NORDNET_EM_IDX',
              'NORDNET_TEKNOLOGI_INDEKS_DKK': 'NORDNET_TECH_IDX',
              'NORDNET_STABILE_AKTIER_INDEKS': 'NORDNET_STABLE_IDX',
              // Crypto → Yahoo Finance tickers
              'BTC': 'BTC-USD', 'BITCOIN': 'BTC-USD',
              'ETH': 'ETH-USD', 'ETHEREUM': 'ETH-USD',
              'SOL': 'SOL-USD', 'SOLANA': 'SOL-USD',
              'ADA': 'ADA-USD', 'CARDANO': 'ADA-USD',
              'DOGE': 'DOGE-USD', 'DOGECOIN': 'DOGE-USD',
              'LINK': 'LINK-USD', 'CHAINLINK': 'LINK-USD',
              'LTC': 'LTC-USD', 'LITECOIN': 'LTC-USD',
              'UNI': 'UNI-USD', 'UNISWAP': 'UNI-USD',
              'ZEC': 'ZEC-USD', 'ZCASH': 'ZEC-USD',
              'BAT': 'BAT-USD',
              'XRP': 'XRP-USD', 'RIPPLE': 'XRP-USD',
              'DOT': 'DOT-USD', 'POLKADOT': 'DOT-USD',
              'AVAX': 'AVAX-USD', 'AVALANCHE': 'AVAX-USD',
              'MATIC': 'MATIC-USD', 'POLYGON': 'MATIC-USD',
              'SHIB': 'SHIB-USD',
              'ATOM': 'ATOM-USD', 'COSMOS': 'ATOM-USD',
              'FIL': 'FIL-USD', 'FILECOIN': 'FIL-USD',
              'AAVE': 'AAVE-USD',
              'ALGO': 'ALGO-USD', 'ALGORAND': 'ALGO-USD',
              'NEAR': 'NEAR-USD',
              'APE': 'APE-USD',
              'MANA': 'MANA-USD',
              'SAND': 'SAND-USD',
              'FTM': 'FTM-USD', 'FANTOM': 'FTM-USD',
            };
            if (parsed.positions) parsed.positions.forEach(p => {
              // Skip positions with no ticker and no name
              if (!p.ticker && !p.name) return;
              let ticker = (p.ticker || p.name || 'UNKNOWN').toUpperCase();
              ticker = TICKER_FIX[ticker] || ticker;
              // Safety net: if AI returned value but no currentPrice, calculate it
              let currentPrice = p.currentPrice || 0;
              if (!currentPrice && p.value && p.shares && p.shares > 0) {
                currentPrice = p.value / p.shares;
              }
              // Auto-detect crypto: if ticker ends in -USD after normalization, or type is crypto
              const isCrypto = ticker.endsWith('-USD') || p.type === 'crypto';
              const posType = isCrypto ? 'crypto' : (p.type || 'stock');
              const posCurrency = isCrypto ? 'DKK' : (p.currency || 'DKK'); // Lunar shows values in DKK
              APP_STATE.positions.push({
                ...p, id: crypto.randomUUID(),
                broker: isCrypto && broker === 'saxo' ? 'lunar' : broker,
                accountType: isCrypto ? 'crypto' : accountType,
                ticker,
                type: posType,
                currentPrice,
                avgPrice: p.avgPrice || 0,
                currency: posCurrency,
                owner: owner === 'me' ? undefined : owner,
              });
              imported++;
            });
            window.saveData();
            if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
            refresh();
            setStatus(`Done: ${imported} ${isEn()?'positions imported. Fetching live prices...':'positioner importeret. Henter live kurser...'}`);
            // Auto-fetch live prices after import
            try {
              const priceResult = await fetchLivePrices();
              if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
              refresh();
              const failMsg = priceResult.failed?.length ? ` (${priceResult.failed.join(', ')} ${isEn()?'not found':'ikke fundet'})` : '';
              setStatus(`Done: ${imported} ${isEn()?'positions imported':'positioner importeret'}, ${priceResult.updated||0} ${isEn()?'prices updated':'kurser opdateret'}${failMsg}`);
            } catch(e) {
              console.error('Auto price fetch failed:', e);
              setStatus(`Done: ${imported} ${isEn()?'positions imported (price fetch failed)':'positioner importeret (kurshentning fejlede)'}`);
            }
            setTimeout(() => { ref.current?.close(); onClose(); setStatus(""); }, 3000);
          } else {
            console.error('No JSON found in AI response:', rawText);
            setStatus(isEn()?"AI couldn't find data in response":"AI kunne ikke finde data");
          }
        } else {
          console.error('Unexpected response format:', data);
          setStatus(isEn()?"Unexpected response from AI":"Uventet svar fra AI");
        }
    } catch(err) {
      console.error('Import error:', err);
      setStatus("! " + err.message);
    }
  };

  if (!open) return null;
  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-header">
        <h2 className="modal-title">{tl("modal.importTitle")}</h2>
        <button className="modal-close" onClick={()=>{ref.current?.close(); onClose();}}>&times;</button>
      </div>
      <form className="modal-body" onSubmit={handleSubmit}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
          <div className="form-group"><label>{tl("modal.broker")}</label>
            <select value={broker} onChange={e=>setBroker(e.target.value)}><option value="saxo">Saxo Bank</option><option value="nordnet">Nordnet</option><option value="lunar">Lunar</option><option value="coinbase">Coinbase</option><option value="revolut">Revolut</option><option value="wise">Wise</option><option value="kraken">Kraken</option><option value="binance">Binance</option><option value="crypto_com">Crypto.com</option><option value="other">{isEn()?'Other':'Anden'}</option></select>
          </div>
          <div className="form-group"><label>{tl("modal.accountType")}</label>
            <select value={accountType} onChange={e=>setAccountType(e.target.value)}><option value="ask">ASK</option><option value="free">{isEn()?'Free depot':'Frit depot'}</option><option value="pension">Pension</option><option value="isk">ISK</option><option value="crypto">Crypto</option><option value="other">{isEn()?'Other':'Anden'}</option></select>
          </div>
          <div className="form-group"><label>{isEn() ? 'Owner' : 'Ejer'}</label>
            <select value={owner} onChange={e=>setOwner(e.target.value)}>
              <option value="me">{isEn() ? 'Me' : 'Mig'}</option>
              {householdMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>{tl("modal.importFile")}</label>
          <input type="file" accept=".json,.pdf,.jpg,.jpeg,.png,.webp" style={{padding:8}}/>
          <p style={{color:"var(--text-dim)", fontSize:12, marginTop:6}}>{tl("modal.importFormats")}</p>
        </div>

        {/* Paste / Drop zone for screenshots */}
        <div className="form-group">
          <label>{isEn() ? 'Or paste / drop screenshots' : 'Eller indsaet / traek skaermbilleder'}</label>
          <div
            ref={pasteZoneRef}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            tabIndex={0}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: pastedImages.length > 0 ? 12 : 28,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: dragOver ? 'var(--accent-dim, rgba(217,175,98,0.08))' : 'transparent',
              outline: 'none',
              minHeight: 80,
            }}
            onClick={() => pasteZoneRef.current?.focus()}
          >
            {pastedImages.length === 0 ? (
              <div style={{color: 'var(--text-dim)', fontSize: 13}}>
                <div style={{fontSize: 28, marginBottom: 6, opacity: 0.5}}>&#128203;</div>
                <div>{isEn() ? 'Press Ctrl+V / Cmd+V to paste a screenshot' : 'Tryk Ctrl+V / Cmd+V for at indsaette et skaermbillede'}</div>
                <div style={{fontSize: 11, marginTop: 4, opacity: 0.7}}>{isEn() ? 'or drag & drop images here' : 'eller traek og slip billeder her'}</div>
              </div>
            ) : (
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center'}}>
                {pastedImages.map((img, idx) => (
                  <div key={idx} style={{position: 'relative', display: 'inline-block'}}>
                    <img
                      src={URL.createObjectURL(img)}
                      alt={`Pasted ${idx + 1}`}
                      style={{
                        height: 72,
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        objectFit: 'cover',
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removePastedImage(idx); }}
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--neg, #d96c6c)', color: '#fff',
                        border: 'none', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, padding: 0,
                      }}
                    >&times;</button>
                  </div>
                ))}
                <div
                  style={{
                    height: 72, width: 72, borderRadius: 6,
                    border: '2px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                  title={isEn() ? 'Paste or drop more' : 'Indsaet eller traek flere'}
                >+</div>
              </div>
            )}
          </div>
        </div>
        {status && <div style={{fontSize:13, color:"var(--text-muted)", marginBottom:12}}>{status}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={()=>{ref.current?.close(); onClose(); setPastedImages([]);}}>{tl("modal.cancel")}</button>
          <button type="submit" className="btn btn-primary">
            {pastedImages.length > 0
              ? (isEn() ? `Scan ${pastedImages.length} image${pastedImages.length > 1 ? 's' : ''}` : `Scan ${pastedImages.length} billede${pastedImages.length > 1 ? 'r' : ''}`)
              : tl("modal.importBtn")}
          </button>
        </div>
      </form>
    </dialog>
  );
};

// ==========================================================================
// MAIN APP
// ==========================================================================
function App() {
  const { state, refresh, tick } = useAppState();
  const [authed, setAuthed] = useState(() => {
    // Auto-login if user has saved data (avoid login screen on refresh)
    try {
      const savedPositions = localStorage.getItem('pi-positions');
      const savedEntries = localStorage.getItem('pi-entries');
      const savedPrefs = localStorage.getItem('pi-prefs');
      if (savedPositions || savedEntries || savedPrefs) {
        APP_STATE.user = { email: "demo@portfolio.dk", id: "demo-returning" };
        APP_STATE.demoMode = true;
        window.loadData();
        if (window.fetchFxRates) fetchFxRates().catch(() => {});
        if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
        return true;
      }
    } catch {}
    return false;
  });
  const [route, setRoute] = useState("overview");
  const [theme, setThemeState] = useState(state.theme || "light");
  const [lang, setLangState] = useState(state.lang || "da");
  const [privacyMode, setPrivacyModeState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pi-privacy-mode')) || false; } catch { return false; }
  });

  // Household state
  const [household, setHouseholdState] = useState(() => loadHousehold());
  const [activeMember, setActiveMember] = useState("me");
  const setHousehold = (members) => { setHouseholdState(members); saveHousehold(members); };

  // Modal state
  const [modal, setModal] = useState(null);
  const openModal = (type, data) => setModal({ type, data });
  const closeModal = () => setModal(null);

  // Accounts tab persistence
  const [accountsTab, setAccountsTab] = useState("investments");

  // Huginn initial message from quick ask
  const [huginnInitialMsg, setHuginnInitialMsg] = useState("");

  // Theme
  const setTheme = (t) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    APP_STATE.theme = t;
    window.savePreferences();
  };

  // Language
  const setLang = (l) => {
    setLangState(l);
    APP_STATE.lang = l;
    if (window.applyTranslations) applyTranslations(l);
    window.savePreferences();
    refresh();
  };

  // Privacy Mode
  const setPrivacyMode = (value) => {
    setPrivacyModeState(value);
    try { localStorage.setItem('pi-privacy-mode', JSON.stringify(value)); } catch {}
  };

  // Init
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pi-prefs'));
      if (saved) {
        Object.assign(APP_STATE, saved);
        setThemeState(saved.theme || 'light');
        setLangState(saved.lang || 'da');
        document.documentElement.dataset.theme = saved.theme || 'light';
      }
    } catch {}
    if (window.applyTranslations) applyTranslations(APP_STATE.lang);
  }, []);

  // Auto-refresh prices every 5 minutes
  useEffect(() => {
    if (!authed) return;
    const AUTO_REFRESH_MS = 5 * 60 * 1000;

    const doAutoRefresh = async () => {
      if (!window.fetchLivePrices) return;
      const positions = APP_STATE?.positions || [];
      if (positions.length === 0) return;
      try {
        await fetchLivePrices();
        if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
        refresh();
      } catch {}
    };

    const lastUpdate = APP_STATE.lastPriceUpdate;
    if (!lastUpdate || (Date.now() - new Date(lastUpdate).getTime()) > AUTO_REFRESH_MS) {
      setTimeout(doAutoRefresh, 2000);
    }

    const interval = setInterval(doAutoRefresh, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [authed, refresh]);

  // Auth handler
  const handleLogin = () => {
    setAuthed(true);
    window.loadData();
    if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
    refresh();
  };

  // If active member was removed from household, reset to "me"
  useEffect(() => {
    if (activeMember !== 'me' && activeMember !== 'household' && !household.find(m => m.id === activeMember)) {
      setActiveMember('me');
    }
  }, [household, activeMember]);

  // Create filtered state based on active member (must be before early return to keep hook order stable)
  const safeActiveMember = (activeMember !== 'me' && activeMember !== 'household' && !household.find(m => m.id === activeMember)) ? 'me' : activeMember;

  const filteredState = useMemo(() => {
    const filterByOwner = (items) => {
      if (!items) return [];
      if (safeActiveMember === 'household') return items;
      if (safeActiveMember === 'me') return items.filter(i => !i.owner || i.owner === 'me');
      return items.filter(i => i.owner === safeActiveMember);
    };
    return {
      ...state,
      entries: filterByOwner(state.entries),
      positions: filterByOwner(state.positions),
    };
  }, [state, state.entries, state.positions, safeActiveMember, tick]);

  if (!authed) return <AuthScreen onLogin={handleLogin}/>;

  const currentNav = NAV.find(n => n.id === route) || NAV[0];
  const positions = filteredState.positions || [];

  const navBadges = {
    accounts: positions.length > 0 ? String(positions.length) : null,
  };

  // Navigation helper for Overview
  const navigateTo = (target, tab) => {
    if (target === 'import') {
      openModal('import');
    } else if (target === 'add-position') {
      openModal('position');
    } else if (target === 'accounts') {
      if (tab) setAccountsTab(tab);
      setRoute('accounts');
    } else if (target === 'huginn') {
      setRoute('huginn');
    } else {
      setRoute(target);
    }
  };

  // Quick ask handler: navigate to Huginn and pass message
  const sendQuickAsk = (text) => {
    setHuginnInitialMsg(text);
    setRoute('huginn');
  };

  // RavenIcon for nav
  const RavenIcon = ({ size = 15, style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M4 19c0-3 2-6 6-8l2-1c2-1 4-3 5-5l1-2s1 3-1 6c0 0 3-1 4 1s-1 4-3 5l-3 2c-2 1-4 3-5 5l-1 2"/>
      <circle cx="15" cy="7" r="0.8" fill="currentColor" stroke="none"/>
    </svg>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-name">Portfolio<small>Intelligence</small></div>
        </div>

        <nav className="nav">
          <div className="nav-section">Workspace</div>
          {NAV.map(n => (
            <a key={n.id} href="#" className={route===n.id?"active":""} onClick={e=>{e.preventDefault(); setRoute(n.id); if (n.id !== 'huginn') setHuginnInitialMsg("");}}
              style={n.id === 'huginn' ? {position:"relative"} : undefined}>
              {n.id === 'huginn' ? (
                <RavenIcon size={15}/>
              ) : (
                <Icon name={n.icon} size={15}/>
              )}
              <span>{isEn() ? n.label.en : n.label.da}</span>
              {navBadges[n.id] && <span className="badge">{navBadges[n.id]}</span>}
              {n.id === 'huginn' && (
                <span style={{width:6, height:6, borderRadius:"50%", background:"var(--accent)", marginLeft:"auto", flexShrink:0}}/>
              )}
            </a>
          ))}

          <div className="nav-section" style={{marginTop:8}}>{isEn()?'Shortcuts':'Genveje'}</div>
          <a href="#" onClick={e=>{e.preventDefault(); openModal('position');}}><Icon name="plus" size={15}/><span>{tl("portfolio.addPosition")}</span></a>
          <a href="#" onClick={e=>{e.preventDefault(); openModal('import');}}><Icon name="upload" size={15}/><span>{tl("portfolio.import")}</span></a>
        </nav>

        <div className="side-footer">
          <div className="account-chip">
            <div className="avatar">{(state.user?.email||'D').charAt(0).toUpperCase()}</div>
            <div className="account-chip-info">
              <div className="name">{state.user?.email||'demo@portfolio.dk'}</div>
              <div className="plan">
                <button style={{background:"none", border:"none", color:"var(--text-dim)", fontSize:11, cursor:"pointer", padding:0}}
                  onClick={()=>{APP_STATE.user=null; APP_STATE.demoMode=false; setAuthed(false);}}>
                  {tl("nav.logout")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <Icon name="chevron" size={12}/>
            <strong>{isEn() ? currentNav.label.en : currentNav.label.da}</strong>
          </div>
          <div className="topbar-spacer"/>
          {household.length > 0 && (
            <div className="segmented" style={{fontSize:11}}>
              <button className={activeMember==="me"?"active":""} onClick={()=>setActiveMember("me")} style={{padding:"4px 10px", fontSize:11}} title={isEn()?'Me':'Mig'}>
                <Icon name="user" size={12} style={{verticalAlign:"-1px"}}/> {isEn()?'Me':'Mig'}
              </button>
              {household.map(m => (
                <button key={m.id} className={activeMember===m.id?"active":""} onClick={()=>setActiveMember(m.id)} style={{padding:"4px 10px", fontSize:11}} title={m.name}>
                  <Icon name={m.relation==='child'?'baby':'user'} size={12} style={{verticalAlign:"-1px"}}/> {m.name}
                </button>
              ))}
              <button className={activeMember==="household"?"active":""} onClick={()=>setActiveMember("household")} style={{padding:"4px 10px", fontSize:11}} title={isEn()?'Household':'Husstand'}>
                <Icon name="users" size={12} style={{verticalAlign:"-1px"}}/> {isEn()?'All':'Alle'}
              </button>
            </div>
          )}
          <div className="segmented" style={{fontSize:11}}>
            <button className={lang==="da"?"active":""} onClick={()=>setLang("da")} style={{padding:"4px 10px", fontSize:11}}>DA</button>
            <button className={lang==="en"?"active":""} onClick={()=>setLang("en")} style={{padding:"4px 10px", fontSize:11}}>EN</button>
          </div>
          <button className={`icon-btn${privacyMode ? ' privacy-active' : ''}`} onClick={()=>setPrivacyMode(!privacyMode)} title={privacyMode ? "Privacy Mode: ON" : "Privacy Mode: OFF"}>
            <Icon name={privacyMode?"eye-off":"eye"} size={15}/>
          </button>
          <button className="icon-btn" onClick={()=>setTheme(theme==="light"?"dark":"light")}>
            <Icon name={theme==="light"?"moon":"sun"} size={15}/>
          </button>
        </div>

        <div className={`content${privacyMode ? ' privacy-mode' : ''}`}>
          {route === 'overview' && (
            <Overview key={safeActiveMember + '-overview'} state={filteredState} refresh={refresh} activeMember={activeMember} privacyMode={privacyMode} navigateTo={navigateTo} sendQuickAsk={sendQuickAsk} />
          )}
          {route === 'accounts' && (
            <AccountsScreen key={safeActiveMember + '-accounts'} state={filteredState} refresh={refresh} openModal={openModal} privacyMode={privacyMode} household={household} activeMember={activeMember} initialTab={accountsTab} />
          )}
          {route === 'huginn' && (
            <HuginnScreen key="huginn" state={state} refresh={refresh} privacyMode={privacyMode} initialMessage={huginnInitialMsg} />
          )}
          {route === 'settings' && (
            <SettingsScreen key="settings" state={filteredState} refresh={refresh} theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} household={household} setHousehold={setHousehold} privacyMode={privacyMode} />
          )}
        </div>
      </div>

      {/* Modals */}
      <EntryModal open={modal?.type==='entry'} onClose={closeModal} editData={modal?.data} refresh={refresh} household={household} activeMember={activeMember}/>
      <PositionModal open={modal?.type==='position'} onClose={closeModal} editData={modal?.data} refresh={refresh} household={household} activeMember={activeMember}/>
      <ImportModal open={modal?.type==='import'} onClose={closeModal} refresh={refresh} activeMember={activeMember}/>
    </div>
  );
}

// ==========================================================================
// MOUNT
// ==========================================================================
window.__mountApp = function() {
  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
};
