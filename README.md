# Yoga Sequencer

A small web app that turns a few class parameters into a complete, safety-checked
yoga class plan. It wraps the Version 2 prompt from the AAI6655 midterm — the
sequencing method, safety rules, output contract, and a worked example drawn from
a real "January 4th" class — in a form-driven interface with saving, inline
editing, and printing.

## What it does

- **Plan** — fill in duration, level, style, focus, constraints, props, and group;
  generate a sectioned plan with Sanskrit/English pose names, cues, modifications,
  and a timing line that sums to the requested duration.
- **Edit** — tweak the generated plan inline before saving or printing.
- **Save & Library** — keep plans in your browser (localStorage); browse, reopen,
  duplicate, and delete them.
- **Print / Export** — a clean printable view, or download the plan as Markdown.

## Run it locally

1. Install Node 18+ (you have it if `node --version` works).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Add your Anthropic API key:
   ```bash
   cp .env.example .env
   # then edit .env and paste your key from
   # https://console.anthropic.com/settings/keys
   ```
4. Start the app:
   ```bash
   npm start
   ```
5. Open <http://localhost:3000>.

Your API key stays in `.env` on your machine (git-ignored) and is only used
server-side — it never reaches the browser.

## Configuration

Environment variables (all optional except the key):

| Variable            | Default          | Purpose                          |
| ------------------- | ---------------- | -------------------------------- |
| `ANTHROPIC_API_KEY` | _(required)_     | Your Anthropic API key.          |
| `MODEL`             | `claude-opus-4-8`| Model used for generation.       |
| `PORT`              | `3000`           | Port the server listens on.      |

## Deploy (optional, for phone access)

The whole app is one Node server, so any host that runs Node works
(Render, Railway, Fly.io, etc.). Set `ANTHROPIC_API_KEY` as a secret in the host's
dashboard, point the start command at `npm start`, and you're done. Saved plans
live in each browser, so the library is per-device.

## Project layout

```text
server.js          Express server + POST /api/generate (calls Claude)
prompt.js          Version 2 system prompt + the January 4th worked example
public/index.html  Form, result, and library UI
public/app.js      Form handling, generation, edit/save/print/export, library
public/style.css   Clean, phone-friendly styling + print styles
```
