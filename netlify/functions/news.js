const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA = "Mozilla/5.0 (compatible; PortfolioIntelligence/1.0)";

async function fetchTickerNews(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d&includePrePost=false`;
    const resp = await fetch(url, { headers: { "User-Agent": UA } });
    if (!resp.ok) return [];
    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    const { tickers } = JSON.parse(event.body || "{}");
    if (!tickers || !tickers.length) return { statusCode: 200, headers, body: JSON.stringify({ news: [] }) };

    const topTickers = tickers.slice(0, 10);
    const results = await Promise.all(topTickers.map(fetchTickerNews));
    const flat = results.flat().filter(n => n.price);
    return { statusCode: 200, headers, body: JSON.stringify({ news: flat }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
