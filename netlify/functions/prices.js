const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA = "Mozilla/5.0 (compatible; PortfolioIntelligence/1.0)";

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

    const closes = result?.indicators?.quote?.[0]?.close || [];
    const history = closes.filter(c => c != null).map(c => Math.round(c * 100) / 100);

    return {
      price: meta.regularMarketPrice,
      previousClose: prevClose || null,
      currency: meta.currency,
      name: meta.longName || meta.shortName || symbol,
      changePercent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
      history,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow || null,
    };
  } catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    const { tickers } = JSON.parse(event.body || "{}");
    if (!tickers || !tickers.length) return { statusCode: 200, headers, body: "{}" };

    const results = {};
    const promises = tickers.map(async (ticker) => {
      const mapped = TICKER_MAP[ticker.toUpperCase()] || ticker;
      let data = await fetchPrice(mapped);
      if (data) { results[ticker] = data; return; }

      data = await fetchPrice(`${ticker}.CO`);
      if (data) { results[ticker] = { ...data, yahooSymbol: `${ticker}.CO` }; return; }

      data = await fetchPrice(`${ticker}.ST`);
      if (data) { results[ticker] = { ...data, yahooSymbol: `${ticker}.ST` }; return; }
    });

    await Promise.all(promises);
    return { statusCode: 200, headers, body: JSON.stringify(results) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
