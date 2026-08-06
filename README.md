# Yoga Sequencer

A phone-friendly class-plan generator. Enter the class parameters (duration,
level, style, focus, an optional peak pose, constraints, props, group), generate
a sequenced and safety-checked plan, edit it inline, save plans to a local
library on your device, and print or export before teaching.

The generation logic is the Version 2 sequencing prompt from the AAI6655 midterm
project, with the author's real class **January 4th A** (a 60-minute Level 2
vinyasa balance/hip-opening flow) embedded as the worked example.

## Run locally

```bash
npm install
cp .env.example .env      # then add your Anthropic API key
npm start
```

Open http://localhost:3000 on your computer or phone (same network).

The Anthropic API key is read server-side from `.env` (`ANTHROPIC_API_KEY`) and
is never sent to the browser — the browser only talks to this server's
`/api/generate` endpoint.

### Environment variables

| Variable            | Required | Default            | Notes                          |
| ------------------- | -------- | ------------------ | ------------------------------ |
| `ANTHROPIC_API_KEY` | yes      | —                  | Get one at console.anthropic.com |
| `MODEL`             | no       | `claude-opus-4-8`  | Override the model             |
| `PORT`              | no       | `3000`             | Server port                    |

## What it does

1. **Generate** a plan from the class parameters (duration, level, style, focus,
   optional peak pose, constraints, props, group). When a peak pose is named,
   the whole class is built toward it.
2. **Edit** the generated plan inline.
3. **Save** plans to a local browser library (localStorage) you can revisit.
4. **Print / export** a plan (print dialog or download as Markdown).

## Health check

`GET /health` returns `{ "status": "ok", "model": ..., "hasApiKey": true|false }`
without calling the model.

## Project layout

| Path                  | What it is                                              |
| --------------------- | ------------------------------------------------------- |
| `server.js`           | Express server; serves `public/` and proxies the model  |
| `src/systemPrompt.js` | The sequencing system prompt the app generates from     |
| `public/`             | The browser app (no build step)                         |
| `harness.mjs`         | Coursework experiment runner (not used by the app)      |
| `prompt.js`           | Prompt used **only** by `harness.mjs`                   |
| `docs/`               | Source class the worked example came from               |
| `docs/course/`        | AAI6655 paper and supporting material                   |

## Coursework

This started as the AAI6655 prompt-engineering project. The write-up lives in
[`docs/course/`](docs/course/), and [`docs/January 4th A.docx`](docs/) is the
real class the prompt's worked example was drawn from.

`node harness.mjs` runs the final-project experiment (approaches v2 / A / B / C
over 11 cases) using the prompt in `prompt.js`; output lands in `results/`. Two
completed runs are kept locally as `results/` and `results-run2/`; both are
gitignored, as are the development transcripts in `docs/course/process/`.

## Deploying later

The app is a plain Node/Express server serving static files from `public/`. To
deploy to a free host (Render, Railway, Fly, etc.): set `ANTHROPIC_API_KEY` as an
environment variable in the host's dashboard, ensure the start command is
`npm start`, and the host's assigned `PORT` is picked up automatically.
