const STORE_KEY = "dsa-tracker-progress";
const BACKUP_KEY = "dsa-tracker-progress-backup";
const ALL_PROBLEMS = DATA.topics.flatMap((t) => t.patterns.flatMap((p) => p.problems));
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let heatmapYearOffset = 0;
let preFilterOpenState = null;
let lastFilterSig = "";

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (parsed && parsed.problems) return parsed;
  } catch (e) {}
  return { version: 1, problems: {} };
}

function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    // Private-mode Safari and full-quota browsers throw here. Silently failing
    // would leave ticked boxes that vanish on reload, so say so once.
    if (!saveStore.warned) {
      saveStore.warned = true;
      alert("Your progress could not be saved — the browser is blocking local storage (private browsing or storage is full). Changes will be lost when you reload.");
    }
  }
}

function getState(store, id) {
  return store.problems[id] || { done: false, revise: false, notes: "", completedAt: null, revisedAt: null };
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayISO() {
  return toISODate(new Date());
}

function countDone(problems, store) {
  return problems.reduce((n, p) => n + (getState(store, p.id).done ? 1 : 0), 0);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function renderProblem(p, store, ctx) {
  const st = getState(store, p.id);
  // Searching "graphs" or "sliding window" should find problems even though those
  // words only live on the topic/pattern, not the problem title.
  const haystack = [p.question, ctx.topic, ctx.pattern, p.subpattern, p.platform]
    .filter(Boolean).join(" ").toLowerCase();
  const qHtml = p.link
    ? `<a class="q-text" href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.question)}</a>`
    : `<span class="q-text">${esc(p.question)}</span>`;
  const meta = [
    p.platform && p.platform !== "-" ? p.platform : null,
    p.estMinutes ? `${p.estMinutes} min` : null,
    p.importance ? `Importance: ${p.importance}` : null,
    p.interviewFreq ? `Interview freq: ${p.interviewFreq}` : null,
    p.originalStep || null,
  ].filter(Boolean).join(" · ");
  return `
    <div class="problem-row ${st.done ? "done" : ""}" data-id="${p.id}" data-difficulty="${p.difficulty}" data-importance="${p.importance}" data-freq="${p.interviewFreq}" data-revise="${st.revise ? "1" : "0"}" data-question="${esc(haystack)}">
      <input type="checkbox" class="done-cb" ${st.done ? "checked" : ""} aria-label="Mark &quot;${esc(p.question)}&quot; as done">
      <div class="q-main">
        <div class="q-line">
          ${qHtml}
          <span class="badge ${p.difficulty}">${p.difficulty}</span>
          <button class="star-btn ${st.revise ? "active" : ""}" title="${st.revise ? "Unmark for revision" : "Mark for revision"}" aria-label="Mark for revision" aria-pressed="${st.revise ? "true" : "false"}">&#9733;</button>
          <button class="notes-btn ${st.notes ? "has-notes" : ""}">notes</button>
        </div>
        <div class="detail-panel">
          <div class="meta-text">${esc(meta)}</div>
          <textarea placeholder="Notes...">${esc(st.notes)}</textarea>
        </div>
      </div>
    </div>`;
}

function renderPattern(pattern, store, topicName) {
  const rows = pattern.problems.map((p) => renderProblem(p, store, { topic: topicName, pattern: pattern.name })).join("");
  return `
    <details class="pattern" data-pattern="${pattern.id}">
      <summary>${esc(pattern.name)} <span data-pattern-progress="${pattern.id}"></span></summary>
      <div class="pattern-body">${rows}</div>
    </details>`;
}

function renderTopic(topic, store) {
  const patterns = topic.patterns.map((p) => renderPattern(p, store, topic.name)).join("");
  return `
    <details class="topic" data-topic="${topic.id}">
      <summary>
        ${esc(topic.name)}
        <span class="topic-meter"><span class="progress-bar mini"><span class="progress-fill" data-topic-fill="${topic.id}"></span></span></span>
        <span class="topic-progress" data-topic-progress="${topic.id}"></span>
      </summary>
      ${patterns}
    </details>`;
}

function render() {
  const store = loadStore();
  // #topics is rebuilt, so any remembered <details> references are now stale.
  preFilterOpenState = null;
  lastFilterSig = "";
  document.getElementById("topics").innerHTML = DATA.topics.map((t) => renderTopic(t, store)).join("");
  updateProgress(store);
  applyFilters();
  updateUndoImportVisibility();
}

function updateProgress(store) {
  let overallDone = 0, overallTotal = 0;
  DATA.topics.forEach((topic) => {
    let topicDone = 0, topicTotal = 0;
    topic.patterns.forEach((pattern) => {
      const pDone = countDone(pattern.problems, store);
      const pTotal = pattern.problems.length;
      topicDone += pDone;
      topicTotal += pTotal;
      const el = document.querySelector(`[data-pattern-progress="${pattern.id}"]`);
      if (el) el.textContent = `${pDone}/${pTotal}`;
    });
    overallDone += topicDone;
    overallTotal += topicTotal;
    const el = document.querySelector(`[data-topic-progress="${topic.id}"]`);
    if (el) el.textContent = `${topicDone}/${topicTotal}`;
    const fill = document.querySelector(`[data-topic-fill="${topic.id}"]`);
    if (fill) fill.style.width = (topicTotal ? Math.round((topicDone / topicTotal) * 100) : 0) + "%";
  });
  const pct = overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0;
  document.getElementById("overallFill").style.width = pct + "%";
  document.getElementById("overallLabel").textContent = `${overallDone}/${overallTotal} (${pct}%)`;
  renderAnalytics(store);
  renderHeatmap(store);
}

function breakdownBy(getKey, order, store) {
  const stats = {};
  order.forEach((k) => (stats[k] = { done: 0, total: 0 }));
  ALL_PROBLEMS.forEach((p) => {
    const k = getKey(p);
    if (!stats[k]) return;
    stats[k].total++;
    if (getState(store, p.id).done) stats[k].done++;
  });
  return order.filter((k) => stats[k].total > 0).map((k) => ({ label: k, ...stats[k] }));
}

function analyticsRow(r) {
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  return `
    <div class="analytics-row">
      <span class="analytics-label">${esc(r.label)}</span>
      <div class="progress-bar mini"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="analytics-count">${r.done}/${r.total}</span>
    </div>`;
}

function renderAnalytics(store) {
  const revised = ALL_PROBLEMS.filter((p) => getState(store, p.id).revise).length;
  const sections = [
    { title: "Difficulty", rows: breakdownBy((p) => p.difficulty, ["Easy", "Medium", "Hard"], store) },
    { title: "Importance", rows: breakdownBy((p) => p.importance, ["High", "Medium", "Low"], store) },
    { title: "Interview Frequency", rows: breakdownBy((p) => p.interviewFreq, ["Very High", "High", "Medium", "Low"], store) },
  ];
  const cards = sections.map((sec) => `
    <div class="analytics-card">
      <div class="analytics-card-title">${esc(sec.title)}</div>
      ${sec.rows.map(analyticsRow).join("")}
    </div>`).join("");
  document.getElementById("analyticsGrid").innerHTML = cards + `
    <div class="analytics-card">
      <div class="analytics-card-title">Marked for revision</div>
      <div class="analytics-row"><span class="analytics-label">&#9733; Revision</span><span class="analytics-count">${revised}</span></div>
    </div>`;
}

function buildHeatmapStats(store) {
  const doneByDate = new Map();
  const revisedByDate = new Map();
  Object.values(store.problems).forEach((st) => {
    if (st.completedAt) doneByDate.set(st.completedAt, (doneByDate.get(st.completedAt) || 0) + 1);
    if (st.revisedAt) revisedByDate.set(st.revisedAt, (revisedByDate.get(st.revisedAt) || 0) + 1);
  });
  return { doneByDate, revisedByDate };
}

// Fixed thresholds rather than rebasing on the range max: a single solved problem
// shouldn't render as the darkest green, and two years should be comparable.
// A streak stays alive through today even before you've solved anything today —
// it only breaks once a full day passes with nothing solved.
function computeStreak(doneByDate) {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!doneByDate.get(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (doneByDate.get(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// How many years back the record actually goes — paging past it shows nothing.
function earliestYearOffset(store) {
  const earliest = Object.values(store.problems)
    .map((st) => st.completedAt || st.revisedAt)
    .filter(Boolean)
    .sort()[0];
  return earliest ? new Date().getFullYear() - Number(earliest.slice(0, 4)) : 0;
}

function findNextUnsolved(store) {
  return ALL_PROBLEMS.find((p) => !getState(store, p.id).done) || null;
}

function heatmapLevel(count) {
  if (!count) return 0;
  if (count >= 10) return 4;
  if (count >= 6) return 3;
  if (count >= 3) return 2;
  return 1;
}

function formatDayLabel(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function getHeatmapRange(offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (offset === 0) {
    const end = today;
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    return { start, end, label: "Current" };
  }
  const year = today.getFullYear() - offset;
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31), label: String(year) };
}

function renderHeatmap(store) {
  const { doneByDate, revisedByDate } = buildHeatmapStats(store);
  const { start: rangeStart, end: rangeEnd, label } = getHeatmapRange(heatmapYearOffset);
  // Each month owns only its own days: a week straddling a month boundary is
  // split, so no day ever renders under a neighbouring month's label.
  const months = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const lastMonthStart = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  while (cursor <= lastMonthStart) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const from = monthStart < rangeStart ? new Date(rangeStart) : monthStart;
    const to = monthEnd > rangeEnd ? new Date(rangeEnd) : monthEnd;
    const days = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const iso = toISODate(d);
      days.push({
        date: new Date(d),
        done: doneByDate.get(iso) || 0,
        revised: revisedByDate.get(iso) || 0,
      });
    }
    if (days.length) months.push({ label: MONTH_NAMES[monthStart.getMonth()], pad: from.getDay(), days });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const allDays = months.flatMap((m) => m.days);

  const blocksHtml = months.map((month) => {
    const cells = [];
    for (let i = 0; i < month.pad; i++) cells.push(`<div class="heatmap-day empty"></div>`);
    month.days.forEach((day) => {
      const level = heatmapLevel(day.done);
      const revisedPart = day.revised ? ` · ${day.revised} revised` : "";
      const tip = `${day.done} solved${revisedPart} on ${formatDayLabel(day.date)}`;
      // title= is mouse-only: it never fires on touch and can't be focused, which
      // made the whole heatmap inert on phones. Custom tip handles all three inputs.
      cells.push(`<div class="heatmap-day" data-level="${level}" data-tip="${esc(tip)}" tabindex="0" role="img" aria-label="${esc(tip)}"></div>`);
    });
    while (cells.length % 7) cells.push(`<div class="heatmap-day empty"></div>`);
    const weeksHtml = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeksHtml.push(`<div class="heatmap-week">${cells.slice(i, i + 7).join("")}</div>`);
    }
    return `
      <div class="heatmap-month-block">
        <div class="heatmap-month-weeks">${weeksHtml.join("")}</div>
        <div class="heatmap-month-label">${month.label}</div>
      </div>`;
  }).join("");

  document.getElementById("heatmapGrid").innerHTML = `<div class="heatmap-body">${blocksHtml}</div>`;

  document.getElementById("heatmapLegend").innerHTML = `
    <span>Less</span>
    ${[0, 1, 2, 3, 4].map((l) => `<div class="heatmap-day" data-level="${l}"></div>`).join("")}
    <span>More</span>`;

  document.getElementById("heatmapYearLabel").textContent = label;
  document.getElementById("heatmapNextYear").disabled = heatmapYearOffset === 0;
  document.getElementById("heatmapPrevYear").disabled = heatmapYearOffset >= Math.max(earliestYearOffset(store), 1);

  const totalDone = allDays.reduce((s, d) => s + d.done, 0);
  const totalRevised = allDays.reduce((s, d) => s + d.revised, 0);
  const activeDays = allDays.filter((d) => d.done > 0).length;
  document.getElementById("heatmapSummary").textContent =
    `${totalDone} solved · ${totalRevised} revised on ${activeDays} active day${activeDays === 1 ? "" : "s"} in this range`;

  const streak = computeStreak(doneByDate);
  document.getElementById("statStreak").textContent = streak;
  document.getElementById("statToday").textContent = doneByDate.get(todayISO()) || 0;
  document.getElementById("statRange").textContent = totalDone;

  const next = findNextUnsolved(store);
  const continueBtn = document.getElementById("continueBtn");
  continueBtn.hidden = !next;
  if (next) continueBtn.dataset.target = next.id;
}

function jumpToProblem(id) {
  const row = document.querySelector(`.problem-row[data-id="${id}"]`);
  if (!row) return;
  let node = row.parentElement;
  while (node) {
    if (node.tagName === "DETAILS") node.open = true;
    node = node.parentElement;
  }
  row.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  row.classList.remove("just-jumped");
  void row.offsetWidth; // restart the highlight if the same row is targeted twice
  row.classList.add("just-jumped");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyFilters() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const diff = document.querySelector(".diff-btn.active").dataset.diff;
  const importance = document.getElementById("importanceFilter").value;
  const freq = document.getElementById("freqFilter").value;
  const hideCompleted = document.getElementById("hideCompleted").checked;
  const reviseOnly = document.getElementById("reviseOnly").checked;
  const filtersActive = !!q || diff !== "All" || importance !== "All" || freq !== "All" || reviseOnly;

  // Force-open accordions only when the filter inputs actually changed. Otherwise
  // ticking a checkbox would re-explode every topic the user had just collapsed.
  const sig = [q, diff, importance, freq, hideCompleted, reviseOnly].join(" ");
  const filterChanged = sig !== lastFilterSig;
  lastFilterSig = sig;

  // Remember how the accordions were arranged before filtering so clearing the
  // filters restores that view instead of leaving all 18 topics hanging open.
  if (filtersActive && filterChanged && !preFilterOpenState) {
    preFilterOpenState = new Map();
    document.querySelectorAll("details.topic, details.pattern").forEach((d) => preFilterOpenState.set(d, d.open));
  }

  let visibleCount = 0;
  document.querySelectorAll(".problem-row").forEach((row) => {
    const matchesText = !q || row.dataset.question.includes(q);
    const matchesDiff = diff === "All" || row.dataset.difficulty === diff;
    const matchesImportance = importance === "All" || row.dataset.importance === importance;
    const matchesFreq = freq === "All" || row.dataset.freq === freq;
    const matchesCompleted = !hideCompleted || !row.classList.contains("done");
    const matchesRevise = !reviseOnly || row.dataset.revise === "1";
    const visible = matchesText && matchesDiff && matchesImportance && matchesFreq && matchesCompleted && matchesRevise;
    if (visible) visibleCount++;
    row.classList.toggle("filtered-out", !visible);
  });

  document.querySelectorAll("details.pattern").forEach((pat) => {
    const anyVisible = Array.from(pat.querySelectorAll(".problem-row")).some((r) => !r.classList.contains("filtered-out"));
    pat.classList.toggle("filtered-out", !anyVisible);
    if (filtersActive && filterChanged && anyVisible) pat.open = true;
  });

  document.querySelectorAll("details.topic").forEach((topic) => {
    const anyVisible = Array.from(topic.querySelectorAll("details.pattern")).some((p) => !p.classList.contains("filtered-out"));
    topic.classList.toggle("filtered-out", !anyVisible);
    if (filtersActive && filterChanged && anyVisible) topic.open = true;
  });

  if (!filtersActive && preFilterOpenState) {
    preFilterOpenState.forEach((wasOpen, d) => { d.open = wasOpen; });
    preFilterOpenState = null;
  }

  document.getElementById("noResults").hidden = visibleCount > 0;
}

function mutateProblem(id, patch) {
  const store = loadStore();
  store.problems[id] = { ...getState(store, id), ...patch };
  saveStore(store);
  return store;
}

document.getElementById("topics").addEventListener("change", (e) => {
  if (!e.target.classList.contains("done-cb")) return;
  const row = e.target.closest(".problem-row");
  const done = e.target.checked;
  const store = mutateProblem(row.dataset.id, { done, completedAt: done ? todayISO() : null });
  row.classList.toggle("done", done);
  updateProgress(store);
  applyFilters();
});

document.getElementById("topics").addEventListener("click", (e) => {
  const starBtn = e.target.closest(".star-btn");
  if (starBtn) {
    const row = starBtn.closest(".problem-row");
    const revise = !getState(loadStore(), row.dataset.id).revise;
    const store = mutateProblem(row.dataset.id, { revise, revisedAt: revise ? todayISO() : null });
    starBtn.classList.toggle("active", revise);
    starBtn.setAttribute("aria-pressed", revise ? "true" : "false");
    starBtn.title = revise ? "Unmark for revision" : "Mark for revision";
    row.dataset.revise = revise ? "1" : "0";
    renderAnalytics(store);
    renderHeatmap(store);
    applyFilters();
    return;
  }
  const notesBtn = e.target.closest(".notes-btn");
  if (notesBtn) {
    notesBtn.closest(".q-main").querySelector(".detail-panel").classList.toggle("open");
  }
});

document.getElementById("topics").addEventListener("focusout", (e) => {
  if (e.target.tagName !== "TEXTAREA") return;
  const row = e.target.closest(".problem-row");
  mutateProblem(row.dataset.id, { notes: e.target.value });
});

function showHeatmapTip(cell) {
  const tipEl = document.getElementById("heatmapTip");
  const card = document.getElementById("dashboard");
  tipEl.textContent = cell.dataset.tip;
  tipEl.hidden = false;
  const cellBox = cell.getBoundingClientRect();
  const cardBox = card.getBoundingClientRect();
  const left = cellBox.left - cardBox.left + cellBox.width / 2 - tipEl.offsetWidth / 2;
  const maxLeft = cardBox.width - tipEl.offsetWidth - 4;
  tipEl.style.left = Math.max(4, Math.min(left, maxLeft)) + "px";
  tipEl.style.top = cellBox.top - cardBox.top - tipEl.offsetHeight - 6 + "px";
}

function hideHeatmapTip() {
  document.getElementById("heatmapTip").hidden = true;
}

const heatmapGridEl = document.getElementById("heatmapGrid");
heatmapGridEl.addEventListener("pointerover", (e) => {
  const cell = e.target.closest(".heatmap-day[data-tip]");
  if (cell) showHeatmapTip(cell);
});
heatmapGridEl.addEventListener("pointerleave", hideHeatmapTip);
heatmapGridEl.addEventListener("focusin", (e) => {
  const cell = e.target.closest(".heatmap-day[data-tip]");
  if (cell) showHeatmapTip(cell);
});
heatmapGridEl.addEventListener("focusout", hideHeatmapTip);
// Touch: no hover exists, so a tap has to both show and pin the tip.
heatmapGridEl.addEventListener("click", (e) => {
  const cell = e.target.closest(".heatmap-day[data-tip]");
  if (cell) showHeatmapTip(cell);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#heatmapGrid")) hideHeatmapTip();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideHeatmapTip();
});

document.getElementById("continueBtn").addEventListener("click", (e) => {
  jumpToProblem(e.currentTarget.dataset.target);
});

document.getElementById("heatmapPrevYear").addEventListener("click", () => {
  const store = loadStore();
  if (heatmapYearOffset >= Math.max(earliestYearOffset(store), 1)) return;
  heatmapYearOffset++;
  renderHeatmap(store);
});

document.getElementById("heatmapNextYear").addEventListener("click", () => {
  if (heatmapYearOffset === 0) return;
  heatmapYearOffset--;
  renderHeatmap(loadStore());
});

document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyFilters();
  });
});
document.getElementById("search").addEventListener("input", applyFilters);
document.getElementById("hideCompleted").addEventListener("change", applyFilters);
document.getElementById("reviseOnly").addEventListener("change", applyFilters);
document.getElementById("importanceFilter").addEventListener("change", applyFilters);
document.getElementById("freqFilter").addEventListener("change", applyFilters);

// <details> hides its content when closed regardless of display, so the
// disclosure has to be forced open on wide screens where it renders inline.
const filterMq = window.matchMedia("(max-width: 700px)");
function syncFilterDisclosure() {
  document.getElementById("filterDisclosure").open = !filterMq.matches;
}
filterMq.addEventListener("change", syncFilterDisclosure);
syncFilterDisclosure();

document.getElementById("clearFilters").addEventListener("click", () => {
  document.getElementById("search").value = "";
  document.getElementById("hideCompleted").checked = false;
  document.getElementById("reviseOnly").checked = false;
  document.getElementById("importanceFilter").value = "All";
  document.getElementById("freqFilter").value = "All";
  document.querySelectorAll(".diff-btn").forEach((b) => b.classList.toggle("active", b.dataset.diff === "All"));
  applyFilters();
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importInput").click();
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(loadStore(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  // Date-stamped so a folder of backups is tellable apart when it matters most.
  a.download = `dsa-tracker-progress-${todayISO()}.json`;
  a.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
});

function isValidStore(parsed) {
  return !!parsed && typeof parsed === "object" && !Array.isArray(parsed)
    && !!parsed.problems && typeof parsed.problems === "object" && !Array.isArray(parsed.problems);
}

function countDoneInStore(store) {
  return Object.values(store.problems).filter((st) => st && st.done).length;
}

document.getElementById("importInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      alert("That file isn't valid JSON, so nothing was changed.");
      return;
    }
    if (!isValidStore(parsed)) {
      alert("That doesn't look like a DSA Tracker backup — it has no \"problems\" data. Nothing was changed.");
      return;
    }
    const current = loadStore();
    const currentDone = countDoneInStore(current);
    const incomingDone = countDoneInStore(parsed);
    if (currentDone > 0) {
      const ok = confirm(
        "Replace your current progress?\n\n" +
        `Now:  ${currentDone} solved\n` +
        `File: ${incomingDone} solved\n\n` +
        "Your current progress will be kept as a one-time backup you can recover with Undo import."
      );
      if (!ok) return;
      localStorage.setItem(BACKUP_KEY, JSON.stringify(current));
    }
    saveStore(parsed);
    render();
  };
  reader.readAsText(file);
  e.target.value = "";
});

// ISO dates sort lexically, so the earliest is just the smaller string.
function earlierDate(a, b) {
  if (a && b) return a < b ? a : b;
  return a || b || null;
}

function mergeNotes(a, b) {
  const left = (a || "").trim();
  const right = (b || "").trim();
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  return `${left}\n\n--- merged ---\n\n${right}`;
}

// Union merge: a problem is solved if either copy says so, so merging can only
// ever add progress. Never un-solves anything and never drops a note.
function mergeStores(local, incoming) {
  const merged = { version: 1, problems: {} };
  const ids = new Set([...Object.keys(local.problems), ...Object.keys(incoming.problems)]);
  ids.forEach((id) => {
    const a = local.problems[id] || {};
    const b = incoming.problems[id] || {};
    const done = !!(a.done || b.done);
    const revise = !!(a.revise || b.revise);
    merged.problems[id] = {
      done,
      revise,
      notes: mergeNotes(a.notes, b.notes),
      // Keep the invariant the rest of the app relies on: no date without the flag.
      completedAt: done ? earlierDate(a.completedAt, b.completedAt) : null,
      revisedAt: revise ? earlierDate(a.revisedAt, b.revisedAt) : null,
    };
  });
  return merged;
}

function summarizeMerge(local, merged) {
  let newlySolved = 0, newlyRevised = 0, notesCombined = 0;
  Object.keys(merged.problems).forEach((id) => {
    const before = local.problems[id] || {};
    const after = merged.problems[id];
    if (after.done && !before.done) newlySolved++;
    if (after.revise && !before.revise) newlyRevised++;
    if (after.notes && after.notes !== (before.notes || "")) notesCombined++;
  });
  return { newlySolved, newlyRevised, notesCombined };
}

document.getElementById("mergeBtn").addEventListener("click", () => {
  document.getElementById("mergeInput").click();
});

document.getElementById("mergeInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      alert("That file isn't valid JSON, so nothing was changed.");
      return;
    }
    if (!isValidStore(parsed)) {
      alert("That doesn't look like a DSA Tracker backup — it has no \"problems\" data. Nothing was changed.");
      return;
    }
    const current = loadStore();
    const merged = mergeStores(current, parsed);
    const { newlySolved, newlyRevised, notesCombined } = summarizeMerge(current, merged);
    if (!newlySolved && !newlyRevised && !notesCombined) {
      alert("That file adds nothing new — everything in it is already tracked here.");
      return;
    }
    const ok = confirm(
      "Merge this backup into your progress?\n\n" +
      `Newly solved:   ${newlySolved}\n` +
      `Newly starred:  ${newlyRevised}\n` +
      `Notes combined: ${notesCombined}\n\n` +
      `Solved after merge: ${countDoneInStore(merged)} (currently ${countDoneInStore(current)})\n\n` +
      "Nothing already solved will be un-solved. You can still Undo import afterwards."
    );
    if (!ok) return;
    localStorage.setItem(BACKUP_KEY, JSON.stringify(current));
    saveStore(merged);
    render();
  };
  reader.readAsText(file);
  e.target.value = "";
});

document.getElementById("undoImportBtn").addEventListener("click", () => {
  const raw = localStorage.getItem(BACKUP_KEY);
  if (!raw) return;
  let backup;
  try {
    backup = JSON.parse(raw);
  } catch (err) {
    return;
  }
  if (!isValidStore(backup)) return;
  if (!confirm(`Restore your progress from before the last import (${countDoneInStore(backup)} solved)?`)) return;
  saveStore(backup);
  localStorage.removeItem(BACKUP_KEY);
  render();
});

function updateUndoImportVisibility() {
  document.getElementById("undoImportBtn").hidden = !localStorage.getItem(BACKUP_KEY);
}

function selfTest() {
  const fixture = [{ id: "x1" }, { id: "x2" }, { id: "x3" }];
  const store = { problems: { x1: { done: true }, x3: { done: true } } };
  console.assert(countDone(fixture, store) === 2, "countDone smoke test failed");
}
selfTest();
render();
