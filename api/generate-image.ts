import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
            console.warn(
              "Hugging Face returned JSON instead of image:",
              errorData
            );
            throw new Error("Model is still loading or busy.");
          }

          const buffer = await hfResponse.arrayBuffer();
          const base64 = Buffer.from(new Uint8Array(buffer)).toString("base64");
          const cleanMimeType = (contentType || "image/webp")
            .split(";")[0]
            .trim();

          return res.status(200).json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: cleanMimeType,
                        data: base64,
                      },
                    },
                  ],
                },
              },
            ],
          });
        } else {
          const errorText = await hfResponse.text();
          console.error(
            "Hugging Face API error:",
            hfResponse.status,
            errorText
          );
        }
      } catch (hfErr: any) {
        console.error("Hugging Face Error:", hfErr.message);
      }
    }

    // 2. Fallback to Gemini
    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          const hasImage = data.candidates?.[0]?.content?.parts?.some(
            (p: any) => p.inlineData
          );
          if (hasImage) return res.status(200).json(data);
          console.warn(
            "Gemini returned no image:",
            JSON.stringify(data).substring(0, 200)
          );
        } else {
          console.error(
            "Gemini API error:",
            response.status,
            JSON.stringify(data).substring(0, 200)
          );
        }
        console.warn(
          "Gemini failed or returned no image, trying Pollinations..."
        );
      } catch (geminiErr: any) {
        console.error("Gemini Error:", geminiErr.message);
      }
    }

    // 3. Final Fallback: Pollinations.ai
    try {
      console.log("Using Pollinations fallback...");
      const fallbackUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;

      const pollinationsResponse = await fetch(fallbackUrl);
      if (!pollinationsResponse.ok) {
        throw new Error(`Pollinations returned ${pollinationsResponse.status}`);
      }

      const buffer = await pollinationsResponse.arrayBuffer();
      const base64 = Buffer.from(new Uint8Array(buffer)).toString("base64");
      const contentType =
        pollinationsResponse.headers.get("content-type") || "image/png";

      return res.status(200).json({
        imageBase64: base64,
        mimeType: contentType.split(";")[0].trim(),
      });
    } catch (finalErr: any) {
      console.error("All image generation methods failed:", finalErr.message);
      return res.status(500).json({
        error: "All image generation methods failed. Please try again later.",
      });
    }
  } catch (error: any) {
    console.error("Image generation error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
