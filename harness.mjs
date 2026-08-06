// AAI6655 Final Project test harness.
// Drop this file in the yoga-sequencer repo root and run:  node harness.mjs
// Requires ANTHROPIC_API_KEY in .env (same as server.js). Results land in
// ./results/ as one markdown file per run plus log.csv with usage stats.
// Safe to re-run: existing result files are skipped, so an interrupted run
// resumes where it left off.
//
// Approaches:
//   v2  - midterm Version 2 prompt, one call            (cases 7-11)
//   A   - chained pipeline: architect > builder > verify (all 11 cases, 3 calls)
//   B   - self-critique: v2 generate > audit and revise  (all 11 cases, 2 calls)
//   C   - multi-model: haiku generate > opus audit       (cases 1, 3, 8, 11)

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";

const OPUS = process.env.HARNESS_OPUS_MODEL || "claude-opus-4-8";
const HAIKU = process.env.HARNESS_HAIKU_MODEL || "claude-haiku-4-5";
const MAX_TOKENS = 8000;
const OUT = path.resolve("./results");
fs.mkdirSync(OUT, { recursive: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("No ANTHROPIC_API_KEY in .env - aborting.");
  process.exit(1);
}

// ---------------------------------------------------------------- test cases
// 1-6 are the midterm cases, verbatim from Appendix B. 7-11 are new.
const CASES = [
  { id: "c01", duration: "60 minutes", level: "2", style: "Vinyasa", focus: "lunges", constraints: "none", props: "mat, 2 blocks", group: "mixed levels" },
  { id: "c02", duration: "75 minutes", level: "2", style: "Power vinyasa", focus: "backbends, peak Wheel", constraints: "none", props: "mat, blocks, strap", group: "small group" },
  { id: "c03", duration: "75 minutes", level: "2", style: "Power vinyasa", focus: "standing strength", constraints: "one student is pregnant, second trimester", props: "mat, blocks, bolster", group: "drop-in" },
  { id: "c04", duration: "60 minutes", level: "2", style: "Vinyasa", focus: "arm balance, peak Crow", constraints: "left wrist injury", props: "mat, 2 blocks", group: "individual" },
  { id: "c05", duration: "30 minutes", level: "1-2", style: "restorative wind-down", focus: "a goal of working toward forearm balance", constraints: "none", props: "mat, bolster, 2 blocks", group: "individual" },
  { id: "c06", duration: "45 minutes", level: "mixed", style: "Vinyasa", focus: "standing balance", constraints: "none", props: "mat only", group: "drop-in" },
  { id: "c07", duration: "60 minutes", level: "2", style: "Vinyasa", focus: "hips and stability", constraints: "one pregnant student (second trimester) AND one student with a right knee injury", props: "mat, 2 blocks", group: "drop-in" },
  { id: "c08", duration: "20 minutes", level: "2", style: "Vinyasa", focus: "core, short peak flow", constraints: "none", props: "mat only", group: "individual" },
  { id: "c09", duration: "60 minutes", level: "1 (true beginners)", style: "Vinyasa", focus: "requested peak: Handstand", constraints: "none", props: "mat, 2 blocks", group: "small group" },
  { id: "c10", duration: "about 45 minutes", level: "none", style: "none", focus: "something relaxing after a long day", constraints: "none", props: "none", group: "none" },
  { id: "c11", duration: "60 minutes", level: "2", style: "Vinyasa", focus: "inversions, long headstand and shoulderstand holds", constraints: "student notes high blood pressure", props: "mat, 2 blocks", group: "individual" },
];

const NEW_CASES = ["c07", "c08", "c09", "c10", "c11"];
const C_SUBSET = ["c01", "c03", "c08", "c11"];

// ------------------------------------------------------------ stage prompts
// The worked example is reused from the deployed prompt for the builder stage.
const WORKED_EXAMPLE = SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf("### Worked example"));

const ARCHITECT_SYSTEM = `You are a yoga class architect. You analyze a class request and produce a class skeleton, not a full plan. No pose lists yet.

From the request, output exactly these sections:

CONSTRAINTS: every parameter and condition in the request, one per line.
CONFLICTS: any conflict between a requested element and a stated condition, the stated level, or the stated intention, and how you resolve it. Prioritize safety and coherence; never plan a pose for a student it is contraindicated for. If a parameter is missing or vague, state the assumption you are making. Write "none" if there are no conflicts.
PEAK: the chosen peak or prime (an arm balance, a standing posture, or a backbend) consistent with the level and intention, or the adapted alternative if a conflict required one.
SECTIONS: the class arc in order: arrival and centering; warm-up; heat-building with sun salutations; standing series 1; standing series 2; peak; grounding (twists and counter folds); final rest. Adapt only for a gentler or restorative request (then skip sun salutations and strong heat-building). Give each section a time in whole minutes. Then write the addition out (for example "6 + 9 + 12 + 14 + 8 + 6 + 5 = 60") and adjust until the sum equals the requested duration exactly. Where the length allows, final rest gets at least five minutes.
MODIFICATION NOTES: for each stated condition, the categories of poses that need alternatives (for a pregnant student after the first trimester: closed deep twists, prone postures, strong core compression, breath retention, long supine holds; for a wrist injury: full weight-bearing on the palms; for a student who should not invert: inversions), plus any other category the stated condition makes unsafe.
PROPS: the exact list of allowed props from the request. Nothing else may be referenced downstream.`;

const BUILDER_SYSTEM = `You are an experienced, safety-conscious yoga teacher and class-sequencing assistant trained in vinyasa and power methods. You produce complete, well-sequenced class plans that are anatomically sound, appropriately leveled, and safe for the specific student or group described.

Work through this process, then present ONLY the final plan:

1. You will receive the original request and an approved class skeleton (CONSTRAINTS, CONFLICTS, PEAK, SECTIONS, MODIFICATION NOTES, PROPS). Build the full plan inside that skeleton. Use the skeleton's sections and section times exactly as given; do not change any time. Honor every conflict resolution and modification note. Reference only the props in the skeleton's PROPS list.
2. Give at least one modification or prop option for any pose that commonly needs one, and substitute when a condition rules a pose out.
3. Reference only the props listed as available. Do not call for a blanket, bolster, strap, or block that was not provided; use a no-prop alternative instead, such as a folded mat, stacked hands, or the floor. A wall may be offered for balance support only if you note it is not a listed prop.

Safety rules (non-negotiable):
- When the request notes a student with a condition or injury, offer that student a safe modification or alternative for any unsafe pose, while keeping the class appropriate for everyone else.
- Common cautions: for a pregnant student after the first trimester, offer alternatives to closed deep twists, prone postures, strong core compression, breath retention, and long supine holds (side-lying or propped options); for a wrist injury, offer alternatives to full weight-bearing on the palms (forearm, fist, or dolphin variants); if a student should not invert, offer a grounded alternative.
- Keep difficulty within the stated level; for mixed groups give a progression and a regression.
- After deep backbends, arm balances, strong twists, or inversions, include neutralizing counter poses before resting.
- Every plan ends with an appropriate final rest; where the length allows, give Savasana at least five minutes.

Output format:
- A one-line summary (duration, level, style, focus) plus a short note on how any conditions or conflicts were handled.
- The plan in sections, each with a bold section heading that includes the section's time. For each pose: Sanskrit name (English name) - breath count or time - a one-line cue - a modification or prop option where relevant.
- A timing line per section, then a final line that writes the section times being added and shows the total, which must equal the requested duration (for example, "Timing: 8 + 16 + 16 + 8 + 6 + 14 + 7 = 75 minutes").

${WORKED_EXAMPLE}`;

const VERIFIER_SYSTEM = `You are a yoga class plan verifier. You receive an original class request and a drafted plan. Check the plan against this list:

1. Timing: the section times must sum exactly to the requested duration. Redo the arithmetic yourself; do not trust the plan's stated total.
2. Props: every prop referenced must appear in the request's available-props list. A wall is permitted for balance only if the plan notes it is not a listed prop.
3. Contraindications: no pose is given, without a safe alternative, to a student whose stated condition rules it out (pregnancy after the first trimester: closed deep twists, prone postures, strong core compression, breath retention, long supine holds; wrist injury: full weight-bearing on the palms; no-inversion or blood-pressure concerns: inversions and long head-below-heart holds). Apply the same standard to any other stated condition.
4. Counterposes: deep backbends, arm balances, strong twists, and inversions are followed by neutralizing counter poses before rest.
5. Level: difficulty stays within the stated level; mixed groups get a progression and a regression.
6. Format: the plan follows the required output contract (summary line, sectioned plan with Sanskrit and English names, cues, modifications, timing line per section, final written addition).

Output, in order: an AUDIT block listing each check as PASS or the specific correction made, then the final corrected plan in the required output format. If no corrections are needed, say so and reproduce the plan unchanged.`;

const CRITIQUE_SYSTEM = `You are reviewing a yoga class plan you produced. Audit it against the original request using this checklist, then output a corrected final version.

1. Add the section times yourself and confirm they sum exactly to the requested duration.
2. Confirm every referenced prop is on the request's available-props list (a wall only with the required note).
3. Confirm no pose is given, without a safe alternative, to a student whose stated condition rules it out, including conditions not covered by a standard caution list.
4. Confirm neutralizing counterposes follow deep backbends, arm balances, strong twists, and inversions.
5. Confirm difficulty stays within the stated level, with a progression and a regression for mixed groups.
6. Confirm the output contract is followed.

Output an AUDIT block (each item PASS or the correction made), then the full corrected plan in the original output format. Change nothing that passes.`;

// ------------------------------------------------------------------ plumbing
const logPath = path.join(OUT, "log.csv");
if (!fs.existsSync(logPath)) {
  fs.writeFileSync(logPath, "file,model,input_tokens,output_tokens,latency_ms,timestamp\n");
}

async function call(model, system, user, label) {
  const t0 = Date.now();
  let attempt = 0;
  for (;;) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      });
      const ms = Date.now() - t0;
      const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      const u = msg.usage || {};
      fs.appendFileSync(
        logPath,
        `${label},${model},${u.input_tokens ?? ""},${u.output_tokens ?? ""},${ms},${new Date().toISOString()}\n`
      );
      return { text, usage: u, ms };
    } catch (err) {
      attempt += 1;
      const status = err?.status;
      if (attempt <= 4 && (status === 429 || status === 500 || status === 529)) {
        const wait = 15000 * attempt;
        console.warn(`  ${label}: ${status}, retry ${attempt} in ${wait / 1000}s`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

function save(name, text, meta) {
  const file = path.join(OUT, `${name}.md`);
  const header = `<!-- ${meta} -->\n\n`;
  fs.writeFileSync(file, header + text + "\n");
  console.log(`  saved ${name}.md`);
}

function done(name) {
  return fs.existsSync(path.join(OUT, `${name}.md`));
}

const wrap = (kase, extraLabel, body) =>
  `Original request:\n${buildUserMessage(kase)}\n\n${extraLabel}:\n${body}`;

// ------------------------------------------------------------------ runners
async function runV2(kase) {
  const name = `${kase.id}_v2`;
  if (done(name)) return console.log(`  skip ${name} (exists)`);
  const r = await call(OPUS, SYSTEM_PROMPT, buildUserMessage(kase), name);
  save(name, r.text, `v2 baseline | ${OPUS} | ${r.usage.input_tokens} in / ${r.usage.output_tokens} out | ${r.ms} ms`);
}

async function runA(kase) {
  const s1n = `${kase.id}_A_s1`, s2n = `${kase.id}_A_s2`, s3n = `${kase.id}_A_s3`;
  if (done(s3n)) return console.log(`  skip ${kase.id}_A (exists)`);
  const s1 = await call(OPUS, ARCHITECT_SYSTEM, buildUserMessage(kase), s1n);
  save(s1n, s1.text, `A stage 1 architect | ${OPUS} | ${s1.usage.input_tokens} in / ${s1.usage.output_tokens} out | ${s1.ms} ms`);
  const s2 = await call(OPUS, BUILDER_SYSTEM, wrap(kase, "Approved skeleton", s1.text), s2n);
  save(s2n, s2.text, `A stage 2 builder | ${OPUS} | ${s2.usage.input_tokens} in / ${s2.usage.output_tokens} out | ${s2.ms} ms`);
  const s3 = await call(OPUS, VERIFIER_SYSTEM, wrap(kase, "Drafted plan", s2.text), s3n);
  save(s3n, s3.text, `A stage 3 verifier | ${OPUS} | ${s3.usage.input_tokens} in / ${s3.usage.output_tokens} out | ${s3.ms} ms`);
}

async function runB(kase) {
  const gn = `${kase.id}_B_gen`, fn = `${kase.id}_B_final`;
  if (done(fn)) return console.log(`  skip ${kase.id}_B (exists)`);
  const g = await call(OPUS, SYSTEM_PROMPT, buildUserMessage(kase), gn);
  save(gn, g.text, `B generation | ${OPUS} | ${g.usage.input_tokens} in / ${g.usage.output_tokens} out | ${g.ms} ms`);
  const f = await call(OPUS, CRITIQUE_SYSTEM, wrap(kase, "Plan to review", g.text), fn);
  save(fn, f.text, `B critique | ${OPUS} | ${f.usage.input_tokens} in / ${f.usage.output_tokens} out | ${f.ms} ms`);
}

async function runC(kase) {
  const gn = `${kase.id}_C_gen`, fn = `${kase.id}_C_final`;
  if (done(fn)) return console.log(`  skip ${kase.id}_C (exists)`);
  const g = await call(HAIKU, SYSTEM_PROMPT, buildUserMessage(kase), gn);
  save(gn, g.text, `C generation | ${HAIKU} | ${g.usage.input_tokens} in / ${g.usage.output_tokens} out | ${g.ms} ms`);
  const f = await call(OPUS, CRITIQUE_SYSTEM, wrap(kase, "Plan to review", g.text), fn);
  save(fn, f.text, `C audit | ${OPUS} | ${f.usage.input_tokens} in / ${f.usage.output_tokens} out | ${f.ms} ms`);
}

// --------------------------------------------------------------------- main
const only = process.argv[2]; // optional: `node harness.mjs c08` runs one case
const byId = Object.fromEntries(CASES.map((c) => [c.id, c]));

async function main() {
  const targets = only ? [byId[only]].filter(Boolean) : CASES;
  if (only && !targets.length) {
    console.error(`Unknown case '${only}'. Valid: ${CASES.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }
  for (const kase of targets) {
    console.log(`\n=== ${kase.id} ===`);
    if (NEW_CASES.includes(kase.id)) await runV2(kase);
    await runA(kase);
    await runB(kase);
    if (C_SUBSET.includes(kase.id)) await runC(kase);
  }
  console.log("\nAll done. Results in ./results/ - send me the whole folder (zip it).");
}

main().catch((err) => {
  console.error("\nHarness failed:", err?.message || err);
  process.exit(1);
});
