// Vercel serverless function – proxies design-capture.html to the Anthropic API.
// API key comes from ANTHROPIC_API_KEY env var (set in Vercel dashboard).
// Access is gated by a shared passphrase (DC_PASSPHRASE env var) because the
// page is publicly reachable — without the gate this would be an open Claude relay.

import { timingSafeEqual } from "node:crypto";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514"; // must match what design-capture.html expects
const MAX_TOKENS = 4096;

// ── Rate-limit config (backstop in case the passphrase leaks) ──
const RATE_LIMIT_MAX = 400;            // requests per window per IP
const RATE_LIMIT_WINDOW_MS = 3600000;  // 1 hour

// Simple in-memory rate limiter (resets on cold start, good enough for light traffic)
const ipBuckets = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  let bucket = ipBuckets.get(ip);
  if (!bucket || now - bucket.start > RATE_LIMIT_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    ipBuckets.set(ip, bucket);
  }
  bucket.count++;
  if (ipBuckets.size > 5000) {
    for (const [k, v] of ipBuckets) {
      if (now - v.start > RATE_LIMIT_WINDOW_MS) ipBuckets.delete(k);
    }
  }
  return bucket.count > RATE_LIMIT_MAX;
}

// ── Validation ──
const MAX_SYSTEM_LENGTH = 40000;
const MAX_USER_LENGTH = 120000;

// Constant-time string compare (avoids a timing oracle on the passphrase).
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Design-capture is not configured yet." });
  }

  const expectedPass = process.env.DC_PASSPHRASE;
  if (!expectedPass) {
    return res.status(500).json({ error: "Design-capture passphrase is not configured." });
  }

  // Rate limit by IP
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || req.socket?.remoteAddress
    || "unknown";

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Rate limit reached. Try again later." });
  }

  // Parse and validate body
  let system, user, passphrase;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    system = body?.system;
    user = body?.user;
    passphrase = body?.passphrase;
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }

  if (!safeEqual(passphrase, expectedPass)) {
    return res.status(401).json({ error: "Invalid passphrase." });
  }

  if (typeof system !== "string" || typeof user !== "string" || user.length === 0) {
    return res.status(400).json({ error: "system and user must be strings." });
  }

  const trimmedSystem = system.slice(0, MAX_SYSTEM_LENGTH);
  const trimmedUser = user.slice(0, MAX_USER_LENGTH);

  // Call Anthropic API
  try {
    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: trimmedSystem,
        messages: [{ role: "user", content: trimmedUser }],
      }),
    });

    const data = await anthropicRes.json().catch(() => null);

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", anthropicRes.status, JSON.stringify(data));
      return res.status(502).json({ error: "Claude is temporarily unavailable.", debug: anthropicRes.status });
    }

    // Pass the raw Anthropic response through unchanged so the client's
    // existing `(await r.json()).content[0].text` parsing keeps working.
    return res.status(200).json(data);
  } catch (err) {
    console.error("design-capture proxy error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
