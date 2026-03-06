// Vercel serverless function – Redis storage for chat logs & survey responses
// Requires KV_REST_API_URL and KV_REST_API_TOKEN env vars
// (auto-set when you connect an Upstash Redis store via Vercel dashboard > Storage)

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ── Discord webhook notification (survey responses only) ──
const SURVEY_LABELS = {
  q1: "What came through strongest?",
  q2: "What do you most want to see?",
  q3: "What's your next step?",
};

async function notifyDiscord(key, value) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !key.startsWith("response:")) return;

  try {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    const fields = Object.entries(SURVEY_LABELS)
      .filter(([k]) => data[k])
      .map(([k, label]) => ({ name: label, value: String(data[k]), inline: false }));

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [{
        title: "New Survey Response",
        color: 0x57F287,
        fields: fields.length > 0 ? fields : [{ name: "Data", value: JSON.stringify(data).slice(0, 1024) }],
        timestamp: data.ts || new Date().toISOString(),
      }] }),
    });
  } catch (err) {
    console.error("Discord webhook error:", err);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Bail early if Redis isn't configured
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(503).json({ error: "Storage not configured." });
  }

  try {
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { action, key, value } = body || {};

      if (action === "set" && key && value !== undefined) {
        await redis.set(key, value);
        await notifyDiscord(key, value).catch(() => {});
        return res.status(200).json({ ok: true });
      }

      if (action === "delete" && key) {
        await redis.del(key);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Invalid set request. Need action, key, value." });
    }

    if (req.method === "GET") {
      const { action, key, prefix } = req.query;

      if (action === "get" && key) {
        const value = await redis.get(key);
        return res.status(200).json({ value: value ?? null });
      }

      if (action === "list" && prefix) {
        const keys = [];
        let cursor = 0;
        do {
          const [nextCursor, batch] = await redis.scan(cursor, { match: `${prefix}*`, count: 200 });
          cursor = Number(nextCursor);
          keys.push(...batch);
        } while (cursor > 0);
        return res.status(200).json({ keys });
      }

      return res.status(400).json({ error: "Invalid get request. Need action + key or prefix." });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Storage API error:", err);
    return res.status(500).json({ error: "Storage operation failed." });
  }
}
