/* global React */
const { useState, useEffect, useMemo } = React;

const Icon = ({ name, size = 16, ...props }) => {
  const paths = {
    home: <><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z"/></>,
    dollar: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    overlap: <><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    balance: <><path d="M12 3v18M5 7h14M5 7l-3 7h6l-3-7zM19 7l-3 7h6l-3-7z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    play: <><polygon points="5 3 19 12 5 21 5 3"/></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
    arrow_up: <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
    arrow_down: <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    chevron: <><polyline points="9 18 15 12 9 6"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    tax: <><path d="M3 3h18v4H3zM3 21h18v-4H3zM3 11h18v2H3z"/></>,
    pie: <><path d="M21 12A9 9 0 1 1 12 3"/><path d="M21 12L12 12 12 3"/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
    sliders: <><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>,
    globe: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    refresh: <><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></>,
    message: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    baby: <><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name]}
    </svg>
  );
};

const Sparkline = ({ data, width = 80, height = 26, color, fill }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 3) - 1.5]);
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const areaPath = path + ` L${width},${height} L0,${height} Z`;
  const trend = data[data.length - 1] - data[0];
  const stroke = color || (trend >= 0 ? "var(--pos)" : "var(--neg)");
  const fillC = fill || (trend >= 0 ? "var(--pos-soft)" : "var(--neg-soft)");
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={areaPath} fill={fillC} opacity="0.8"/>
      <path d={path} stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
};

const Gauge = ({ value = 53, max = 100, size = 260 }) => {
  const r = size / 2 - 18;
  const cx = size / 2, cy = size / 2;
  const startA = -Math.PI, endA = 0;
  const pct = value / max;
  const ang = startA + (endA - startA) * pct;
  const arcEnd = [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  const largeArc = pct > 0.5 ? 1 : 0;
  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd[0]} ${arcEnd[1]}`;
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const a = startA + (endA - startA) * (i / 10);
    const r1 = r - 4, r2 = r + 4;
    ticks.push(
      <line key={i}
        x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
        x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
        stroke="var(--border-strong)" strokeWidth="1"/>
    );
  }
  const label = value < 40 ? (window.APP_STATE?.lang === 'en' ? "Needs work" : "Kan forbedres") : value < 60 ? (window.APP_STATE?.lang === 'en' ? "Fair" : "Rimelig") : value < 80 ? (window.APP_STATE?.lang === 'en' ? "Good" : "God") : (window.APP_STATE?.lang === 'en' ? "Excellent" : "Fremragende");
  return (
    <svg width={size} height={size / 1.55} viewBox={`0 0 ${size} ${size / 1.55}`}>
      <path d={bgPath} stroke="var(--bg-sunk)" strokeWidth="14" fill="none" strokeLinecap="round"/>
      <path d={fgPath} stroke="var(--accent)" strokeWidth="14" fill="none" strokeLinecap="round"/>
      {ticks}
      <text x={cx} y={cy - 10} textAnchor="middle" fontFamily="var(--font-display)" fontSize="54" fill="var(--text)" letterSpacing="-0.02em">{value}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="11" fill="var(--text-muted)" letterSpacing="0.06em" style={{textTransform:'uppercase', letterSpacing: '0.1em'}}>{label}</text>
    </svg>
  );
};

const Donut = ({ data, size = 200, thickness = 22 }) => {
  const r = size / 2 - thickness / 2 - 2;
  const cx = size / 2, cy = size / 2;
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const C = 2 * Math.PI * r;
  const segs = data.map((d, i) => {
    const pct = d.value / total;
    const len = pct * C;
    const offset = -acc * C;
    acc += pct;
    return (
      <circle key={i} cx={cx} cy={cy} r={r}
        fill="none"
        stroke={d.color}
        strokeWidth={thickness}
        strokeDasharray={`${len} ${C}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-sunk)" strokeWidth={thickness}/>
      {segs}
      <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="var(--font-display)" fontSize="32" fill="var(--text)" letterSpacing="-0.02em">{data.length}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="10" fill="var(--text-muted)" letterSpacing="0.1em" style={{textTransform:'uppercase'}}>{window.APP_STATE?.lang === 'en' ? 'Categories' : 'Kategorier'}</text>
    </svg>
  );
};

const AreaChart = ({ data, width = 700, height = 220, showAxis = true }) => {
  const max = Math.max(...data.map(d => d.value));
  const min = Math.min(...data.map(d => d.value));
  const range = max - min || 1;
  const pad = showAxis ? { l: 50, r: 12, t: 20, b: 24 } : { l: 8, r: 8, t: 8, b: 8 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const step = w / (data.length - 1);
  const pts = data.map((d, i) => [pad.l + i * step, pad.t + h - ((d.value - min) / range) * h]);
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = line + ` L${pad.l + w},${pad.t + h} L${pad.l},${pad.t + h} Z`;
  const fmtAxis = (val) => {
    const fn = window.formatCurrency;
    if (fn) return fn(val);
    return "$" + Math.round(val / 1000) + "k";
  };
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="ar-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {showAxis && [0, 0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={pad.l} x2={pad.l + w}
          y1={pad.t + h * f} y2={pad.t + h * f}
          stroke="var(--border)" strokeDasharray={f === 1 ? "" : "2 4"}/>
      ))}
      {showAxis && [0, 0.25, 0.5, 0.75, 1].map(f => (
        <text key={f} x={pad.l - 8} y={pad.t + h * f + 4} textAnchor="end" fontSize="10" fill="var(--text-dim)" fontFamily="var(--font-mono)">
          {fmtAxis(max - range * f)}
        </text>
      ))}
      <path d={area} fill="url(#ar-grad)"/>
      <path d={line} stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((d, i) => (i % Math.max(1, Math.floor(data.length / 8)) === 0) && (
        <text key={i} x={pts[i][0]} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--text-dim)" fontFamily="var(--font-mono)">{d.label}</text>
      ))}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="var(--accent)" stroke="var(--bg-panel)" strokeWidth="2"/>
    </svg>
  );
};

Object.assign(window, { Icon, Sparkline, Gauge, Donut, AreaChart });
