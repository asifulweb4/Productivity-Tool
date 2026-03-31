import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.get("/api/debug-env", (req, res) => {
    res.json({
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      HUGGINGFACE_API_KEY: !!process.env.HUGGINGFACE_API_KEY,
      API_KEY: !!process.env.API_KEY,
      NODE_ENV: process.env.NODE_ENV
    });
  });

  app.post("/api/chat", async (req, res) => {
    const { messages, model = "google/gemini-2.0-flash-001" } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OpenRouter API Key is not configured." });

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "OpenRouter API error");
      res.json(data);
    } catch (error: any) {
      console.error("Chat Proxy Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tts", async (req, res) => {
    const { text } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Gemini API Key is not configured." });

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Say this in Bengali: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          }
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Gemini TTS API error");
      res.json(data);
    } catch (error: any) {
      console.error("TTS Proxy Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ✅ FULLY FIXED Image Generation
  app.post("/api/generate-image", async (req, res) => {
    const { prompt } = req.body;
    const hfKey = process.env.HUGGINGFACE_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    // Helper: try a HuggingFace model, return base64 or null
    const tryHuggingFace = async (modelId: string): Promise<{ base64: string; mimeType: string } | null> => {
      try {
        console.log(`Trying HuggingFace: ${modelId}`);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 40000);

        const r = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${hfKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!r.ok) { console.warn(`${modelId} HTTP ${r.status}`); return null; }

        const contentType = r.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await r.json();
          console.warn(`${modelId} returned JSON:`, JSON.stringify(json).slice(0, 120));
          return null;
        }

        const buffer = await r.arrayBuffer();
        if (buffer.byteLength < 1000) { console.warn(`${modelId} buffer too small`); return null; }

        const base64 = Buffer.from(new Uint8Array(buffer)).toString("base64");
        const mimeType = contentType.split(";")[0].trim() || "image/jpeg";
        console.log(`✅ ${modelId} success! (${buffer.byteLength} bytes)`);
        return { base64, mimeType };
      } catch (e: any) {
        console.error(`${modelId} error:`, e.message);
        return null;
      }
    };

    // Helper: fetch any URL as base64
    const fetchUrlAsBase64 = async (url: string, timeoutMs = 55000): Promise<{ base64: string; mimeType: string } | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        console.log("Fetching URL:", url.slice(0, 80));
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!r.ok) return null;
        const contentType = r.headers.get("content-type") || "image/png";
        if (contentType.includes("text/html")) { console.warn("Got HTML instead of image"); return null; }
        const buffer = await r.arrayBuffer();
        if (buffer.byteLength < 1000) { console.warn("Buffer too small:", buffer.byteLength); return null; }
        const base64 = Buffer.from(new Uint8Array(buffer)).toString("base64");
        const mimeType = contentType.split(";")[0].trim();
        console.log(`✅ URL fetch success! (${buffer.byteLength} bytes)`);
        return { base64, mimeType };
      } catch (e: any) {
        clearTimeout(timer);
        console.error("URL fetch error:", e.message);
        return null;
      }
    };

    // ── Step 1: HuggingFace (multiple models) ──
    if (hfKey) {
      const models = [
        "black-forest-labs/FLUX.1-schnell",
        "stabilityai/stable-diffusion-xl-base-1.0",
        "runwayml/stable-diffusion-v1-5",
        "stabilityai/stable-diffusion-2-1",
      ];
      for (const model of models) {
        const result = await tryHuggingFace(model);
        if (result) return res.json({ imageBase64: result.base64, mimeType: result.mimeType });
      }
    }

    // ── Step 2: Gemini ──
    if (geminiKey) {
      try {
        console.log("Trying Gemini image generation...");
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
            }),
          }
        );
        const data = await response.json();
        if (response.ok && data.candidates?.[0]?.content?.parts) {
          for (const part of data.candidates[0].content.parts) {
            if (part.inlineData?.data && part.inlineData.data.length > 100) {
              console.log("✅ Gemini image success!");
              return res.json({ imageBase64: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" });
            }
          }
        }
        console.warn("Gemini returned no image. Response:", JSON.stringify(data).slice(0, 200));
      } catch (err: any) {
        console.error("Gemini error:", err.message);
      }
    }

    // ── Step 3: Pollinations — server-side fetch, return base64 ──
    try {
      console.log("Trying Pollinations (server-side)...");
      const seed = Math.floor(Math.random() * 1000000);
      const urls = [
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`,
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${seed}&model=turbo`,
      ];
      for (const url of urls) {
        const result = await fetchUrlAsBase64(url, 55000);
        if (result) return res.json({ imageBase64: result.base64, mimeType: result.mimeType });
      }
    } catch (err: any) {
      console.error("Pollinations error:", err.message);
    }

    console.error("❌ All image generation methods failed");
    res.status(500).json({ error: "ইমেজ তৈরি করতে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
  });

  // Vite middleware
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();