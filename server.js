import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const MODEL = process.env.MODEL || "claude-opus-4-8";
const apiKey = process.env.ANTHROPIC_API_KEY;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = apiKey ? new Anthropic({ apiKey }) : null;

app.post("/api/generate", async (req, res) => {
  if (!client) {
    return res.status(500).json({
      error:
        "No ANTHROPIC_API_KEY configured. Copy .env.example to .env and add your key, then restart.",
    });
  }

  const params = req.body || {};
  if (!params.duration || !params.style) {
    return res
      .status(400)
      .json({ error: "Please provide at least a duration and a style." });
  }

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(params) }],
    });

    const plan = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    res.json({ plan });
  } catch (err) {
    const status = err?.status || 500;
    const detail = err?.error?.error?.message || err?.message || "Unknown error";
    console.error("Generation failed:", detail);
    res.status(status).json({ error: `Claude request failed: ${detail}` });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, keyConfigured: Boolean(client) });
});

app.listen(PORT, () => {
  console.log(`Yoga Sequencer running at http://localhost:${PORT}`);
  if (!client) {
    console.warn(
      "⚠  No ANTHROPIC_API_KEY found. The form will load but generation will fail until you add a key to .env."
    );
  }
});
