'use strict';

const STORAGE_KEY = 'yoga-sequencer.plans.v1';

const $ = (id) => document.getElementById(id);

// ---- Elements ----
const form = $('plan-form');
const durationInput = $('duration');
const durationValue = $('duration-value');
const generateBtn = $('generate-btn');
const statusEl = $('status');
const editor = $('editor');
const planTitle = $('plan-title');
const planText = $('plan-text');
const saveBtn = $('save-btn');
const printBtn = $('print-btn');
const downloadBtn = $('download-btn');

const tabBuild = $('tab-build');
const tabLibrary = $('tab-library');
const viewBuild = $('view-build');
const viewLibrary = $('view-library');
const libraryList = $('library-list');
const libraryEmpty = $('library-empty');
const libraryCount = $('library-count');
const printArea = $('print-area');

// Tracks which saved plan is currently open (so Save updates instead of duplicating).
let currentPlanId = null;

// ---- Duration slider label ----
durationInput.addEventListener('input', () => {
  durationValue.textContent = `${durationInput.value} min`;
});

// ---- Tabs ----
function showTab(which) {
  const build = which === 'build';
  tabBuild.classList.toggle('is-active', build);
  tabLibrary.classList.toggle('is-active', !build);
  viewBuild.hidden = !build;
  viewLibrary.hidden = build;
  if (!build) renderLibrary();
}
tabBuild.addEventListener('click', () => showTab('build'));
tabLibrary.addEventListener('click', () => showTab('library'));

// ---- Status helper ----
function setStatus(message, kind) {
  if (!message) {
    statusEl.hidden = true;
    statusEl.textContent = '';
    statusEl.className = 'status';
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = 'status' + (kind ? ` is-${kind}` : '');
}

// ---- Read the class parameters ----
function readParams() {
  return {
    duration: `${durationInput.value} min`,
    level: $('level').value,
    style: $('style').value,
    focus: $('focus').value,
    peakPose: $('peak-pose').value,
    constraints: $('constraints').value,
    props: $('props').value,
    group: $('group').value,
  };
}

function defaultTitle(params) {
  const bits = [params.duration, params.level && `L${params.level}`, params.style].filter(Boolean);
  const focus = params.focus && params.focus.trim();
  return focus ? `${bits.join(' ')} — ${focus}` : bits.join(' ');
}

// ---- Generate ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const params = readParams();
  generateBtn.disabled = true;
  setStatus('Generating plan…', 'loading');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

    currentPlanId = null; // a freshly generated plan is not yet saved
    planText.value = data.plan;
    planTitle.value = defaultTitle(params);
    editor.hidden = false;
    setStatus('');
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    generateBtn.disabled = false;
  }
});

// ---- Library storage ----
function loadPlans() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function savePlans(plans) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  updateLibraryCount();
}
function updateLibraryCount() {
  const n = loadPlans().length;
  libraryCount.textContent = n ? `(${n})` : '';
}

saveBtn.addEventListener('click', () => {
  const text = planText.value.trim();
  if (!text) {
    setStatus('Nothing to save yet.', 'error');
    return;
  }
  const plans = loadPlans();
  const title = planTitle.value.trim() || 'Untitled plan';
  const now = new Date().toISOString();

  const existing = currentPlanId && plans.find((p) => p.id === currentPlanId);
  if (existing) {
    existing.title = title;
    existing.plan = text;
    existing.updatedAt = now;
  } else {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    plans.unshift({ id, title, plan: text, createdAt: now, updatedAt: now });
    currentPlanId = id;
  }
  savePlans(plans);
  setStatus('Saved to library.', 'loading');
  setTimeout(() => setStatus(''), 1500);
});

// ---- Render library ----
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function renderLibrary() {
  const plans = loadPlans();
  updateLibraryCount();
  libraryEmpty.hidden = plans.length > 0;
  libraryList.innerHTML = '';

  for (const p of plans) {
    const li = document.createElement('li');
    li.className = 'library-item';

    const h3 = document.createElement('h3');
    h3.textContent = p.title;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `Saved ${formatDate(p.updatedAt || p.createdAt)}`;

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => openPlan(p.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deletePlan(p.id));

    actions.append(openBtn, delBtn);
    li.append(h3, meta, actions);
    libraryList.append(li);
  }
}

function openPlan(id) {
  const plan = loadPlans().find((p) => p.id === id);
  if (!plan) return;
  currentPlanId = id;
  planTitle.value = plan.title;
  planText.value = plan.plan;
  editor.hidden = false;
  showTab('build');
  setStatus('');
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deletePlan(id) {
  if (!confirm('Delete this plan? This cannot be undone.')) return;
  const plans = loadPlans().filter((p) => p.id !== id);
  savePlans(plans);
  if (currentPlanId === id) currentPlanId = null;
  renderLibrary();
}

// ---- Print ----
printBtn.addEventListener('click', () => {
  const title = planTitle.value.trim() || 'Yoga class plan';
  printArea.innerHTML = '';
  const h = document.createElement('h2');
  h.textContent = title;
  const body = document.createElement('div');
  body.textContent = planText.value;
  printArea.append(h, body);
  window.print();
});

// ---- Download ----
downloadBtn.addEventListener('click', () => {
  const title = planTitle.value.trim() || 'yoga-plan';
  const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'yoga-plan';
  const content = `# ${title}\n\n${planText.value}\n`;
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.md`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ---- Init ----
updateLibraryCount();
