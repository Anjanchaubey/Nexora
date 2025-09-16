const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: "https://myndra.netlify.app/" })); // replace with your site
app.use(express.json());

// ✅ Whitelist the models you allow
const ALLOWED_MODELS = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-image-preview"
];

// Load your key from environment variable
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ No GEMINI_API_KEY set in environment variables!");
  process.exit(1);
}

// Proxy endpoint
app.post("/chat", async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    const selectedModel = ALLOWED_MODELS.includes(model) ? model : "gemini-2.5-flash";

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40
      }
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      return res
        .status(response.status)
        .json({ error: errorData || "Gemini API error" });
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "[No text response from Gemini]";

    res.json({ text, model: selectedModel });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Gemini proxy running on port ${PORT}`));
