import type { VercelRequest, VercelResponse } from "@vercel/node";

// Allowed domains for image proxying (SSRF protection)
const ALLOWED_IMAGE_DOMAINS = ["pollinations.ai", "image.pollinations.ai"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
  const isAllowedDomain = ALLOWED_IMAGE_DOMAINS.some(
    (domain) =>
      parsedUrl.hostname === domain ||
      parsedUrl.hostname.endsWith(`.${domain}`)
  );
  if (!isAllowedDomain) {
    return res.status(403).send("Domain not allowed");
  }

  // Block private/internal IP addresses (SSRF protection)
  const hostname = parsedUrl.hostname;
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    return res.status(403).send("Internal addresses not allowed");
  }

  let lastError = "";

  const tryFetch = async (
    url: string,
    attempt: number = 1
  ): Promise<Response | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      console.log(`Attempt ${attempt} for: ${url}`);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) return response;

      console.error(
        `Attempt ${attempt} failed: ${response.status} ${response.statusText}`
      );
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

    if (!response) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      response = await tryFetch(imageUrl, 2);
    }

    if (!response && imageUrl.includes("model=flux")) {
      const fallbackUrl = imageUrl.replace("&model=flux", "&model=turbo");
      console.log("Switching to turbo model...");
      response = await tryFetch(fallbackUrl, 3);
    }

    if (!response) {
      const basicUrl =
        imageUrl.split("?")[0] + "?width=1024&height=1024&nologo=true";
      console.log("Trying basic endpoint...");
      response = await tryFetch(basicUrl, 4);
    }

    if (!response) {
      throw new Error(`All attempts failed. Last error: ${lastError}`);
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader(
      "Content-Type",
      response.headers.get("Content-Type") || "image/png"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(buffer);
  } catch (error: any) {
    console.error("Final Proxy error:", error.message);
    return res.status(500).send(`Error fetching image: ${error.message}`);
  }
}
