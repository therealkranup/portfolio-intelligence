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

// Proxy to Financial Modeling Prep for ETF holdings
app.get("/api/holdings/:ticker", async (req, res) => {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "FMP_API_KEY not configured" });

  try {
    const { ticker } = req.params;
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/etf-holder/${ticker}?apikey=${apiKey}`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy to FMP for stock fundamentals
app.get("/api/fundamentals/:ticker", async (req, res) => {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "FMP_API_KEY not configured" });

  try {
    const { ticker } = req.params;
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${apiKey}`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Portfolio Intelligence running on http://localhost:${PORT}`));
