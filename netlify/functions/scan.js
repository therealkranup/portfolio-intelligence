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
    const body = JSON.parse(event.body);
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
                  image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
                };
              }
              return block;
            })
          : msg.content,
      })),
    };

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
      body: JSON.stringify(openRouterBody),
    });
    clearTimeout(timeout);

    const data = await response.json();

    if (data.choices && data.choices[0]) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          content: [{ type: "text", text: data.choices[0].message.content }],
          model: data.model,
          usage: data.usage,
        }),
      };
    } else if (data.error) {
      return { statusCode: data.error.code || 500, headers, body: JSON.stringify({ error: data.error.message }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    if (err.name === "AbortError") {
      return { statusCode: 504, headers, body: JSON.stringify({ error: "Request timed out — try a smaller document" }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
