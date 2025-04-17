const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// --- Configuration ---
// ✅ Use environment variables for API keys in production!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCsozQIqSqLSNY4_H3EC_x1rRGHRAxZ7EQ'; // Replace with your actual key or use env var
const SERP_API_KEY = process.env.SERP_API_KEY || '9ae725906eac0c3de0289c9326c00915bb6087eeedfba14d0b38f9e10fe0a6cbE';       // Replace with your actual key or use env var

const PORT = process.env.PORT || 3000; // Use Render's PORT environment variable
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`; // Use 1.5 flash and SSE alt


// --- CORS Setup ---
// Allow CORS from the specific frontend URL (Netlify) and potentially localhost for dev
const allowedOrigins = [
    'https://myndra.netlify.app',
    'http://localhost:8080', // Add if you run locally with vite/similar
    'http://127.0.0.1:5500/',
    'file:///D:/merger/index.html' // Add if you run locally with Live Server
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
   credentials: true // If you need cookies or authorization headers
};

app.use(cors(corsOptions)); // Use the specific CORS options
app.use(express.json()); // Middleware to parse JSON bodies

// --- Original Non-Streaming Chat Endpoint (Optional - can be removed) ---
app.post('/api/chat', async (req, res) => {
    const userPrompt = req.body.prompt;
    console.log("POST /api/chat | User:", userPrompt);

    try {
        // Using 1.5 flash model which is generally good and fast
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await axios.post(
            geminiEndpoint,
            { contents: [{ parts: [{ text: userPrompt }] }] }
        );

        // Handle potential variations in response structure
        const candidates = geminiResponse.data?.candidates;
        if (!candidates || candidates.length === 0 || !candidates[0].content?.parts || candidates[0].content.parts.length === 0) {
            console.error('Unexpected Gemini response structure:', geminiResponse.data);
            throw new Error('Received an unexpected response structure from the AI.');
        }

        const reply = candidates[0].content.parts[0].text;
        console.log("POST /api/chat | Gemini:", reply.substring(0, 100) + '...'); // Log snippet
        res.json({ reply });

    } catch (error) {
        console.error('Gemini API Error (/api/chat):', error.message);
        if (error.response) {
            console.error('Error Data:', error.response.data);
            console.error('Error Status:', error.response.status);
        }
        res.status(error.response?.status || 500).json({
            reply: `Oops! AI service error: ${error.response?.data?.error?.message || error.message}`
        });
    }
});


// --- NEW Streaming Chat Endpoint ---
app.post('/api/chat-stream', async (req, res) => {
    const userPrompt = req.body.prompt;
    console.log("POST /api/chat-stream | User:", userPrompt);

    if (!userPrompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Send headers immediately

    let buffer = ''; // Buffer for potential partial chunks

    try {
        // Make POST request to Gemini's stream endpoint
        const geminiStreamResponse = await axios.post(
            GEMINI_STREAM_URL,
            { contents: [{ parts: [{ text: userPrompt }] }] },
            { responseType: 'stream' } // Crucial: Get response as a stream
        );

        const stream = geminiStreamResponse.data;

        // Handle data chunks from the stream
        stream.on('data', (chunk) => {
            buffer += chunk.toString(); // Append chunk to buffer

            // Process lines in the buffer
            let boundary = buffer.indexOf('\n');
            while (boundary !== -1) {
                const line = buffer.substring(0, boundary).trim();
                buffer = buffer.substring(boundary + 1); // Remove processed line from buffer

                if (line.startsWith('data: ')) {
                    try {
                        const jsonData = line.substring(6); // Remove 'data: ' prefix
                        const parsedData = JSON.parse(jsonData);

                        // Extract text content - structure depends on the model version
                         const textChunk = parsedData?.candidates?.[0]?.content?.parts?.[0]?.text;

                        if (textChunk) {
                            // Send the text chunk to the client, formatted as SSE
                            res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
                             console.log("Stream chunk:", textChunk.substring(0, 50) + '...'); // Log chunk snippet
                        }
                    } catch (parseError) {
                        console.error('Error parsing Gemini stream chunk:', parseError, 'Chunk:', line);
                        // Decide if you want to send an error to the client here
                         // res.write(`data: ${JSON.stringify({ error: "Error processing stream chunk." })}\n\n`);
                    }
                }
                 boundary = buffer.indexOf('\n'); // Check for next line boundary
            }
        });

        // Handle stream end
        stream.on('end', () => {
            console.log('Gemini stream ended.');
            // Signal end to the client
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end(); // Close the connection
        });

        // Handle stream error
        stream.on('error', (error) => {
            console.error('Error in Gemini stream:', error);
             // Try sending an error message before closing
            try {
                 res.write(`data: ${JSON.stringify({ error: `Stream error: ${error.message}` })}\n\n`);
            } catch (writeError) {
                 console.error("Failed to write stream error to client:", writeError);
            }
            res.end(); // Ensure connection closes on stream error
        });

    } catch (error) {
        console.error('Error setting up Gemini stream connection:', error.message);
         if (error.response) { // Error from the initial axios POST request itself
             console.error('Axios Error Data:', error.response.data);
             console.error('Axios Error Status:', error.response.status);
              // Don't try to write to res here as headers might not have been flushed
               // or the response might already be ended/invalid
         } else {
             console.error('Non-axios Error:', error);
         }
          // If headers are already sent, we can only end the response.
          // If not, we could send a proper status code, but it's tricky.
           res.end(); // Just close the connection
    }

    // Handle client closing the connection prematurely
    req.on('close', () => {
        console.log('Client disconnected from stream.');
        // Clean up resources if needed (e.g., abort Gemini request if possible, though harder with simple stream handling)
        // Often, just letting the stream handlers finish or error out is simplest.
        res.end(); // Ensure response is ended if client closes
    });
});

// --- Web Search Endpoint (Unchanged) ---
app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    console.log("POST /api/search | Query:", query);
    if (!query) {
        return res.status(400).json({ reply: "Search query cannot be empty." });
    }
     if (!SERP_API_KEY || SERP_API_KEY === 'YOUR_SERPAPI_KEY_HERE') {
        console.error("SERP API Key not configured!");
        return res.status(500).json({ reply: "Search service is not configured on the server." });
    }

    try {
        const serpResponse = await axios.get(`https://serpapi.com/search.json`, {
            params: {
                q: query,
                api_key: SERP_API_KEY
            }
        });

        const results = serpResponse.data?.organic_results || [];
        const answerBox = serpResponse.data?.answer_box;
        let summary = '';

         // Prefer answer box if available
        if (answerBox) {
             summary = answerBox.answer || answerBox.snippet || "Found an answer box, but couldn't extract summary.";
             if(answerBox.link) summary += `\nSource: ${answerBox.link}`;
        } else if (results.length > 0) {
             summary = results.slice(0, 3) // Take top 3 organic results
                 .map(r => `**${r.title}**\n${r.snippet || ''}\n[${r.link}](${r.link})`)
                 .join('\n\n---\n\n'); // Add separators for clarity
        } else {
             summary = "No relevant results found for that query.";
        }


        console.log("POST /api/search | Results Sent:", summary.substring(0, 100) + '...');
        res.json({ reply: summary });

    } catch (error) {
        console.error("Search error:", error.message);
        if (error.response) {
             console.error('Search Error Data:', error.response.data);
             console.error('Search Error Status:', error.response.status);
        }
        res.status(error.response?.status || 500).json({
            reply: `Couldn't fetch search results: ${error.message}`
        });
    }
});

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => { // Listen on 0.0.0.0 for Render
    console.log(`Server running on port ${PORT}`);
    // console.log(`Frontend expected at: https://myndra.netlify.app`); // Informational
});
