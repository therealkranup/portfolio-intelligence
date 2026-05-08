const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const UA = "Mozilla/5.0 (compatible; PortfolioIntelligence/1.0)";

exports.handler = async () => {
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
    } catch (e) {
      console.warn(`FX fetch failed for ${from}:`, e.message);
    }
  }));

  return { statusCode: 200, headers, body: JSON.stringify(rates) };
};
