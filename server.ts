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
  const PORT = 3001;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Diagnostic Route
  app.get("/api/debug-env", (req, res) => {
    res.json({
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      API_KEY: !!process.env.API_KEY,
      NODE_ENV: process.env.NODE_ENV
    });
  });

  // API Routes
  app.post("/api/chat", async (req, res) => {
    const { messages, model = "google/gemini-2.0-flash-001" } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error("Missing OPENROUTER_API_KEY in environment");
      return res.status(500).json({ error: "OpenRouter API Key is not configured in the backend. Please add OPENROUTER_API_KEY to your environment variables." });
    }

    try {
      // Convert Gemini parts format to OpenAI messages format if needed
      // For now, assuming standard OpenAI messages format from frontend
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "OpenRouter API error");
      }

      res.json(data);
    } catch (error: any) {
      console.error("Chat Proxy Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tts", async (req, res) => {
    const { text } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      console.error("Missing Gemini API Key in environment");
      return res.status(500).json({ error: "Gemini API Key is not configured in the backend. Please add GEMINI_API_KEY to your environment variables." });
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Say this in Bengali: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          }
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Gemini TTS API error");
      }

      res.json(data);
    } catch (error: any) {
      console.error("TTS Proxy Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const hfKey = process.env.HUGGINGFACE_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      console.log(`Generating image for prompt: "${prompt.substring(0, 50)}..."`);

      // 1. Try Hugging Face First
      if (hfKey) {
        try {
          console.log("Attempting Hugging Face (FLUX.1-schnell)...");
          const hfResponse = await fetch(
            "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
            {
              headers: {
                Authorization: `Bearer ${hfKey}`,
                "Content-Type": "application/json",
              },
              method: "POST",
              body: JSON.stringify({ inputs: prompt }),
            }
          );

          if (hfResponse.ok) {
            const contentType = hfResponse.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const errorData = await hfResponse.json();
              console.warn("Hugging Face returned JSON instead of image:", errorData);
              throw new Error("Model is still loading or busy.");
            }

            const buffer = await hfResponse.arrayBuffer();
            const base64 = Buffer.from(new Uint8Array(buffer)).toString("base64");

            // Clean content type (remove charset etc)
            const cleanMimeType = (contentType || "image/webp").split(';')[0].trim();

            return res.json({
              candidates: [{
                content: {
                  parts: [{
                    inlineData: {
                      mimeType: cleanMimeType,
                      data: base64
                    }
                  }]
                }
              }]
            });
          } else {
            const errorText = await hfResponse.text();
            console.error("Hugging Face API error:", hfResponse.status, errorText);
          }
        } catch (hfErr: any) {
          console.error("Hugging Face Error:", hfErr.message);
        }
      }

      // 2. Fallback to Gemini
      if (geminiKey) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          });

          const data = await response.json();

          if (response.ok) {
            const hasImage = data.candidates?.[0]?.content?.parts?.some((p: any) => p.inlineData);
            if (hasImage) return res.json(data);
            console.warn("Gemini returned no image:", JSON.stringify(data).substring(0, 200));
          } else {
            console.error("Gemini API error:", response.status, JSON.stringify(data).substring(0, 200));
          }
          console.warn("Gemini failed or returned no image, trying Pollinations...");
        } catch (geminiErr: any) {
          console.error("Gemini Error:", geminiErr.message);
        }
      }

      // 3. Final Fallback: Pollinations.ai (Fetch and convert to base64)
      try {
        console.log("Using Pollinations fallback...");
        const fallbackUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;

        const pollinationsResponse = await fetch(fallbackUrl);
        if (!pollinationsResponse.ok) {
          throw new Error(`Pollinations returned ${pollinationsResponse.status}`);
        }

        const buffer = await pollinationsResponse.arrayBuffer();
        const base64 = Buffer.from(new Uint8Array(buffer)).toString("base64");
        const contentType = pollinationsResponse.headers.get("content-type") || "image/png";

        return res.json({
          imageBase64: base64,
          mimeType: contentType.split(';')[0].trim()
        });
      } catch (finalErr: any) {
        console.error("All image generation methods failed:", finalErr.message);
        res.status(500).json({ error: "All image generation methods failed. Please try again later." });
      }
    } catch (error: any) {
      console.error("Image generation error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Allowed domains for image proxying (SSRF protection)
  const ALLOWED_IMAGE_DOMAINS = [
    'pollinations.ai',
    'image.pollinations.ai',
  ];

  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("URL is required");
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return res.status(400).send("Invalid URL format");
    }

    // Check allowed domains
    const isAllowedDomain = ALLOWED_IMAGE_DOMAINS.some(domain =>
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );
    if (!isAllowedDomain) {
      return res.status(403).send("Domain not allowed");
    }

    // Block private/internal IP addresses (SSRF protection)
    const hostname = parsedUrl.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    ) {
      return res.status(403).send("Internal addresses not allowed");
    }

    let lastError = "";

    const tryFetch = async (url: string, attempt: number = 1): Promise<Response | null> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // Increased to 60s timeout per attempt

      try {
        console.log(`Attempt ${attempt} for: ${url}`);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) return response;

        console.error(`Attempt ${attempt} failed: ${response.status} ${response.statusText}`);
        lastError = `${response.status} ${response.statusText}`;
        return null;
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.error(`Attempt ${attempt} error:`, err.message);
        lastError = err.message;
        return null;
      }
    };

    try {
      let response = await tryFetch(imageUrl);

      // Fallback 1: Retry same URL after a short delay if it failed with 500
      if (!response) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        response = await tryFetch(imageUrl, 2);
      }

      // Fallback 2: Try without model=flux if it was present
      if (!response && imageUrl.includes("model=flux")) {
        const fallbackUrl = imageUrl.replace("&model=flux", "&model=turbo");
        console.log("Switching to turbo model...");
        response = await tryFetch(fallbackUrl, 3);
      }

      // Fallback 3: Try the most basic endpoint
      if (!response) {
        const basicUrl = imageUrl.split('?')[0] + "?width=1024&height=1024&nologo=true";
        console.log("Trying basic endpoint...");
        response = await tryFetch(basicUrl, 4);
      }

      if (!response) {
        throw new Error(`All attempts failed. Last error: ${lastError}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader("Content-Type", response.headers.get("Content-Type") || "image/png");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(buffer);
    } catch (error: any) {
      console.error("Final Proxy error:", error.message);
      res.status(500).send(`Error fetching image: ${error.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Skip API routes for Vite middleware
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      vite.middlewares(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Error Handler:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
