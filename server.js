import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT } from './src/systemPrompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const MODEL = process.env.MODEL || 'claude-opus-4-8';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check — does not touch the model or require a key.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    model: MODEL,
    hasApiKey: Boolean(ANTHROPIC_API_KEY),
  });
});

// Build the user message from the class parameters, matching the midterm template
// (plus the optional peak pose).
function buildUserMessage(p) {
  const field = (v) => (v && String(v).trim() ? String(v).trim() : 'none');
  return [
    'Design a yoga class with these parameters.',
    '',
    `Duration: ${field(p.duration)}`,
    `Level: ${field(p.level)}`,
    `Style: ${field(p.style)}`,
    `Focus or intention: ${field(p.focus)}`,
    `Peak pose: ${field(p.peakPose)}`,
    `Constraints or contraindications: ${field(p.constraints)}`,
    `Available props: ${field(p.props)}`,
    `Group type: ${field(p.group)}`,
  ].join('\n');
}

// Proxy the model call. The API key never leaves the server.
app.post('/api/generate', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Server is missing ANTHROPIC_API_KEY. Copy .env.example to .env and add your key.',
    });
  }

  const userMessage = buildUserMessage(req.body || {});

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Anthropic API error:', response.status, detail);
      return res.status(502).json({
        error: `Model request failed (${response.status}). Check the server log and your API key.`,
      });
    }

    const data = await response.json();
    const plan = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!plan) {
      return res.status(502).json({ error: 'Model returned an empty plan.' });
    }

    res.json({ plan });
  } catch (err) {
    console.error('Generate failed:', err);
    res.status(500).json({ error: 'Could not reach the model. Check your connection and try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Yoga sequencer running at http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('Warning: ANTHROPIC_API_KEY is not set. Generation will fail until you add it to .env.');
  }
});
