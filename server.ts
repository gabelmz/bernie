import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize Gemini API
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (error) {
  console.warn("Failed to initialize Gemini API", error);
}

// API Routes
app.post("/api/ai/execute", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API key not configured." });
  }
  try {
    const { prompt, inputData } = req.body;
    
    const finalPrompt = `
      Instructions: ${prompt}
      
      Input Data:
      ${typeof inputData === 'object' ? JSON.stringify(inputData, null, 2) : inputData}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: finalPrompt,
    });

    res.json({ result: response.text });
  } catch (error) {
    console.error("AI execution error:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

app.post("/api/ai/suggest", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API key not configured." });
  }
  try {
    const { nodes, edges } = req.body;
    
    const prompt = `
      You are an AI assistant in a visual node-based workflow builder (similar to Google Labs Stitch).
      The user has built the following workflow graph:
      Nodes: ${JSON.stringify(nodes, null, 2)}
      Edges: ${JSON.stringify(edges, null, 2)}
      
      Suggest 1-3 specific areas for automation or improvement. Provide the result as a JSON object:
      {
        "suggestions": [
          { "title": "...", "description": "..." }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error) {
    console.error("AI suggestion error:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

app.post("/api/ai/parse-request", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API key not configured." });
  }
  try {
    const { snippet } = req.body;
    
    const prompt = `
      You are an AI assistant that parses HTTP request snippets (cURL, JavaScript fetch, Python requests, OpenAPI spec, etc.).
      Extract the HTTP method, URL, headers, and body from the following snippet.
      
      Snippet:
      ${snippet}
      
      Return a JSON object with the following schema:
      {
        "method": "GET | POST | PUT | DELETE | PATCH | etc",
        "url": "https://...",
        "headers": { "Key": "Value" },
        "body": "stringified body or null"
      }
      Do not include any markdown formatting or extra text, just return the JSON object.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error) {
    console.error("AI parse error:", error);
    res.status(500).json({ error: "Failed to parse snippet" });
  }
});

// Proxy HTTP requests for HTTP nodes to bypass CORS
app.post("/api/proxy", async (req, res) => {
  try {
    const { url, method, headers, body } = req.body;
    const isGetOrHead = method === 'GET' || method === 'HEAD' || !method;
    
    let parsedBody = undefined;
    if (!isGetOrHead && body) {
      parsedBody = typeof body === 'string' ? body : JSON.stringify(body);
    }
    
    const response = await fetch(url, {
      method: method || "GET",
      headers: headers || {},
      body: parsedBody,
    });
    const text = await response.text();
    let data = text;
    try { data = JSON.parse(text); } catch(e) {}
    res.json({ status: response.status, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
