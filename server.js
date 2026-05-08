require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();

app.use(express.json({ limit: "20mb" }));
app.use(express.static(__dirname));

// Proxy to OpenRouter for document scanning (Claude via OpenRouter)
app.post("/api/scan", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });

  try {
    // Convert Anthropic message format to OpenAI-compatible format for OpenRouter
    const body = req.body;
    const openRouterBody = {
      model: body.model || "anthropic/claude-sonnet-4",
      max_tokens: body.max_tokens || 4096,
      messages: (body.messages || []).map(msg => ({
        role: msg.role,
        content: Array.isArray(msg.content)
          ? msg.content.map(block => {
              if (block.type === "text") return { type: "text", text: block.text };
              if (block.type === "image" && block.source) {
                return {
                  type: "image_url",
                  image_url: {
                    url: `data:${block.source.media_type};base64,${block.source.data}`,
                  },
                };
              }
              return block;
            })
          : msg.content,
      })),
    };

    // 75-second server-side timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://portfolio-intelligence.app",
        "X-Title": "Portfolio Intelligence",
      },
      body: JSON.stringify(openRouterBody),
    });
    clearTimeout(timeout);

    const data = await response.json();

    // Convert OpenRouter response back to Anthropic-style for the frontend
    if (data.choices && data.choices[0]) {
      res.json({
        content: [{ type: "text", text: data.choices[0].message.content }],
        model: data.model,
        usage: data.usage,
      });
    } else if (data.error) {
      res.status(data.error.code || 500).json({ error: data.error.message });
    } else {
      res.json(data);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: "Request timed out — try a smaller document" });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── FX Rates (to DKK) via Yahoo Finance ──
app.get("/api/fx", async (req, res) => {
  const UA = "Mozilla/5.0 (compatible; PortfolioIntelligence/1.0)";
  const pairs = [
    { from: "USD", symbol: "USDDKK=X" },
    { from: "EUR", symbol: "EURDKK=X" },
    { from: "SEK", symbol: "SEKDKK=X" },
    { from: "NOK", symbol: "NOKDKK=X" },
    { from: "GBP", symbol: "GBPDKK=X" },
  ];
  const rates = { DKK: 1 };
  await Promise.all(pairs.map(async ({ from, symbol }) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      const d = await r.json();
      const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price) rates[from] = price;
    } catch(e) {
      console.warn(`FX fetch failed for ${from}:`, e.message);
    }
  }));
  res.json(rates);
});

// ── Live Price Fetching (Yahoo Finance v8 chart API, no key needed) ──
app.post("/api/prices", async (req, res) => {
  const { tickers } = req.body; // array of ticker strings
  if (!tickers || !tickers.length) return res.json({});

  const UA = "Mozilla/5.0 (compatible; PortfolioIntelligence/1.0)";

  // Normalize tickers that differ between brokers and Yahoo Finance
  const TICKER_MAP = {
    "BRK.B": "BRK-B", "BRK.A": "BRK-A", "BRKB": "BRK-B",
    "NOVOB": "NOVO-B.CO", "NOVOB.CO": "NOVO-B.CO", "NOVO-B": "NOVO-B.CO",
    "VWS": "VWS.CO", "ORSTED": "ORSTED.CO", "NAS": "NAS.OL",
  };

  async function fetchPrice(symbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
      const resp = await fetch(url, { headers: { "User-Agent": UA } });
      if (!resp.ok) return null;
      const data = await resp.json();
      const result = data?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta || !meta.regularMarketPrice) return null;

      const prevClose = meta.chartPreviousClose || meta.previousClose;
      const changePercent = prevClose
        ? ((meta.regularMarketPrice - prevClose) / prevClose * 100)
        : null;

      // Extract historical closes for sparkline (up to 5 days)
      const closes = result?.indicators?.quote?.[0]?.close || [];
      const history = closes.filter(c => c != null).map(c => Math.round(c * 100) / 100);

      return {
        price: meta.regularMarketPrice,
        previousClose: prevClose || null,
        currency: meta.currency,
        name: meta.longName || meta.shortName || symbol,
        changePercent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
        history, // array of up to 5 daily closes
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
      };
    } catch { return null; }
  }

  try {
    const results = {};

    // Fetch all tickers in parallel
    const promises = tickers.map(async (ticker) => {
      // Try normalized ticker first, then bare ticker
      const mapped = TICKER_MAP[ticker.toUpperCase()] || ticker;
      let data = await fetchPrice(mapped);
      if (data) { results[ticker] = data; return; }

      // Try .CO (Copenhagen) suffix for Danish stocks
      data = await fetchPrice(`${ticker}.CO`);
      if (data) { results[ticker] = { ...data, yahooSymbol: `${ticker}.CO` }; return; }

      // Try .ST (Stockholm) suffix for Nordic stocks
      data = await fetchPrice(`${ticker}.ST`);
      if (data) { results[ticker] = { ...data, yahooSymbol: `${ticker}.ST` }; return; }
    });

    await Promise.all(promises);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI-Powered Overlap Analysis (OpenRouter) ──
app.post("/api/overlap", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });

  const { positions } = req.body; // array of { ticker, name, type }
  if (!positions || positions.length < 2) {
    return res.status(400).json({ error: "Need at least 2 positions for overlap analysis" });
  }

  try {
    const positionList = positions.map(p => `${p.ticker} (${p.name}, type: ${p.type})`).join("\n");
    const prompt = `You are a financial analyst. Analyze the overlap between these portfolio positions:

${positionList}

For each ETF or fund, identify:
1. Top 10 underlying holdings with approximate weight percentages
2. Geographic exposure breakdown (% by country/region)
3. Sector breakdown (% by GICS sector)

Then compute an overlap matrix showing the percentage overlap between each pair of ETFs/funds based on shared underlying holdings.

For individual stocks, list them as 100% in their own sector and country.

Return ONLY valid JSON (no markdown):
{
  "holdings": {
    "TICKER": {
      "topHoldings": [{ "name": "Company", "ticker": "SYM", "weight": 5.2 }],
      "geography": { "US": 60, "Europe": 20, "Asia": 15, "Other": 5 },
      "sectors": { "Technology": 30, "Healthcare": 15, "Financials": 20, "Consumer": 10, "Industrials": 10, "Energy": 5, "Other": 10 }
    }
  },
  "overlapMatrix": {
    "TICKER1": { "TICKER2": 15.5 }
  },
  "aggregated": {
    "geography": { "US": 55, "Europe": 25, "Asia": 15, "Other": 5 },
    "sectors": { "Technology": 28, "Healthcare": 12, "Financials": 18, "Consumer": 12, "Industrials": 10, "Energy": 8, "Other": 12 }
  }
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://portfolio-intelligence.app",
        "X-Title": "Portfolio Intelligence",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    clearTimeout(timeout);

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      const text = data.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        res.json(JSON.parse(jsonMatch[0]));
      } else {
        res.status(500).json({ error: "AI returned non-JSON response" });
      }
    } else {
      res.status(500).json({ error: data.error?.message || "Unknown error" });
    }
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: "Analysis timed out" });
    res.status(500).json({ error: err.message });
  }
});

// ── Market News Endpoint (Yahoo Finance RSS) ──
app.post("/api/news", async (req, res) => {
  const { tickers } = req.body;
  if (!tickers || !tickers.length) return res.json({ news: [] });

  const UA = "Mozilla/5.0 (compatible; PortfolioIntelligence/1.0)";

  async function fetchTickerNews(ticker) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`;
      const resp = await fetch(url, { headers: { "User-Agent": UA } });
      if (!resp.ok) return [];
      const data = await resp.json();
      const meta = data?.chart?.result?.[0]?.meta;
      // Get basic market data as context
      if (!meta) return [];
      return [{
        ticker,
        name: meta.longName || meta.shortName || ticker,
        price: meta.regularMarketPrice,
        previousClose: meta.chartPreviousClose || meta.previousClose,
        change: meta.regularMarketPrice && meta.chartPreviousClose
          ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100).toFixed(2)
          : null,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      }];
    } catch { return []; }
  }

  try {
    // Fetch market data for top tickers (limit to 10 for speed)
    const topTickers = tickers.slice(0, 10);
    const results = await Promise.all(topTickers.map(fetchTickerNews));
    const flat = results.flat().filter(n => n.price);
    res.json({ news: flat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Huginn Chat Endpoint (TradingAgents-inspired multi-perspective analysis) ──
app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });

  try {
    const { messages, portfolioContext, marketContext } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array required" });
    }

    const systemPrompt = `You are Huginn -- Odin's raven of thought. You are a multi-perspective portfolio analyst embedded in a Danish net-worth and portfolio app called Portfolio Intelligence.

═══════════════════════════════════════════════════════════
ANALYSIS FRAMEWORK (TradingAgents-inspired)
═══════════════════════════════════════════════════════════

When asked about a specific stock, sector, or portfolio decision, you operate as a TEAM of analysts internally. You synthesize their views into one cohesive response. Do NOT output the individual agent headers -- just weave their perspectives naturally.

Your internal team:
1. FUNDAMENTALS ANALYST — Evaluates company financials, earnings, revenue growth, PE ratios, margins, moat strength. References the user's actual positions and cost basis.
2. SENTIMENT ANALYST — Gauges market mood from recent trends, retail vs institutional flows, options activity, social media buzz. Notes if a stock is crowded or contrarian.
3. TECHNICAL ANALYST — Identifies where the stock sits relative to 52-week range, key support/resistance, RSI, moving averages, trend direction.
4. BULLISH RESEARCHER — Makes the strongest case FOR the position. What's the upside catalyst? Why should the user hold or add?
5. BEARISH RESEARCHER — Makes the strongest case AGAINST. What are the risks? What could go wrong? What's the downside scenario?
6. RISK MANAGER — Evaluates position sizing, portfolio concentration, correlation risk, max drawdown scenarios. Considers the user's overall net worth (including property, pension, cash) when sizing risk.

After synthesizing these views, deliver a clear VERDICT with conviction level (High / Medium / Low confidence).

For general questions (net worth, pension, mortgage), use relevant perspectives from the team but don't force all six views.

═══════════════════════════════════════════════════════════
CORE RULES
═══════════════════════════════════════════════════════════

Every response must be PERSONALIZED using the user's actual data below. Generic financial advice is a failure.

DANISH FINANCIAL CONTEXT (CRITICAL):
The user is based in Denmark. Always factor this in:
- MORTGAGE: Realkreditlån offer cheap rates (1-4%). LTV of 60-64% is healthy (max 80%). Don't suggest "paying down mortgage" when rates are low.
- TAX: ASK has 17% tax on gains (vs 27-42% free depot). Capital gains: 27% up to ~61,000 DKK, 42% above. Pension contributions are tax-deductible.
- PENSION: 3 pillars: folkepension, arbejdsmarkedspension (12-17%), private savings.
- CURRENCY: Base is DKK (pegged to EUR). USD exposure = FX risk.
- ACCOUNTS: ASK cap ~135,300 DKK. Saxo and Nordnet are the main Danish brokers.

VOICE:
- Direct, specific, like a sharp Danish private banker running a trading desk.
- Structure opinions with conviction: "I'd hold", "I'd trim", "This is overweight", not "you might consider".
- When giving a verdict, use a clear signal: 🟢 BUY/ADD, 🟡 HOLD, 🔴 TRIM/SELL, with reasoning.
- Reference SPECIFIC numbers from their portfolio: tickers, amounts, weights, accounts.
- NO generic advice. NO disclaimers. NO "consider consulting an advisor".

PERSONALIZATION:
- Net worth discussions: reference their specific property, mortgage, savings accounts by name and balance.
- Pension: use their specific numbers and project forward.
- Portfolio: reference specific tickers, P&L, weight, account type (ASK vs free depot), and Danish tax implications.
- Stocks: calculate total exposure (direct + ETF overlap), then give the multi-perspective analysis.

EXPOSURE ANALYSIS:
When asked about a stock:
1. Direct holdings across all accounts
2. Indirect holdings through ETFs/funds
3. Combined total as % of portfolio and % of net worth
4. Multi-perspective analysis (bull/bear/risk)
5. Clear verdict with position sizing recommendation

WHAT NOT TO DO:
- No generic bullets that could apply to anyone
- No "I cannot predict" -- give opinions with stated confidence
- No "consult a financial advisor"
- No padding with obvious statements

${marketContext ? `\nLIVE MARKET DATA:\n${marketContext}\n` : ''}
THE USER'S PORTFOLIO CONTEXT:
${portfolioContext || 'No portfolio data available yet.'}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://portfolio-intelligence.app",
        "X-Title": "Portfolio Intelligence - Huginn",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });
    clearTimeout(timeout);

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      res.json({ reply: data.choices[0].message.content });
    } else {
      res.status(500).json({ error: data.error?.message || "Huginn is silent." });
    }
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: "Huginn timed out." });
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Portfolio Intelligence running on http://localhost:${PORT}`));
