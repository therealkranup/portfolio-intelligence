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
  { id: "overview",  icon: "grid",    i18n: "nav.overview" },
  { id: "networth",  icon: "dollar",  i18n: "nav.networth" },
  { id: "pension",   icon: "trending", i18n: "nav.pension" },
  { id: "mortgage",  icon: "briefcase", i18n: "nav.mortgage" },
  { id: "portfolio", icon: "layers",  i18n: "nav.portfolio" },
  { id: "overlap",   icon: "overlap", i18n: "nav.overlap" },
  { id: "score",     icon: "activity",i18n: "nav.score" },
  { id: "rebalance", icon: "balance", i18n: "nav.rebalance" },
  { id: "huginn",    icon: "message", i18n: "nav.huginn" },
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
const Overview = ({ state, refresh, activeMember, privacyMode }) => {
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
    if (!hasPartnerMember) return 100; // no partner = 100% mine
    if (isHouseholdView) return 100; // household = full value
    if (activeMember === 'me' || !activeMember) return propertySplit.me ?? 50;
    if (partnerMember && activeMember === partnerMember.id) return 100 - (propertySplit.me ?? 50);
    return 0; // children don't own property
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
    setPriceStatus(isEn() ? "Fetching live prices…" : "Henter live kurser…");
    try {
      const result = await fetchLivePrices();
      if (result.error) {
        setPriceStatus("❌ " + result.error);
      } else if (result.updated > 0) {
        const failMsg = result.failed.length ? ` (${result.failed.join(', ')} ${isEn()?'not found':'ikke fundet'})` : '';
        setPriceStatus(`✓ ${result.updated} ${isEn()?'prices updated':'kurser opdateret'}${failMsg}`);
      } else {
        setPriceStatus(isEn() ? "No prices found" : "Ingen kurser fundet");
      }
    } catch(e) {
      setPriceStatus("❌ " + e.message);
    }
    setPriceLoading(false);
    refresh();
    setTimeout(() => setPriceStatus(""), 8000);
  }, [refresh]);

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

      {/* KPI row — Net Worth + Score */}
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

        {/* Investments breakdown */}
        <div className="card col-4 stat" style={{cursor:"pointer"}} onClick={() => { state.currentView = 'portfolio'; refresh(); }}>
          <div className="eyebrow"><Icon name="layers" size={12} style={{marginRight:4}}/>{isEn() ? 'Investments' : 'Investeringer'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize:26}}>{fmtC(portfolioTotal)}</div>
          <div style={{display:"flex", flexDirection:"column", gap:4, marginTop:8}}>
            {Object.entries(investmentBreakdown).sort((a,b)=>b[1]-a[1]).map(([type, val]) => (
              <div key={type} style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                <span style={{color:"var(--text-dim)"}}>{accountLabelsShort[type] || type}</span>
                <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(val)}</span>
              </div>
            ))}
          </div>
          <div style={{fontSize:10, color:"var(--text-dim)", marginTop:6}}>
            {positions.filter(p=>p.type==="etf").length} ETFs · {positions.filter(p=>p.type==="stock").length} {isEn()?'stocks':'aktier'} →
          </div>
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
          ) : <div className="value">—</div>}
        </div>
      </div>

      {/* Row 2 — Pension + Home Equity */}
      <div className="grid grid-12" style={{marginBottom: 20}}>
        {totalPensionSavings > 0 && (
          <div className="card col-4 stat" style={{cursor:"pointer"}} onClick={() => { state.currentView = 'pension'; refresh(); }}>
            <div className="eyebrow"><Icon name="trending" size={12} style={{marginRight:4}}/>{isEn() ? 'Pension' : 'Pension'}</div>
            <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize:26}}>{fmtC(totalPensionSavings)}</div>
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
                  <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Monthly' : 'Månedlig'}</span>
                  <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(pensionMonthly)}/md</span>
                </div>
              )}
            </div>
            <div style={{fontSize:10, color:"var(--text-dim)", marginTop:6}}>{isEn() ? 'View projections →' : 'Se fremskrivning →'}</div>
          </div>
        )}
        {propertyValue > 0 && (
          <div className="card col-4 stat" style={{cursor:"pointer"}} onClick={() => { state.currentView = 'mortgage'; refresh(); }}>
            <div className="eyebrow"><Icon name="home" size={12} style={{marginRight:4}}/>{isEn() ? 'Home equity' : 'Friværdi'}{propSplitPct < 100 ? ` (${propSplitPct}%)` : ''}</div>
            <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize:26, color: homeEquity >= 0 ? "var(--pos)" : "var(--neg)"}}>{fmtC(homeEquity)}</div>
            <div style={{display:"flex", flexDirection:"column", gap:4, marginTop:8}}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Property' : 'Ejendom'}</span>
                <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(propertyValue)}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                <span style={{color:"var(--text-dim)"}}>{isEn() ? 'Mortgage' : 'Lån'}</span>
                <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500, color:"var(--neg)"}}>−{fmtC(mortgageBalance)}</span>
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
            <div style={{fontSize:10, color:"var(--text-dim)", marginTop:6}}>{fmtP(propertyValue > 0 ? (homeEquity/propertyValue*100) : 0, 0)} {isEn() ? 'equity' : 'friværdi'} →</div>
          </div>
        )}
        {/* Cash & other liquid */}
        {(() => {
          const cashEntries = entries.filter(e => e.type === 'asset' && (e.category === 'cash' || e.category === 'savings'));
          const cashTotal = cashEntries.reduce((s, e) => s + (e.amount || 0), 0);
          if (cashTotal <= 0) return null;
          return (
            <div className="card col-4 stat">
              <div className="eyebrow"><Icon name="dollar" size={12} style={{marginRight:4}}/>{isEn() ? 'Cash & Savings' : 'Kontant & Opsparing'}</div>
              <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize:26}}>{fmtC(cashTotal)}</div>
              <div style={{display:"flex", flexDirection:"column", gap:4, marginTop:8}}>
                {cashEntries.slice(0, 3).map((e, i) => (
                  <div key={i} style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                    <span style={{color:"var(--text-dim)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140}}>{e.name}</span>
                    <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily:"var(--font-mono)", fontWeight:500}}>{fmtC(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
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
                      <span><strong>{brokerLabels[g.broker]||g.broker||'—'}</strong> — {accountLabels[g.accountType]||g.accountType||'—'}</span>
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

      {/* Actions */}
      {suggestions.length > 0 && (
        <div style={{marginTop:20}} className="card">
          <div className="card-head">
            <h3 className="card-title">{isEn() ? "Actions to consider" : "Handlinger at overveje"}</h3>
          </div>
          <div style={{display:"grid", gap:12}}>
            {suggestions.slice(0, 3).map((s, i) => (
              <div key={i} className={"insight " + (s.priority==="high"?"alert":s.priority==="medium"?"warn":"good")}>
                <div className="insight-icon"><Icon name={s.type==="warning"?"alert":s.type==="tax"?"tax":s.type==="risk"?"pie":"overlap"} size={18}/></div>
                <div className="insight-body">
                  <div className="insight-title">{s.title} <span className={"severity " + (s.priority==="high"?"high":s.priority==="medium"?"med":"low")}>{s.priority}</span></div>
                  <div className="insight-text">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================================================
// NET WORTH
// ==========================================================================
const NetWorthScreen = ({ state, refresh, openModal, privacyMode }) => {
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
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title">{isEn() ? <>Net <em>Worth</em></> : <><em>Formue</em></>}</h1>
          <p className="page-subtitle">{tl("networth.subtitle")}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-accent" onClick={() => openModal('entry')}>
            <Icon name="plus" size={15}/> {tl("networth.addEntry")}
          </button>
        </div>
      </div>

      <div className="waterfall" style={{marginBottom:20}}>
        <div className="wf-col assets">
          <span className="eyebrow">{tl("networth.assets")}</span>
          <div className={`big${privacyMode ? ' sensitive' : ''}`} style={{color:"var(--pos)"}}>{fmtC(totalA)}</div>
          <div style={{marginTop:8, fontSize:12, color:"var(--text-muted)"}}>{assets.length} {isEn()?'accounts':'konti'}</div>
        </div>
        <div className="wf-col liab">
          <span className="eyebrow">{tl("networth.liabilities")}</span>
          <div className={`big${privacyMode ? ' sensitive' : ''}`} style={{color: totalL>0?"var(--neg)":"var(--text)"}}>− {fmtC(totalL)}</div>
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
              <Icon name="plus" size={14}/> {isEn()?'Add':'Tilføj'}
            </button>
          </div>
          {assets.length === 0 ? <div style={{color:"var(--text-dim)", fontSize:13}}>{tl("networth.noAssets")}</div> :
            assets.map(a => {
              const catLabels = { cash: isEn()?'Bank account':'Bankkonto', savings: isEn()?'Savings':'Opsparing', investment: isEn()?'Investment':'Investering', property: isEn()?'Property':'Ejendom', pension: 'Pension', vehicle: isEn()?'Vehicle':'Køretøj', other_asset: isEn()?'Other':'Andet' };
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
              <Icon name="plus" size={14}/> {isEn()?'Add':'Tilføj'}
            </button>
          </div>
          {liabilities.length === 0 ? <div style={{color:"var(--text-dim)", fontSize:13}}>{tl("networth.noLiabilities")}</div> :
            liabilities.map(a => {
              const catLabels = { mortgage: isEn()?'Mortgage':'Realkreditlån', student_loan: isEn()?'Student loan':'Studielån', car_loan: isEn()?'Car loan':'Billån', credit_card: isEn()?'Credit card':'Kreditkort', other_liability: isEn()?'Other':'Andet' };
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
                  <div className={`line-val${privacyMode ? ' sensitive' : ''}`} style={{color:"var(--neg)"}}>− {fmtC(a.amount)}</div>
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
    </div>
  );
};

// ==========================================================================
// PENSION
// ==========================================================================
const PensionScreen = ({ state, refresh, openModal, activeMember, privacyMode }) => {
  const isHousehold = activeMember === 'household';
  const pensionEntries = (state.entries || []).filter(e => e.category === 'pension');
  const currentPension = pensionEntries.reduce((s, e) => s + (e.amount || 0), 0);

  // Per-member pension config key
  const configKey = activeMember && activeMember !== 'me' && activeMember !== 'household'
    ? `pi-pension-config-${activeMember}` : 'pi-pension-config';
  const defaults = { monthly: 2000, match: 0, currentAge: 39, retireAge: 67, lumpSum: 0 };

  // For household view, aggregate all members' configs
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
    // Aggregate: sum lumpSum & monthly, use youngest age & latest retire age
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
  const [activeScenario, setActiveScenario] = useState(1); // 0=conservative, 1=moderate, 2=aggressive
  const [hoverYear, setHoverYear] = useState(null);

  const updateConfig = (key, val) => {
    if (isHousehold) return; // read-only in household view
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

  // Monthly retirement income (4% rule)
  const monthlyIncome = scenarios.length > 0 ? Math.round(scenarios[activeScenario].finalValue * 0.04 / 12) : 0;

  // Input field style — larger, properly sized
  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--bg-sunk)",
    color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 16,
    fontWeight: 500, textAlign: "right", outline: "none",
    transition: "border-color 0.2s",
  };
  const labelStyle = { fontSize: 12, color: "var(--text-dim)", marginBottom: 6, display: "block", fontWeight: 500 };

  return (
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title">{isEn() ? <><em>Pension</em> planner</> : <><em>Pensions</em>planlægger</>}</h1>
          <p className="page-subtitle">{isEn() ? 'Project your retirement savings' : 'Fremskriv din pensionsopsparing'}</p>
        </div>
      </div>

      {/* Hero KPI row */}
      <div className="grid grid-12" style={{marginBottom: 24}}>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Current pension' : 'Nuværende pension'}</div>
          <div className="value" style={{fontSize: 28}}>{fmtC(totalCurrentPension)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
            {totalCurrentPension > 0 ? (isEn() ? 'starting balance' : 'startsaldo') : (isEn() ? 'set below ↓' : 'indstil nedenfor ↓')}
          </div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Years to retirement' : 'År til pension'}</div>
          <div className="value" style={{fontSize: 28}}>{yearsToRetire}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
            {isEn() ? `Age ${effectiveConfig.currentAge} → ${effectiveConfig.retireAge}` : `Alder ${effectiveConfig.currentAge} → ${effectiveConfig.retireAge}`}
          </div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Monthly savings' : 'Månedlig opsparing'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28}}>{fmtC(totalMonthlyWithMatch)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
            {config.match > 0 ? (isEn() ? `incl. ${config.match}% match` : `inkl. ${config.match}% match`) : (isEn() ? 'your contribution' : 'dit bidrag')}
          </div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Est. monthly income' : 'Est. månedlig indkomst'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28, color: "var(--pos)"}}>{fmtC(monthlyIncome)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
            {isEn() ? '4% withdrawal rule' : '4% udtrækningsregel'}
          </div>
        </div>
      </div>

      {/* Settings card — wider inputs with sliders for ages (or member breakdown for household) */}
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
                        <span style={{color: "var(--text-dim)"}}>{isEn() ? 'Monthly' : 'Månedlig'}</span>
                        <span className={privacyMode ? 'sensitive' : ''} style={{fontFamily: "var(--font-mono)", fontWeight: 500}}>{fmtC(mMonthly)}</span>
                      </div>
                      <div style={{display: "flex", justifyContent: "space-between", fontSize: 12}}>
                        <span style={{color: "var(--text-dim)"}}>{isEn() ? 'Age' : 'Alder'}</span>
                        <span style={{fontFamily: "var(--font-mono)", fontWeight: 500}}>{c.currentAge || 39} → {c.retireAge || 67}</span>
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
            {/* Row 1: Lump sum + monthly + employer match */}
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20}}>
              <div>
                <label style={labelStyle}>{isEn() ? 'Current pension savings' : 'Nuværende pensionsopsparing'}</label>
                <input type="number" value={config.lumpSum || ''} step="10000" min="0"
                  placeholder={isEn() ? 'e.g. 250000' : 'f.eks. 250000'}
                  onChange={e => updateConfig('lumpSum', e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  style={inputStyle} />
                <div style={{fontSize: 10, color: "var(--text-dim)", marginTop: 4, textAlign: "right"}}>{isEn() ? 'total saved so far (kr.)' : 'samlet opsparet (kr.)'}</div>
              </div>
              <div>
                <label style={labelStyle}>{isEn() ? 'Monthly contribution' : 'Månedligt bidrag'}</label>
                <input type="number" value={config.monthly} step="500"
                  onChange={e => updateConfig('monthly', e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  style={inputStyle} />
                <div style={{fontSize: 10, color: "var(--text-dim)", marginTop: 4, textAlign: "right"}}>kr. / {isEn() ? 'month' : 'måned'}</div>
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
            {/* Row 2: Age sliders */}
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20}}>
              <div>
                <label style={labelStyle}>{isEn() ? 'Current age' : 'Nuværende alder'}: <strong style={{color: "var(--text)"}}>{config.currentAge}</strong></label>
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

      {/* Scenario cards — clickable to highlight */}
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
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `${scenarioColors[i]}18`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon name={scenarioIcons[i]} size={16} style={{color: scenarioColors[i]}} />
                    </div>
                    <div>
                      <div style={{fontWeight: 600, fontSize: 13}}>{isEn() ? scenarioNames[i] : scenarioNamesDa[i]}</div>
                      <div style={{fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)"}}>{(s.rate * 100).toFixed(0)}% p.a.</div>
                    </div>
                    {isActive && <div style={{marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: scenarioColors[i]}} />}
                  </div>
                  <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 26, marginBottom: 8}}>{fmtC(s.finalValue)}</div>

                  {/* Contributions vs growth breakdown bar */}
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
                {/* Grid lines */}
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

                {/* Scenario lines */}
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
                      {/* End dot */}
                      {s.points.length > 0 && (() => {
                        const lastPt = s.points[s.points.length - 1];
                        const lx = padL + plotW;
                        const ly = padT + plotH - (maxVal > 0 ? (lastPt.value / maxVal) * plotH : 0);
                        return isActive ? <circle cx={lx} cy={ly} r={4} fill={scenarioColors[si]} stroke="var(--bg-card)" strokeWidth="2" /> : null;
                      })()}
                    </g>
                  );
                })}

                {/* Hover overlay — invisible rects for each year */}
                {scenarios[0]?.points.map((p, pi) => {
                  const x = padL + (pi / Math.max(1, scenarios[0].points.length - 1)) * plotW;
                  const w = plotW / Math.max(1, scenarios[0].points.length - 1);
                  return (
                    <rect key={pi} x={x - w / 2} y={padT} width={w} height={plotH}
                      fill="transparent" style={{cursor: "crosshair"}}
                      onMouseEnter={() => setHoverYear(pi)} />
                  );
                })}

                {/* Hover vertical line + value label */}
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

                {/* X-axis labels */}
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
                <Icon name="plus" size={13}/> {isEn() ? 'Add' : 'Tilføj'}
              </button>
            </div>
            {pensionEntries.length === 0 ? (
              <div style={{textAlign: "center", padding: "24px 16px", color: "var(--text-dim)", fontSize: 13}}>
                {isEn() ? 'No pension accounts yet. Add one to track your retirement savings.' : 'Ingen pensionskonti endnu. Tilføj en for at følge din pensionsopsparing.'}
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

      {/* Empty state */}
      {currentPension === 0 && scenarios.length > 0 && (
        <div className="card" style={{textAlign: "center", padding: "32px 24px", marginTop: 16, background: "var(--bg-sunk)", borderStyle: "dashed"}}>
          <Icon name="trending" size={36} style={{color: "var(--text-dim)", marginBottom: 10}} />
          <p style={{color: "var(--text-muted)", fontSize: 13, maxWidth: 360, margin: "0 auto", lineHeight: 1.5}}>
            {isEn()
              ? 'Your projections are based on contributions only. Add pension entries in Net Worth to include your current balance.'
              : 'Dine fremskrivninger er kun baseret på bidrag. Tilføj pensionsposter under Formue for at inkludere din nuværende saldo.'}
          </p>
        </div>
      )}
    </div>
  );
};

// ==========================================================================
// ASSETS & LOANS (Big Picture)
// ==========================================================================
const MortgageScreen = ({ state, refresh, openModal, household, activeMember, privacyMode }) => {
  const entries = state.entries || [];

  // Group all big assets (not cash/investment — those are in portfolio/networth)
  const assetCategories = {
    property:    { icon: "home",      en: "Real estate",    da: "Ejendom",     color: "oklch(0.55 0.14 145)" },
    vehicle:     { icon: "zap",       en: "Vehicles",       da: "Køretøjer",   color: "oklch(0.55 0.14 265)" },
    other_asset: { icon: "briefcase", en: "Other assets",   da: "Andre aktiver",color: "oklch(0.60 0.14 45)" },
  };
  const loanCategories = {
    mortgage:       { icon: "home",      en: "Mortgage",       da: "Realkreditlån",  color: "oklch(0.55 0.15 25)" },
    car_loan:       { icon: "zap",       en: "Car loan",       da: "Billån",         color: "oklch(0.55 0.14 350)" },
    student_loan:   { icon: "edit",      en: "Student loan",   da: "Studielån",      color: "oklch(0.60 0.12 265)" },
    credit_card:    { icon: "alert",     en: "Credit card",    da: "Kreditkort",     color: "oklch(0.55 0.16 45)" },
    other_liability:{ icon: "briefcase", en: "Other loans",    da: "Anden gæld",     color: "oklch(0.55 0.10 200)" },
  };

  const bigAssets = entries.filter(e => e.type === 'asset' && assetCategories[e.category]);
  const loans = entries.filter(e => e.type === 'liability' && loanCategories[e.category]);
  // Also include liabilities with categories that match our loan types
  const allLoans = entries.filter(e => e.type === 'liability');

  const totalBigAssets = bigAssets.reduce((s, e) => s + (e.amount || 0), 0);
  const totalLoans = allLoans.reduce((s, e) => s + (e.amount || 0), 0);
  const netPosition = totalBigAssets - totalLoans;

  // Mortgage-specific for amortization
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

  // Ownership split between household members
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

  // Donut data for asset distribution
  const assetDonut = useMemo(() => {
    const groups = {};
    bigAssets.forEach(e => {
      const cat = assetCategories[e.category] || assetCategories.other_asset;
      const key = e.category;
      if (!groups[key]) groups[key] = { name: isEn() ? cat.en : cat.da, value: 0, color: cat.color };
      groups[key].value += e.amount || 0;
    });
    return Object.values(groups).sort((a, b) => b.value - a.value);
  }, [bigAssets.length, state.tick]);

  const loanDonut = useMemo(() => {
    const groups = {};
    allLoans.forEach(e => {
      const cat = loanCategories[e.category] || loanCategories.other_liability;
      const key = e.category;
      if (!groups[key]) groups[key] = { name: isEn() ? cat.en : cat.da, value: 0, color: cat.color };
      groups[key].value += e.amount || 0;
    });
    return Object.values(groups).sort((a, b) => b.value - a.value);
  }, [allLoans.length, state.tick]);

  return (
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title">{isEn() ? <><em>Assets</em> & Loans</> : <><em>Aktiver</em> & Lån</>}</h1>
          <p className="page-subtitle">{isEn() ? 'Your big-ticket assets, loans and home equity' : 'Dine store aktiver, lån og friværdi'}</p>
        </div>
        {openModal && (
          <div className="page-actions">
            <button className="btn" onClick={() => openModal('entry', { type: 'asset', category: 'property' })}>
              <Icon name="plus" size={14}/> {isEn() ? 'Add entry' : 'Tilføj post'}
            </button>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-12" style={{marginBottom: 24}}>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Total assets' : 'Aktiver i alt'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28}}>{fmtC(totalBigAssets)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>{bigAssets.length} {isEn() ? 'items' : 'poster'}</div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Total loans' : 'Lån i alt'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28, color: "var(--neg)"}}>{fmtC(totalLoans)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>{allLoans.length} {isEn() ? 'loans' : 'lån'}</div>
        </div>
        <div className="card col-3 stat">
          <div className="eyebrow">{isEn() ? 'Net position' : 'Netto'}</div>
          <div className={`value${privacyMode ? ' sensitive' : ''}`} style={{fontSize: 28, color: netPosition >= 0 ? "var(--pos)" : "var(--neg)"}}>{fmtC(netPosition)}</div>
          <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>{isEn() ? 'assets minus loans' : 'aktiver minus lån'}</div>
        </div>
        {propertyValue > 0 && (
          <div className="card col-3 stat">
            <div className="eyebrow">LTV</div>
            <div className="value" style={{fontSize: 28, color: ltv > 80 ? "var(--neg)" : ltv > 60 ? "var(--accent)" : "var(--pos)"}}>{ltv.toFixed(1)}%</div>
            <div style={{fontSize: 11, color: "var(--text-dim)", marginTop: 4}}>
              <span className={privacyMode ? 'sensitive' : ''}>{fmtC(homeEquity)}</span> {isEn() ? 'equity' : 'friværdi'}
            </div>
          </div>
        )}
      </div>

      {/* Property ownership split — only if partner exists and property exists */}
      {hasPartner && propertyValue > 0 && (
        <div className="card" style={{marginBottom: 24}}>
          <div className="card-head">
            <h3 className="card-title"><Icon name="users" size={15} style={{marginRight: 6, opacity: 0.5}}/>{isEn() ? 'Property ownership' : 'Ejendomsejerskab'}</h3>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr auto 1fr", gap: 20, alignItems: "center"}}>
            {/* Me */}
            <div style={{textAlign: "center"}}>
              <div style={{fontSize: 12, color: "var(--text-dim)", marginBottom: 6, fontWeight: 500}}>
                <Icon name="user" size={12} style={{marginRight: 4, opacity: 0.5}}/>{isEn() ? 'Me' : 'Mig'}
              </div>
              <div style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600}}>{myPct}%</div>
              <div className={privacyMode ? 'sensitive' : ''} style={{fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--pos)", marginTop: 4}}>
                {fmtC(homeEquity * myPct / 100)}
              </div>
              <div style={{fontSize: 10, color: "var(--text-dim)", marginTop: 2}}>{isEn() ? 'equity share' : 'friværdiandel'}</div>
            </div>
            {/* Slider */}
            <div style={{width: 200, textAlign: "center"}}>
              <input type="range" min="0" max="100" step="5" value={myPct}
                onChange={e => updateSplit(e.target.value)}
                style={{width: "100%", accentColor: "var(--accent)"}} />
              <div style={{display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)", marginTop: 2}}>
                <span>0%</span><span>50/50</span><span>100%</span>
              </div>
            </div>
            {/* Partner */}
            <div style={{textAlign: "center"}}>
              <div style={{fontSize: 12, color: "var(--text-dim)", marginBottom: 6, fontWeight: 500}}>
                <Icon name="user" size={12} style={{marginRight: 4, opacity: 0.5}}/>{partner?.name || 'Partner'}
              </div>
              <div style={{fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600}}>{partnerPct}%</div>
              <div className={privacyMode ? 'sensitive' : ''} style={{fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--pos)", marginTop: 4}}>
                {fmtC(homeEquity * partnerPct / 100)}
              </div>
              <div style={{fontSize: 10, color: "var(--text-dim)", marginTop: 2}}>{isEn() ? 'equity share' : 'friværdiandel'}</div>
            </div>
          </div>
          <div style={{display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)"}}>
            <span>{isEn() ? 'Total property' : 'Ejendomsværdi'}: <span className={privacyMode ? 'sensitive' : ''}>{fmtC(propertyValue)}</span></span>
            <span>{isEn() ? 'Total mortgage' : 'Realkreditlån'}: <span className={privacyMode ? 'sensitive' : ''}>{fmtC(mortgageBalance)}</span></span>
            <span>{isEn() ? 'Total equity' : 'Friværdi i alt'}: <span className={privacyMode ? 'sensitive' : ''}>{fmtC(homeEquity)}</span></span>
          </div>
        </div>
      )}

      {/* Assets & Loans side by side */}
      <div className="grid grid-12" style={{marginBottom: 24}}>
        {/* Assets list */}
        <div className="card col-6">
          <div className="card-head">
            <h3 className="card-title"><Icon name="arrow_up" size={14} style={{color: "var(--pos)", marginRight: 6}}/>{isEn() ? 'Assets' : 'Aktiver'}</h3>
            <span style={{fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600}}>{fmtC(totalBigAssets)}</span>
          </div>
          {bigAssets.length === 0 ? (
            <div style={{color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center"}}>
              {isEn() ? 'No big assets added yet' : 'Ingen store aktiver tilføjet endnu'}
            </div>
          ) : bigAssets.map((e, i) => {
            const cat = assetCategories[e.category] || assetCategories.other_asset;
            const pct = totalBigAssets > 0 ? (e.amount / totalBigAssets * 100) : 0;
            return (
              <div key={e.id || i} className="line-row" style={{padding: "10px 0"}}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${cat.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon name={cat.icon} size={16} style={{color: cat.color}} />
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontWeight: 500, fontSize: 13}}>{e.name}</div>
                  <div style={{fontSize: 11, color: "var(--text-dim)"}}>{isEn() ? cat.en : cat.da}</div>
                </div>
                <div style={{textAlign: "right"}}>
                  <div style={{fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600}}>{fmtC(e.amount)}</div>
                  <div style={{fontSize: 10, color: "var(--text-dim)"}}>{pct.toFixed(0)}%</div>
                </div>
              </div>
            );
          })}
          {/* Mini donut */}
          {assetDonut.length > 1 && (
            <div style={{display: "flex", justifyContent: "center", paddingTop: 16, borderTop: "1px solid var(--border)", marginTop: 8}}>
              <Donut data={assetDonut.map(d => ({...d, value: totalBigAssets > 0 ? d.value / totalBigAssets * 100 : 0 }))} />
            </div>
          )}
        </div>

        {/* Loans list */}
        <div className="card col-6">
          <div className="card-head">
            <h3 className="card-title"><Icon name="arrow_down" size={14} style={{color: "var(--neg)", marginRight: 6}}/>{isEn() ? 'Loans' : 'Lån'}</h3>
            <span style={{fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--neg)"}}>{fmtC(totalLoans)}</span>
          </div>
          {allLoans.length === 0 ? (
            <div style={{color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center"}}>
              {isEn() ? 'No loans — debt free!' : 'Ingen lån — gældfri!'}
            </div>
          ) : allLoans.map((e, i) => {
            const cat = loanCategories[e.category] || loanCategories.other_liability;
            const pct = totalLoans > 0 ? (e.amount / totalLoans * 100) : 0;
            return (
              <div key={e.id || i} className="line-row" style={{padding: "10px 0"}}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${cat.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon name={cat.icon} size={16} style={{color: cat.color}} />
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontWeight: 500, fontSize: 13}}>{e.name}</div>
                  <div style={{fontSize: 11, color: "var(--text-dim)"}}>{isEn() ? cat.en : cat.da}</div>
                </div>
                <div style={{textAlign: "right"}}>
                  <div style={{fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "var(--neg)"}}>{fmtC(e.amount)}</div>
                  <div style={{fontSize: 10, color: "var(--text-dim)"}}>{pct.toFixed(0)}%</div>
                </div>
              </div>
            );
          })}
          {loanDonut.length > 1 && (
            <div style={{display: "flex", justifyContent: "center", paddingTop: 16, borderTop: "1px solid var(--border)", marginTop: 8}}>
              <Donut data={loanDonut.map(d => ({...d, value: totalLoans > 0 ? d.value / totalLoans * 100 : 0 }))} />
            </div>
          )}
        </div>
      </div>

      {/* Net position bar */}
      {(totalBigAssets > 0 || totalLoans > 0) && (
        <div className="card" style={{marginBottom: 24}}>
          <div className="card-head">
            <h3 className="card-title">{isEn() ? 'Assets vs Loans' : 'Aktiver vs Lån'}</h3>
            <span style={{fontFamily: "var(--font-mono)", fontSize: 12, color: netPosition >= 0 ? "var(--pos)" : "var(--neg)", fontWeight: 600}}>
              {isEn() ? 'Net' : 'Netto'}: {fmtC(netPosition)}
            </span>
          </div>
          <div style={{height: 32, borderRadius: 8, overflow: "hidden", display: "flex", background: "var(--bg-sunk)"}}>
            {(() => {
              const total = totalBigAssets + totalLoans;
              const assetW = total > 0 ? (totalBigAssets / total * 100) : 50;
              return <>
                <div style={{width: `${assetW}%`, background: "oklch(0.45 0.12 145 / 0.6)", transition: "width 0.3s", display: "flex", alignItems: "center", justifyContent: "center"}}>
                  <span style={{fontSize: 10, fontWeight: 600, color: "white"}}>{fmtC(totalBigAssets)}</span>
                </div>
                <div style={{flex: 1, background: "oklch(0.55 0.15 25 / 0.5)", display: "flex", alignItems: "center", justifyContent: "center"}}>
                  <span style={{fontSize: 10, fontWeight: 600, color: "white"}}>{fmtC(totalLoans)}</span>
                </div>
              </>;
            })()}
          </div>
          <div style={{display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)", marginTop: 4}}>
            <span>{isEn() ? 'Assets' : 'Aktiver'}</span>
            <span>{isEn() ? 'Loans' : 'Lån'}</span>
          </div>
        </div>
      )}

      {/* Mortgage amortization section — only shows if property + mortgage exist */}
      {propertyValue > 0 && mortgageBalance > 0 && (
        <>
          <div className="card" style={{marginBottom: 24}}>
            <div className="card-head">
              <h3 className="card-title"><Icon name="home" size={15} style={{marginRight: 6, opacity: 0.5}}/>{isEn() ? 'Mortgage amortization' : 'Realkreditlån afdrag'}</h3>
              <span style={{fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)"}}>
                {fmtC(homeEquity)} {isEn() ? 'equity' : 'friværdi'} ({(propertyValue > 0 ? (homeEquity / propertyValue * 100) : 0).toFixed(0)}%)
              </span>
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
                <label style={labelStyle}>{isEn() ? 'Monthly payment' : 'Månedlig ydelse'}</label>
                <input type="number" step="500" value={config.payment}
                  onChange={e => updateConfig('payment', e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{isEn() ? 'Remaining years' : 'Resterende år'}: <strong style={{color: "var(--text)"}}>{config.years}</strong></label>
                <input type="range" min="1" max="30" value={config.years}
                  onChange={e => updateConfig('years', e.target.value)}
                  style={{width: "100%", marginTop: 12, accentColor: "var(--accent)"}} />
                <div style={{display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)", marginTop: 2}}>
                  <span>1</span><span>30 {isEn() ? 'yrs' : 'år'}</span>
                </div>
              </div>
            </div>
            {projection && (
              <div style={{display: "flex", gap: 24, padding: "12px 0", borderTop: "1px solid var(--border)", fontSize: 13}}>
                <span style={{color: "var(--text-muted)"}}>{isEn() ? 'Monthly payment' : 'Ydelse'}: <strong style={{color: "var(--text)"}}>{fmtC(projection.monthlyPayment)}</strong></span>
                <span style={{color: "var(--text-muted)"}}>{isEn() ? 'Total interest' : 'Samlet rente'}: <strong style={{color: "var(--neg)"}}>{fmtC(projection.totalInterest)}</strong></span>
                <span style={{color: "var(--text-muted)", marginLeft: "auto"}}>{isEn() ? 'Debt free in' : 'Gældfri om'} <strong style={{color: "var(--pos)"}}>{config.years} {isEn() ? 'years' : 'år'}</strong></span>
              </div>
            )}
          </div>

          {projection && projection.points.length > 1 && (
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">{isEn() ? 'Equity growth over time' : 'Friværdivækst over tid'}</h3>
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
                  return <text key={pi} x={x} y={chartH - 8} textAnchor="middle" fontSize="9" fill="var(--text-dim)" fontFamily="var(--font-mono)">{isEn() ? `Yr ${p.year}` : `År ${p.year}`}</text>;
                })}
              </svg>
              <div style={{display: "flex", gap: 16, justifyContent: "center", paddingTop: 8, fontSize: 11}}>
                <span style={{display: "flex", alignItems: "center", gap: 4}}><span style={{width: 10, height: 10, borderRadius: 2, background: "oklch(0.45 0.12 145 / 0.3)"}} />{isEn() ? 'Equity' : 'Friværdi'}</span>
                <span style={{display: "flex", alignItems: "center", gap: 4}}><span style={{width: 10, height: 10, borderRadius: 2, background: "oklch(0.55 0.15 25 / 0.3)"}} />{isEn() ? 'Mortgage' : 'Lån'}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {totalBigAssets === 0 && totalLoans === 0 && (
        <div className="card" style={{textAlign: "center", padding: 40, background: "var(--bg-sunk)", borderStyle: "dashed"}}>
          <Icon name="home" size={36} style={{color: "var(--text-dim)", marginBottom: 10}} />
          <p style={{color: "var(--text-muted)", fontSize: 13, maxWidth: 400, margin: "0 auto", lineHeight: 1.5}}>
            {isEn()
              ? 'Add property, vehicles, and loans in Net Worth to see your full asset and liability picture here.'
              : 'Tilføj ejendom, køretøjer og lån under Formue for at se dit samlede aktiv- og gældsbillede her.'}
          </p>
        </div>
      )}
    </div>
  );
};

// ==========================================================================
// PORTFOLIO
// ==========================================================================
const PortfolioScreen = ({ state, refresh, openModal, privacyMode }) => {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [acctFilter, setAcctFilter] = useState("all");
  const [sortCol, setSortCol] = useState("value");
  const [sortDir, setSortDir] = useState("desc");
  const positions = state.positions || [];
  // Helper: position value in DKK (currency-converted)
  const posVal = (p) => toDKK((p.shares||0)*(p.currentPrice||0), p.currency);
  const totalValue = positions.reduce((s,p)=>s+posVal(p), 0);

  // Auto-generate account filter options from data
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

  // Sort helper
  const handleSort = (col) => {
    if (sortCol === col) { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); }
    else { setSortCol(col); setSortDir('desc'); }
  };
  const sortArrow = (col) => sortCol === col ? (sortDir === 'desc' ? ' ▾' : ' ▴') : '';

  const filtered = useMemo(() => {
    return positions
      .filter(h => {
        if (q && !h.ticker?.toLowerCase().includes(q.toLowerCase()) && !h.name?.toLowerCase().includes(q.toLowerCase())) return false;
        if (typeFilter !== "all" && h.type !== typeFilter) return false;
        if (acctFilter !== "all") {
          const [b, a] = acctFilter.split('|');
          if (h.broker !== b || h.accountType !== a) return false;
        }
        return true;
      })
      .sort((a,b) => {
        let va, vb;
        switch (sortCol) {
          case 'ticker': va = (a.ticker||'').toLowerCase(); vb = (b.ticker||'').toLowerCase(); return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
          case 'shares': va = a.shares||0; vb = b.shares||0; break;
          case 'price': va = toDKK(a.currentPrice||0, a.currency); vb = toDKK(b.currentPrice||0, b.currency); break;
          case 'change': {
            const ca = (a.avgPrice && a.avgPrice > 0 && a.currentPrice) ? ((a.currentPrice - a.avgPrice) / a.avgPrice * 100) : (a.priceChangePercent || 0);
            const cb = (b.avgPrice && b.avgPrice > 0 && b.currentPrice) ? ((b.currentPrice - b.avgPrice) / b.avgPrice * 100) : (b.priceChangePercent || 0);
            va = ca; vb = cb; break;
          }
          case 'weight': // same as value sort
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
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title"><em>{tl("portfolio.title")}</em> {isEn()?'holdings':''}</h1>
          <p className="page-subtitle">{tl("portfolio.subtitle")}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={()=>openModal('import')}>
            <Icon name="upload" size={15}/> {tl("portfolio.import")}
          </button>
          <button className="btn btn-accent" onClick={()=>openModal('position')}>
            <Icon name="plus" size={15}/> {tl("portfolio.addPosition")}
          </button>
        </div>
      </div>

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
            {state.overlapData?.aggregated?.sectors ? Object.entries(state.overlapData.aggregated.sectors).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—' : '—'}
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
              <input placeholder={isEn()?"Search ticker or name…":"Søg ticker eller navn…"} value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
          </div>
          {accountOptions.length > 1 && (
            <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
              <span style={{fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:600}}>{isEn()?'Account':'Konto'}:</span>
              <div className="segmented" style={{fontSize:12}}>
                <button className={acctFilter==="all"?"active":""} onClick={()=>setAcctFilter("all")}>{isEn()?'All':'Alle'}</button>
                {accountOptions.map(opt => {
                  const key = `${opt.broker||'other'}|${opt.accountType||'free'}`;
                  const label = `${brokerLabels[opt.broker]||opt.broker||'—'} · ${accountLabels[opt.accountType]||opt.accountType||'—'}`;
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
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('change')}>{isEn()?'Change':'Ændring'}{sortArrow('change')}</th>
                <th style={{width:60, textAlign:"center"}}>{isEn()?'5D':'5D'}</th>
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('value')}>{tl("portfolio.thValue")}{sortArrow('value')}</th>
                <th className="num" style={{cursor:"pointer", userSelect:"none"}} onClick={()=>handleSort('weight')}>{tl("portfolio.thWeight")}{sortArrow('weight')}</th>
                <th style={{width:60}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} style={{textAlign:"center", color:"var(--text-dim)", padding:40}}>{tl("portfolio.noHoldings")}</td></tr>
              ) : filtered.map((h, idx) => {
                const rawValue = (h.shares||0) * (h.currentPrice||0);
                const value = toDKK(rawValue, h.currency);
                const weight = totalValue > 0 ? (value / totalValue * 100) : 0;
                const broker = brokerLabels[h.broker]||h.broker||'—';
                const acct = accountLabels[h.accountType]||h.accountType||'—';
                return (
                  <tr key={h.id || idx}>
                    <td><div className="ticker-mark" style={{background:tickerColor(idx)}}>{(h.ticker||'??').slice(0,2)}</div></td>
                    <td>
                      <div className="ticker-meta">
                        <div className="sym">{h.ticker}</div>
                        <div className="name">{h.name || '—'}</div>
                      </div>
                    </td>
                    <td><span className="pill" style={{textTransform:"uppercase", fontSize:10, letterSpacing:"0.06em"}}>{h.type}</span></td>
                    <td style={{color:"var(--text-muted)", fontSize:12.5}}>{broker} · {acct}</td>
                    <td className="num">{h.shares}</td>
                    <td className="num">
                      {h.currency && h.currency !== (APP_STATE.currency || 'DKK') ? (
                        <>
                          <div style={{fontFamily:"var(--font-mono)", fontSize:12.5}}>{h.currency === 'USD' ? '$' : h.currency === 'EUR' ? '€' : h.currency === 'GBP' ? '£' : ''}{(h.currentPrice||0).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:2})}</div>
                          <div style={{fontSize:9, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginTop:1}}>{fmtC(toDKK(h.currentPrice||0, h.currency))}</div>
                        </>
                      ) : (
                        <div>{fmtC(h.currentPrice||0)}</div>
                      )}
                    </td>
                    <td className="num">
                      {(() => {
                        // Show daily change if available, otherwise total P&L from avg price
                        const daily = h.priceChangePercent;
                        const pnl = (h.avgPrice && h.avgPrice > 0 && h.currentPrice)
                          ? ((h.currentPrice - h.avgPrice) / h.avgPrice * 100) : null;
                        const val = daily != null ? daily : pnl;
                        const label = daily != null ? 'day' : (pnl != null ? 'total' : null);
                        if (val == null) return <span style={{color:"var(--text-dim)", fontSize:11}}>—</span>;
                        return (
                          <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:1}}>
                            <span style={{
                              color: val > 0 ? "var(--pos)" : val < 0 ? "var(--neg)" : "var(--text-muted)",
                              fontFamily:"var(--font-mono)", fontSize:12, fontWeight:500,
                              padding:"2px 6px", borderRadius:6,
                              background: val > 0 ? "oklch(0.45 0.12 145 / 0.12)" : val < 0 ? "oklch(0.55 0.15 25 / 0.12)" : "transparent",
                            }}>
                              {val > 0 ? "+" : ""}{val.toFixed(2)}%
                            </span>
                            {label && <span style={{fontSize:9, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.05em"}}>{label}</span>}
                          </div>
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
                        <button className="icon-btn" style={{width:26, height:26}} onClick={()=>openModal('position', h)}><Icon name="edit" size={12}/></button>
                        <button className="icon-btn" style={{width:26, height:26}} onClick={()=>deletePosition(h.id)}><Icon name="trash" size={12}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==========================================================================
// OVERLAP
// ==========================================================================
const OverlapScreen = ({ state, refresh, privacyMode }) => {
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(null);
  const sectorRef = useRef(null);
  const geoRef = useRef(null);

  const handleRunAnalysis = async () => {
    if ((state.positions||[]).length < 2) {
      alert(isEn() ? 'Need at least 2 positions.' : 'Du skal have mindst 2 positioner.');
      return;
    }
    setLoading(true);
    try {
      await runOverlapAnalysis();
      refresh();
    } catch(err) {
      alert(err.message);
    }
    setLoading(false);
  };

  const data = state.overlapData;
  const hasData = data && data.overlapMatrix;
  const tickers = hasData ? Object.keys(data.overlapMatrix) : [];

  // Get overlap value between two tickers
  const getOverlap = (t1, t2) => {
    if (!data?.overlapMatrix) return 0;
    return (data.overlapMatrix[t1]?.[t2]) || (data.overlapMatrix[t2]?.[t1]) || 0;
  };
  const getHeatLevel = (val) => val <= 0 ? 0 : val < 10 ? 1 : val < 25 ? 2 : val < 40 ? 3 : 4;

  return (
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title"><em>Overlap</em> {isEn()?'analysis':'analyse'}</h1>
          <p className="page-subtitle">{tl("overlap.subtitle")}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-accent" onClick={handleRunAnalysis} disabled={loading}>
            <Icon name="play" size={15}/> {loading ? (isEn()?'Analyzing…':'Analyserer…') : tl("overlap.runAnalysis")}
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="card" style={{textAlign:"center", padding:60}}>
          <Icon name="overlap" size={48} style={{color:"var(--text-dim)", marginBottom:16}}/>
          <h3 style={{margin:"0 0 8px"}}>{tl("overlap.emptyTitle")}</h3>
          <p style={{color:"var(--text-muted)"}}>{tl("overlap.emptyDesc")}</p>
        </div>
      ) : (
        <>
          <div className="card" style={{marginBottom:20}}>
            <div className="card-head">
              <div>
                <h3 className="card-title">{tl("overlap.matrix")}</h3>
                <div style={{fontSize:12, color:"var(--text-dim)", marginTop:4}}>
                  {isEn() ? "Percentage of shared underlying holdings between each pair" : "Procentdel af delte underliggende beholdninger mellem hvert par"}
                </div>
              </div>
              <div style={{display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--text-muted)"}}>
                <span>{isEn()?'Low':'Lav'}</span>
                <div style={{display:"flex", gap:2}}>
                  {[0,1,2,3,4].map(v => <div key={v} style={{width:16, height:16, borderRadius:3,
                    background: v===0?"var(--bg-sunk)":v===1?"oklch(0.95 0.04 55)":v===2?"oklch(0.88 0.09 55)":v===3?"oklch(0.78 0.14 50)":"oklch(0.64 0.17 48)"}}/>)}
                </div>
                <span>{isEn()?'High':'Høj'}</span>
              </div>
            </div>

            <div className="matrix-wrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th></th>
                    {tickers.map(t => <th key={t} style={{writingMode:"vertical-rl", transform:"rotate(180deg)", height:80}}>{t}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tickers.map((row, i) => (
                    <tr key={row}>
                      <th className="row-head">{row}</th>
                      {tickers.map((col, j) => {
                        if (i === j) return <td key={j} className="diag">—</td>;
                        const val = getOverlap(row, col);
                        const level = getHeatLevel(val);
                        const isHov = hovered && (hovered[0]===i || hovered[1]===j);
                        return (
                          <td key={j} data-v={level}
                            onMouseEnter={()=>setHovered([i,j])}
                            onMouseLeave={()=>setHovered(null)}
                            style={{opacity: hovered && !isHov ? 0.4 : 1, fontSize:10}}
                            title={`${row} × ${col}: ${val.toFixed(1)}%`}
                          >{val <= 0 ? "·" : val.toFixed(0)+"%"}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sector & Geo charts rendered via Chart.js in canvas elements */}
          <div className="grid grid-2">
            <div className="card">
              <h3 className="card-title" style={{marginBottom:16}}>{tl("overlap.sectorExposure")}</h3>
              <div style={{height:280}}><canvas id="chart-sectors" ref={el => {
                if (el && data) setTimeout(() => window.renderSectorChart && renderSectorChart(data), 100);
              }}></canvas></div>
            </div>
            <div className="card">
              <h3 className="card-title" style={{marginBottom:16}}>{tl("overlap.geoExposure")}</h3>
              <div style={{height:280}}><canvas id="chart-geo" ref={el => {
                if (el && data) setTimeout(() => window.renderGeoChart && renderGeoChart(data), 100);
              }}></canvas></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ==========================================================================
// SCORE
// ==========================================================================
const ScoreScreen = ({ state, refresh, privacyMode }) => {
  const [active, setActive] = useState(state.philosophy || "bogle");
  const scoreData = useMemo(() => {
    APP_STATE.philosophy = active;
    return window.computePortfolioScore ? computePortfolioScore() : null;
  }, [state.positions?.length, state.overlapData, active]);

  const philosophies = [
    { id:"bogle", name:"Bogle", tag:"Index", desc: isEn()?"Low cost, broad diversification":"Lav omkostning, bred diversificering" },
    { id:"buffett", name:"Buffett", tag:"Value", desc: isEn()?"Quality, deep moat, long-term":"Kvalitet, dyb voldgrav, langsigtet" },
    { id:"dalio", name:"Dalio", tag:"Macro", desc: isEn()?"All-weather, risk parity":"All-weather, risiko-paritet" },
    { id:"lynch", name:"Lynch", tag:"Growth", desc: isEn()?"Growth at a reasonable price":"Vækst til rimelig pris (GARP)" },
  ];

  return (
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title">{isEn() ? <>Portfolio <em>score</em></> : <>Portefølje-<em>score</em></>}</h1>
          <p className="page-subtitle">{tl("score.subtitle")}</p>
        </div>
      </div>

      <div style={{marginBottom:8}}>
        <div className="eyebrow" style={{marginBottom:10}}>{tl("score.choosePhilosophy")}</div>
        <div className="philosophies">
          {philosophies.map(ph => (
            <button key={ph.id} className={"philosophy " + (active===ph.id?"active":"")} onClick={()=>{setActive(ph.id); APP_STATE.philosophy=ph.id; window.savePreferences();}}>
              <div className="p-head">
                <div className="p-name">{ph.name}</div>
                <span className="p-tag">{ph.tag}</span>
              </div>
              <div className="p-desc">{ph.desc}</div>
              {scoreData && active===ph.id && (
                <div style={{marginTop:12, display:"flex", alignItems:"baseline", gap:6}}>
                  <span className="num" style={{fontFamily:"var(--font-mono)", fontSize:20, fontWeight:600}}>{scoreData.total}</span>
                  <span style={{fontSize:11, opacity:0.7}}>/100</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {!scoreData ? (
        <div className="card" style={{textAlign:"center", padding:60}}>
          <Icon name="activity" size={48} style={{color:"var(--text-dim)", marginBottom:16}}/>
          <h3 style={{margin:"0 0 8px"}}>{tl("score.emptyTitle")}</h3>
          <p style={{color:"var(--text-muted)"}}>{tl("score.emptyDesc")}</p>
        </div>
      ) : (
        <div className="grid grid-12" style={{marginTop:20}}>
          <div className="card col-5">
            <div className="card-head">
              <div>
                <div className="eyebrow">{isEn()?'Your score':'Din score'}</div>
                <h3 className="card-title" style={{fontSize:18, marginTop:4}}>{philosophies.find(p=>p.id===active)?.name} {isEn()?'philosophy':'filosofi'}</h3>
              </div>
            </div>
            <div className="gauge-wrap">
              <Gauge value={scoreData.total} max={100} size={280}/>
            </div>
            <div style={{marginTop:12, padding:14, background:"var(--bg-raised)", borderRadius:"var(--r-md)", fontSize:13, color:"var(--text-muted)", textAlign:"center"}}>
              <strong style={{color:"var(--text)"}}>{scoreData.label}.</strong> {philosophies.find(p=>p.id===active)?.desc}
            </div>
          </div>

          <div className="card col-7">
            <div className="card-head">
              <h3 className="card-title">{isEn()?'Score breakdown':'Score-opdeling'}</h3>
              <div style={{fontSize:11, color:"var(--text-dim)", fontFamily:"var(--font-mono)"}}>{Object.keys(scoreData.scores).length} {isEn()?'dimensions':'dimensioner'} · {isEn()?'weighted by philosophy':'vægtet efter filosofi'}</div>
            </div>
            <div style={{display:"grid", gap:18}}>
              {Object.values(scoreData.scores).map((r, i) => {
                const pct = r.score / r.max * 100;
                const tone = pct >= 70 ? "strong" : pct < 40 ? "weak" : "";
                return (
                  <div key={i} className="sbr-col">
                    <div className="sbr-head">
                      <div className="sbr-title">{r.label}</div>
                      <div className="sbr-val"><strong style={{color:"var(--text)", fontSize:14}}>{r.score}</strong> / {r.max}</div>
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
    </div>
  );
};

// ==========================================================================
// REBALANCE
// ==========================================================================
const RebalanceScreen = ({ state, refresh, privacyMode }) => {
  const [done, setDone] = useState({});
  const suggestions = useMemo(() => window.computeRebalanceSuggestions ? computeRebalanceSuggestions() : [], [state.positions?.length, state.overlapData]);
  const totalValue = (state.positions||[]).reduce((s,p)=>s+toDKK((p.shares||0)*(p.currentPrice||0), p.currency), 0);

  const typeIcons = { warning:"alert", tax:"tax", risk:"pie", overlap:"overlap" };

  return (
    <div className="screen active">
      <div className="page-head">
        <div>
          <h1 className="page-title"><em>{tl("rebalance.title")}</em></h1>
          <p className="page-subtitle">{tl("rebalance.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-12" style={{marginBottom:20}}>
        <div className="card col-4 stat">
          <div className="eyebrow">{isEn()?'Actions queued':'Handlinger i kø'}</div>
          <div className="value">{suggestions.length - Object.values(done).filter(Boolean).length}</div>
          <div className="sub">
            <span style={{color:"var(--neg)"}}>{suggestions.filter(s=>s.priority==="high").length} {isEn()?'high':'høj'}</span> ·
            <span style={{color:"var(--warn)"}}> {suggestions.filter(s=>s.priority==="medium").length} {isEn()?'medium':'mellem'}</span> ·
            <span style={{color:"var(--text-muted)"}}> {suggestions.filter(s=>s.priority==="low").length} {isEn()?'low':'lav'}</span>
          </div>
        </div>
        <div className="card col-4 stat">
          <div className="eyebrow">{isEn()?'Portfolio value':'Porteføljeværdi'}</div>
          <div className="value">{fmtC(totalValue)}</div>
        </div>
        <div className="card col-4 stat">
          <div className="eyebrow">{isEn()?'Total positions':'Samlede positioner'}</div>
          <div className="value">{(state.positions||[]).length}</div>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <div className="card" style={{textAlign:"center", padding:60}}>
          <Icon name="balance" size={48} style={{color:"var(--text-dim)", marginBottom:16}}/>
          <h3 style={{margin:"0 0 8px"}}>{tl("rebalance.emptyTitle")}</h3>
          <p style={{color:"var(--text-muted)"}}>{tl("rebalance.emptyDesc")}</p>
        </div>
      ) : (
        <div style={{display:"grid", gap:12}}>
          {suggestions.map((s, i) => (
            <div key={i} className={"insight " + (s.priority==="high"?"alert":s.priority==="medium"?"warn":"good")} style={{opacity: done[i]?0.5:1}}>
              <div className="insight-icon"><Icon name={typeIcons[s.type]||"info"} size={18}/></div>
              <div className="insight-body">
                <div className="insight-title">
                  {s.title}
                  <span className={"severity " + (s.priority==="high"?"high":s.priority==="medium"?"med":"low")}>{s.priority}</span>
                  <span style={{fontSize:11, color:"var(--text-dim)", marginLeft:"auto", fontFamily:"var(--font-mono)", fontWeight:400}}>#{String(i+1).padStart(2,"0")}</span>
                </div>
                <div className="insight-text">{s.detail}</div>
                <div style={{display:"flex", gap:8, marginTop:12}}>
                  <button className="btn btn-sm btn-ghost" onClick={()=>setDone({...done, [i]:!done[i]})}>
                    <Icon name="check" size={13}/> {done[i]?(isEn()?'Done':'Færdig'):(isEn()?'Mark done':'Markér færdig')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================================================
// HUGINN — Portfolio Chatbot
// ==========================================================================
const HuginnScreen = ({ state, refresh, privacyMode }) => {
  // Persist chat in APP_STATE so it survives screen navigation
  if (!APP_STATE._huginnMessages) APP_STATE._huginnMessages = [];
  if (APP_STATE._huginnSessionStarted === undefined) APP_STATE._huginnSessionStarted = false;
  const [messages, _setMessages] = useState(APP_STATE._huginnMessages);
  const setMessages = (updater) => {
    _setMessages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      APP_STATE._huginnMessages = next;
      return next;
    });
  };
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

    // Overlap data: underlying holdings in ETFs/funds, sector & geo breakdown
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

    // Pension data — per-member
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

    // Individual net worth entries (assets & liabilities detail)
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
      // Per-member summaries
      const allMembers = [{id:'me', name: isEn()?'Primary user':'Primær bruger'}, ...hhMembers];
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
    if (!APP_STATE._huginnSessionStarted && messages.length === 0) {
      APP_STATE._huginnSessionStarted = true;
      const initMsg = [{ role: 'user', content: 'Give me a quick overview of my portfolio — what stands out, what tensions do you see, and what should I be thinking about?' }];
      sendToHuginn(initMsg);
    }
  }, []);

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
    setMessages([]);
    APP_STATE._huginnSessionStarted = false;
    setTimeout(() => {
      APP_STATE._huginnSessionStarted = true;
      const initMsg = [{ role: 'user', content: 'Give me a quick overview of my portfolio — what stands out, what tensions do you see, and what should I be thinking about?' }];
      sendToHuginn(initMsg);
    }, 100);
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

  return (
    <div className="screen active" style={{display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", maxHeight: "calc(100vh - 80px)"}}>
      {/* Header */}
      <div className="page-head" style={{flexShrink: 0}}>
        <div>
          <h1 className="page-title" style={{display: "flex", alignItems: "center", gap: 10}}>
            <RavenIcon size={32} style={{color: "var(--accent)", opacity: 0.8}}/>
            <span><em>Huginn</em></span>
          </h1>
          <p className="page-subtitle">{isEn() ? "Odin's raven sees your portfolio" : "Odins ravn ser din portefølje"}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={clearChat} style={{fontSize: 12}}>
            <Icon name="refresh" size={13}/> {isEn() ? 'New session' : 'Ny session'}
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
                : 'Huginn flyver ud hver dag, observerer din portefølje gennem legendariske investorers øjne og vender tilbage med hvad den så.'}
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
            placeholder={isEn() ? "Ask Huginn about your portfolio…" : "Spørg Huginn om din portefølje…"}
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
          {isEn() ? 'Framework commentary, not financial advice. Huginn sees through legendary lenses.' : 'Ramme-kommentar, ikke finansiel rådgivning. Huginn ser gennem legendariske linser.'}
        </div>
      </div>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes huginnPulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
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
            <option value="EUR">EUR (€)</option>
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
                   : 'Tilføj din partner og op til 2 børn. Hvert medlem får sin egen portefølje, formue og pension — og du kan se det hele samlet som husstand.'}
        </p>

        {/* Primary user (always shown) */}
        <div style={{display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid var(--border)"}}>
          <Icon name="user" size={16}/>
          <span style={{flex:1, fontWeight:500}}>{isEn() ? 'Me (primary)' : 'Mig (primær)'}</span>
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
              <Icon name="plus" size={13}/> {isEn() ? 'Add partner' : 'Tilføj partner'}
            </button>
          )}
          {household.filter(m => m.relation === 'child').length < 2 && (
            <button className="btn" onClick={() => {
              const name = prompt(isEn() ? 'Child name:' : 'Barnets navn:');
              if (name && name.trim()) {
                const dob = prompt(isEn() ? 'Date of birth (optional, YYYY-MM-DD):' : 'Fødselsdato (valgfri, ÅÅÅÅ-MM-DD):');
                setHousehold([...household, { id: crypto.randomUUID(), name: name.trim(), relation: 'child', dob: dob || '' }]);
              }
            }}>
              <Icon name="plus" size={13}/> {isEn() ? 'Add child' : 'Tilføj barn'}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{marginTop:20, borderColor:"oklch(0.55 0.15 25 / 0.3)"}}>
        <h3 className="card-title" style={{color:"var(--neg)"}}>{isEn() ? 'Danger zone' : 'Farezone'}</h3>
        <p style={{color:"var(--text-muted)", fontSize:13, margin:"8px 0 14px"}}>{isEn() ? 'This will permanently delete all your data — entries, positions, preferences, and projections.' : 'Dette sletter permanent alle dine data — poster, positioner, præferencer og fremskrivninger.'}</p>
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
        <div className="form-group"><label>{tl("modal.entryName")}</label><input value={name} onChange={e=>setName(e.target.value)} required placeholder={isEn()?"e.g. Budget account, Savings…":"f.eks. Budgetkonto, Opsparing…"}/></div>
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
              <option value="vehicle">{isEn()?'Vehicle':'Køretøj'}</option>
              <option value="other_asset">{isEn()?'Other asset':'Andet aktiv'}</option>
            </>) : (<>
              <option value="mortgage">{isEn()?'Mortgage':'Realkreditlån'}</option>
              <option value="student_loan">{isEn()?'Student loan':'Studielån'}</option>
              <option value="car_loan">{isEn()?'Car loan':'Billån'}</option>
              <option value="credit_card">{isEn()?'Credit card':'Kreditkort'}</option>
              <option value="other_liability">{isEn()?'Other loan':'Anden gæld'}</option>
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
          <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder={isEn()?"e.g. Lunar, Nordea…":"f.eks. Lunar, Nordea…"}/>
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
            <option value="DKK">DKK (kr.)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="SEK">SEK</option><option value="NOK">NOK</option><option value="GBP">GBP (£)</option>
          </select>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          <div className="form-group"><label>{isEn()?`Avg. buy price (${currency})`:`Gns. købspris (${currency})`}</label><input type="number" value={avgPrice} onChange={e=>setAvgPrice(e.target.value)} min="0" step="any"/></div>
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
    setStatus(isEn() ? `Preparing ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} for AI scan…` : `Forbereder ${imageFiles.length} billede${imageFiles.length > 1 ? 'r' : ''} til AI-scanning…`);
    try {
      const allBlocks = [];
      for (const file of imageFiles) {
        const blocks = await window.prepareFileForScan(file);
        allBlocks.push(...blocks);
      }
      setStatus(isEn() ? 'Analyzing with AI…' : 'Analyserer med AI…');
      return allBlocks;
    } catch (err) {
      setStatus("❌ " + err.message);
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
      setStatus(isEn()?'Reading JSON…':'Læser JSON…');
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
          setStatus(`✓ ${imported} ${isEn()?'positions imported':'positioner importeret'}`);
          setTimeout(() => { ref.current?.close(); onClose(); setStatus(""); }, 1500);
        } catch(err) { setStatus("❌ " + err.message); }
      };
      reader.readAsText(file);
    } else {
      // AI scan for PDF/images
      setStatus(isEn()?'Preparing for AI scan…':'Forbereder AI-scanning…');
      try {
        const imageBlocks = await window.prepareFileForScan(file);
        await scanWithAI(imageBlocks);
      } catch(err) {
        console.error('Import error:', err);
        setStatus("❌ " + err.message);
      }
    }
  };

  const scanWithAI = async (imageBlocks) => {
    try {
      setStatus(isEn()?'Analyzing with AI…':'Analyserer med AI…');
      const resp = await fetch('/api/scan', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001', max_tokens: 8192,
            messages: [{ role:'user', content: [...imageBlocks, { type:'text', text: `Analyze this financial document (likely a broker/bank portfolio screenshot from Nordnet, Saxo Bank, Aktiesparekonto, or similar Scandinavian broker).

CRITICAL RULES for extracting positions:

SHARES — YOU MUST CALCULATE THIS:
- "shares" = the NUMBER OF UNITS/SHARES owned. Look for "Quantity", "Antal", "Units", "Andele" column.
- If there is NO shares/quantity column but there IS a "Value" (Værdi, Markedsværdi) AND a per-unit price (NAV, Kurs), YOU MUST CALCULATE: shares = Value / NAV. For example: Value=7,016 kr and NAV=270.10 DKK → shares = 7016 / 270.10 = 25.975.
- NEVER set shares to 0 if you can calculate it. A position with 0 shares is useless.

PRICES:
- "currentPrice" = the CURRENT/LATEST price PER SINGLE SHARE. Use "Last", "Kurs", "Seneste", "NAV" column. If NOT shown, set to 0.
- "avgPrice" = the average purchase price per share. Use "Open price", "Avg price", "GAK", "Gns. kurs", "Købskurs" column. If NOT shown, set to 0.
- IMPORTANT: "Open price" in Saxo Bank means the AVERAGE PURCHASE PRICE, not the current price. Put it in "avgPrice", NOT "currentPrice".

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
- "type" should be "etf" for ETFs, "fund" for mutual funds/index funds, "stock" for individual stocks
- If the document shows ISINs, you MUST look up and return the correct Yahoo Finance ticker instead

Return ONLY valid JSON (no markdown, no code fences, no explanation). Use this exact schema:
{"entries":[],"positions":[{"ticker":"MSFT","name":"Microsoft Corp.","type":"stock","shares":17,"currentPrice":0,"avgPrice":390.43,"currency":"USD"}]}` }] }]
          })
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('Scan API error:', resp.status, errText);
          setStatus(`❌ API error ${resp.status}: ${errText.slice(0,100)}`);
          return;
        }
        const data = await resp.json();
        console.log('AI scan response:', JSON.stringify(data).slice(0,500));
        if (data.error) {
          setStatus(`❌ ${data.error}`);
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
            };
            if (parsed.positions) parsed.positions.forEach(p => {
              // Skip positions with no ticker and no name
              if (!p.ticker && !p.name) return;
              let ticker = (p.ticker || p.name || 'UNKNOWN').toUpperCase();
              ticker = TICKER_FIX[ticker] || ticker;
              APP_STATE.positions.push({
                ...p, id: crypto.randomUUID(), broker, accountType,
                ticker,
                avgPrice: p.avgPrice || 0,
                currency: p.currency || 'DKK',
                owner: owner === 'me' ? undefined : owner,
              });
              imported++;
            });
            window.saveData();
            if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
            refresh();
            setStatus(`✓ ${imported} ${isEn()?'positions imported. Fetching live prices…':'positioner importeret. Henter live kurser…'}`);
            // Auto-fetch live prices after import
            try {
              const priceResult = await fetchLivePrices();
              if (window.syncPortfolioToNetWorth) syncPortfolioToNetWorth();
              refresh();
              const failMsg = priceResult.failed?.length ? ` (${priceResult.failed.join(', ')} ${isEn()?'not found':'ikke fundet'})` : '';
              setStatus(`✓ ${imported} ${isEn()?'positions imported':'positioner importeret'}, ${priceResult.updated||0} ${isEn()?'prices updated':'kurser opdateret'}${failMsg}`);
            } catch(e) {
              console.error('Auto price fetch failed:', e);
              setStatus(`✓ ${imported} ${isEn()?'positions imported (price fetch failed)':'positioner importeret (kurshentning fejlede)'}`);
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
      setStatus("❌ " + err.message);
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
          <label>{isEn() ? 'Or paste / drop screenshots' : 'Eller indsæt / træk skærmbilleder'}</label>
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
                <div style={{fontSize: 28, marginBottom: 6, opacity: 0.5}}>📋</div>
                <div>{isEn() ? 'Press Ctrl+V / ⌘V to paste a screenshot' : 'Tryk Ctrl+V / ⌘V for at indsætte et skærmbillede'}</div>
                <div style={{fontSize: 11, marginTop: 4, opacity: 0.7}}>{isEn() ? 'or drag & drop images here' : 'eller træk og slip billeder her'}</div>
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
                    >×</button>
                  </div>
                ))}
                <div
                  style={{
                    height: 72, width: 72, borderRadius: 6,
                    border: '2px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                  title={isEn() ? 'Paste or drop more' : 'Indsæt eller træk flere'}
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
      const savedData = localStorage.getItem('pi-data');
      const savedPrefs = localStorage.getItem('pi-prefs');
      if (savedData || savedPrefs) {
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
  const [activeMember, setActiveMember] = useState("me"); // "me" | member.id | "household"
  const setHousehold = (members) => { setHouseholdState(members); saveHousehold(members); };

  // Modal state
  const [modal, setModal] = useState(null); // { type: 'entry'|'position'|'import', data?: any }

  const openModal = (type, data) => setModal({ type, data });
  const closeModal = () => setModal(null);

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
    // Load preferences
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
    const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

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

    // Refresh on load if prices are stale (> 5 min old)
    const lastUpdate = APP_STATE.lastPriceUpdate;
    if (!lastUpdate || (Date.now() - new Date(lastUpdate).getTime()) > AUTO_REFRESH_MS) {
      setTimeout(doAutoRefresh, 2000); // slight delay to let UI settle
    }

    // Then refresh every 5 minutes
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

  if (!authed) return <AuthScreen onLogin={handleLogin}/>;

  // Create filtered state based on active member
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

  const currentNav = NAV.find(n => n.id === route) || NAV[0];
  const positions = filteredState.positions || [];
  const scoreData = window.computePortfolioScore ? computePortfolioScore() : null;
  const suggestions = window.computeRebalanceSuggestions ? computeRebalanceSuggestions() : [];

  const navBadges = {
    portfolio: positions.length > 0 ? String(positions.length) : null,
    score: scoreData ? String(scoreData.total) : null,
    rebalance: suggestions.length > 0 ? String(suggestions.length) : null,
  };

  const Screen = {
    overview: Overview,
    networth: NetWorthScreen,
    pension: PensionScreen,
    mortgage: MortgageScreen,
    portfolio: PortfolioScreen,
    overlap: OverlapScreen,
    score: ScoreScreen,
    rebalance: RebalanceScreen,
    huginn: HuginnScreen,
    settings: SettingsScreen,
  }[route] || Overview;

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
            <a key={n.id} href="#" className={route===n.id?"active":""} onClick={e=>{e.preventDefault(); setRoute(n.id);}}>
              <Icon name={n.icon} size={15}/>
              <span>{tl(n.i18n)}</span>
              {navBadges[n.id] && <span className="badge">{navBadges[n.id]}</span>}
            </a>
          ))}

          <div className="nav-section" style={{marginTop:8}}>{isEn()?'Shortcuts':'Genveje'}</div>
          <a href="#" onClick={e=>{e.preventDefault(); openModal('position');}}><Icon name="plus" size={15}/><span>{tl("portfolio.addPosition")}</span></a>
          <a href="#" onClick={e=>{e.preventDefault(); openModal('import');}}><Icon name="upload" size={15}/><span>{tl("portfolio.import")}</span></a>
        </nav>

        <div className="side-footer">
          <a href="#" className={route==="settings"?"active":""} onClick={e=>{e.preventDefault(); setRoute("settings");}}>
            <Icon name="settings" size={15}/><span>{tl("nav.settings")}</span>
          </a>
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
            <strong>{tl(currentNav?.i18n || "nav.overview")}</strong>
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
          <Screen key={safeActiveMember + '-' + route} state={route === 'huginn' ? state : filteredState} refresh={refresh} openModal={openModal} theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} household={household} setHousehold={setHousehold} activeMember={activeMember} privacyMode={privacyMode}/>
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
