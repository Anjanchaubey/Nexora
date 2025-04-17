const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Allow CORS from the specific frontend URL (Netlify)
const allowedOrigins = ['https://myndra.netlify.app'];

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions)); // Use the specific CORS options here
app.use(express.json());

// ✅ Use your actual Gemini API key here
const GEMINI_API_KEY = 'AIzaSyCsozQIqSqLSNY4_H3EC_x1rRGHRAxZ7EQ';

app.post('/api/chat', async (req, res) => {
    const userPrompt = req.body.prompt;
    console.log("User said:", userPrompt);

    try {
        const geminiResponse = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
            {
                contents: [{ parts: [{ text: userPrompt }] }]
            }
        );

        console.log("Gemini replied with:", geminiResponse.data.candidates[0].content.parts[0].text);

        const reply = geminiResponse.data.candidates[0].content.parts[0].text;
        res.json({ reply });
    } catch (error) {
        console.error('Gemini API Error:', error.message);
        console.error('Full error:', error.response?.data || error);
        res.status(500).json({ reply: "Oops! Something went wrong." });
    }
});

app.listen(3000, () => console.log('Server running on https://myndra-backend-qv8y.onrender.com'));

// Web search route using SerpAPI
const SERP_API_KEY = '9ae725906eac0c3de0289c9326c00915bb6087eeedfba14d0b38f9e10fe0a6cb'; // ← Replace this

app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  try {
    const serpResponse = await axios.get(`https://serpapi.com/search.json`, {
      params: {
        q: query,
        api_key: SERP_API_KEY
      }
    });

    const results = serpResponse.data.organic_results?.slice(0, 3) || [];
    const summary = results.map(r => `• ${r.title}\n${r.link}`).join('\n\n') || "No results found.";
    res.json({ reply: summary });

  } catch (error) {
    console.error("Search error:", error.message);
    res.status(500).json({ reply: "Couldn't fetch search results." });
  }
});
