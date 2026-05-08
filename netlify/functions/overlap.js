const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }) };

  try {
    const { positions, staticFundHints } = JSON.parse(event.body);
    if (!positions || positions.length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Need at least 2 positions for overlap analysis" }) };
    }

    const positionList = positions.map(p => `${p.ticker} (${p.name}, type: ${p.type})`).join("\n");
    const hintsBlock = staticFundHints ? `\n\nPRE-VERIFIED FUND DATA (use this data directly, do NOT guess):\n${staticFundHints}\n` : "";
    const prompt = `You are a financial analyst. Analyze the overlap between these portfolio positions:

${positionList}${hintsBlock}

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
    const timeout = setTimeout(() => controller.abort(), 25000);

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
        return { statusCode: 200, headers, body: jsonMatch[0] };
      }
      return { statusCode: 500, headers, body: JSON.stringify({ error: "AI returned non-JSON response" }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: data.error?.message || "Unknown error" }) };
  } catch (err) {
    if (err.name === "AbortError") return { statusCode: 504, headers, body: JSON.stringify({ error: "Analysis timed out" }) };
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
