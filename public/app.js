"use strict";

const STORAGE_KEY = "yoga-sequencer-plans";

/* ---------- tiny helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function loadPlans() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function savePlans(plans) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* Minimal markdown renderer: headings, bold, list items, paragraphs.
   Enough for the plan output contract; intentionally small. */
function renderMarkdown(md) {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    let inline = escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const h = inline.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length + 1; // shift so # -> h2
      html += `<h${level}>${h[2]}</h${level}>`;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline.replace(/^[-*]\s+/, "")}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inline}</p>`;
  }
  closeList();
  return html;
}

/* ---------- tab switching ---------- */
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;
    $$(".tab").forEach((t) => t.classList.toggle("is-active", t === tab));
    $$(".view").forEach((v) =>
      v.classList.toggle("is-active", v.id === `view-${view}`)
    );
    if (view === "library") renderLibrary();
  });
});

/* ---------- form: duration chips ---------- */
$("#durationChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  $$("#durationChips .chip").forEach((c) =>
    c.classList.toggle("is-active", c === chip)
  );
  $("#duration").value = chip.dataset.value;
});

/* ---------- form: prop chips (multi-select) ---------- */
$("#propChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  chip.classList.toggle("is-active");
});
function selectedProps() {
  const props = $$("#propChips .chip.is-active").map((c) => c.dataset.prop);
  return props.length ? props.join(", ") : "mat only";
}

/* ---------- generate ---------- */
let currentPlanText = "";

function gatherParams() {
  return {
    duration: $("#duration").value,
    level: $("#level").value,
    style: $("#style").value,
    focus: $("#focus").value,
    peakPose: $("#peakPose").value,
    constraints: $("#constraints").value,
    props: selectedProps(),
    group: $("#group").value,
  };
}

function setStatus(msg, kind) {
  const el = $("#status");
  if (!msg) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = msg;
  el.className = `status ${kind || ""}`;
}

$("#planForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const params = gatherParams();
  const btn = $("#generateBtn");
  btn.disabled = true;
  btn.textContent = "Generating…";
  setStatus("Sequencing your class — this takes a few seconds.", "working");
  $("#result").hidden = true;

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    showPlan(data.plan, params);
    setStatus("");
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate plan";
  }
});

function showPlan(text, params) {
  currentPlanText = text;
  currentParams = params;
  exitEdit();
  $("#planRendered").innerHTML = renderMarkdown(text);
  $("#result").hidden = false;
  $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- edit / save / print / export ---------- */
let currentParams = null;
let editing = false;

function enterEdit() {
  editing = true;
  $("#planEditor").value = currentPlanText;
  $("#planEditor").hidden = false;
  $("#planRendered").hidden = true;
  $("#editBtn").textContent = "Done";
}
function exitEdit() {
  if (editing) {
    currentPlanText = $("#planEditor").value;
    $("#planRendered").innerHTML = renderMarkdown(currentPlanText);
  }
  editing = false;
  $("#planEditor").hidden = true;
  $("#planRendered").hidden = false;
  $("#editBtn").textContent = "Edit";
}

$("#editBtn").addEventListener("click", () => {
  editing ? exitEdit() : enterEdit();
});

$("#saveBtn").addEventListener("click", () => {
  if (editing) exitEdit();
  const plans = loadPlans();
  const title = deriveTitle(currentParams, currentPlanText);
  plans.unshift({
    id: String(plans.length ? Number(plans[0].id) + 1 : 1),
    title,
    params: currentParams,
    text: currentPlanText,
    savedAt: new Date().toISOString(),
  });
  savePlans(plans);
  updateLibraryCount();
  setStatus(`Saved “${title}” to your library.`, "ok");
});

$("#printBtn").addEventListener("click", () => {
  if (editing) exitEdit();
  window.print();
});

$("#exportBtn").addEventListener("click", () => {
  if (editing) exitEdit();
  const blob = new Blob([currentPlanText], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${deriveTitle(currentParams, currentPlanText)
    .replace(/[^\w]+/g, "-")
    .toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

function deriveTitle(params, text) {
  const p = params || {};
  const focus = (p.focus || "").trim();
  const base = [p.duration, p.style, focus].filter(Boolean).join(" · ");
  return base || "Yoga class";
}

/* ---------- library ---------- */
function updateLibraryCount() {
  $("#libraryCount").textContent = String(loadPlans().length);
}

function renderLibrary() {
  const plans = loadPlans();
  const list = $("#libraryList");
  $("#libraryEmpty").hidden = plans.length > 0;
  list.innerHTML = "";
  for (const plan of plans) {
    const li = document.createElement("li");
    li.className = "library-item";
    const when = new Date(plan.savedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    li.innerHTML = `
      <div class="library-meta">
        <span class="library-title">${escapeHtml(plan.title)}</span>
        <span class="library-date">${when}</span>
      </div>
      <div class="library-buttons">
        <button class="ghost" data-action="open">Open</button>
        <button class="ghost" data-action="duplicate">Duplicate</button>
        <button class="ghost danger" data-action="delete">Delete</button>
      </div>`;
    li.querySelector('[data-action="open"]').addEventListener("click", () => {
      openSaved(plan);
    });
    li.querySelector('[data-action="duplicate"]').addEventListener(
      "click",
      () => duplicateSaved(plan)
    );
    li.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (confirm(`Delete “${plan.title}”?`)) deleteSaved(plan.id);
    });
    list.appendChild(li);
  }
}

function openSaved(plan) {
  $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === "plan"));
  $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === "view-plan"));
  if (plan.params) restoreForm(plan.params);
  showPlan(plan.text, plan.params);
}

function duplicateSaved(plan) {
  const plans = loadPlans();
  plans.unshift({
    ...plan,
    id: String(Number(plans[0].id) + 1),
    title: plan.title + " (copy)",
    savedAt: new Date().toISOString(),
  });
  savePlans(plans);
  updateLibraryCount();
  renderLibrary();
}

function deleteSaved(id) {
  savePlans(loadPlans().filter((p) => p.id !== id));
  updateLibraryCount();
  renderLibrary();
}

function restoreForm(p) {
  $("#duration").value = p.duration || "60 min";
  $$("#durationChips .chip").forEach((c) =>
    c.classList.toggle("is-active", c.dataset.value === p.duration)
  );
  if (p.level) $("#level").value = p.level;
  if (p.style) $("#style").value = p.style;
  $("#focus").value = p.focus || "";
  $("#peakPose").value = p.peakPose || "";
  $("#constraints").value = p.constraints || "";
  $("#group").value = p.group || "";
  const propSet = new Set((p.props || "").split(",").map((s) => s.trim()));
  $$("#propChips .chip").forEach((c) =>
    c.classList.toggle("is-active", propSet.has(c.dataset.prop))
  );
}

/* ---------- init ---------- */
updateLibraryCount();
