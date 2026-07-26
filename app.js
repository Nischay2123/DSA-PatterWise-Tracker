const STORE_KEY = "dsa-tracker-progress";
const ALL_PROBLEMS = DATA.topics.flatMap((t) => t.patterns.flatMap((p) => p.problems));

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (parsed && parsed.problems) return parsed;
  } catch (e) {}
  return { version: 1, problems: {} };
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function getState(store, id) {
  return store.problems[id] || { done: false, revise: false, notes: "" };
}

function countDone(problems, store) {
  return problems.reduce((n, p) => n + (getState(store, p.id).done ? 1 : 0), 0);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function renderProblem(p, store) {
  const st = getState(store, p.id);
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
    <div class="problem-row ${st.done ? "done" : ""}" data-id="${p.id}" data-difficulty="${p.difficulty}" data-importance="${p.importance}" data-freq="${p.interviewFreq}" data-question="${esc(p.question.toLowerCase())}">
      <input type="checkbox" class="done-cb" ${st.done ? "checked" : ""}>
      <div class="q-main">
        <div class="q-line">
          ${qHtml}
          <span class="badge ${p.difficulty}">${p.difficulty}</span>
          <button class="star-btn ${st.revise ? "active" : ""}" title="Mark for revision">&#9733;</button>
          <button class="notes-btn">notes</button>
        </div>
        <div class="detail-panel">
          <div class="meta-text">${esc(meta)}</div>
          <textarea placeholder="Notes...">${esc(st.notes)}</textarea>
        </div>
      </div>
    </div>`;
}

function renderPattern(pattern, store) {
  const rows = pattern.problems.map((p) => renderProblem(p, store)).join("");
  return `
    <details class="pattern" data-pattern="${pattern.id}">
      <summary>${esc(pattern.name)} <span data-pattern-progress="${pattern.id}"></span></summary>
      <div class="pattern-body">${rows}</div>
    </details>`;
}

function renderTopic(topic, store) {
  const patterns = topic.patterns.map((p) => renderPattern(p, store)).join("");
  return `
    <details class="topic" data-topic="${topic.id}">
      <summary>${esc(topic.name)} <span class="topic-progress" data-topic-progress="${topic.id}"></span></summary>
      ${patterns}
    </details>`;
}

function render() {
  const store = loadStore();
  document.getElementById("topics").innerHTML = DATA.topics.map((t) => renderTopic(t, store)).join("");
  updateProgress(store);
  applyFilters();
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
  });
  const pct = overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0;
  document.getElementById("overallFill").style.width = pct + "%";
  document.getElementById("overallLabel").textContent = `${overallDone}/${overallTotal} (${pct}%)`;
  renderAnalytics(store);
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

function applyFilters() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const diff = document.querySelector(".diff-btn.active").dataset.diff;
  const importance = document.getElementById("importanceFilter").value;
  const freq = document.getElementById("freqFilter").value;
  const hideCompleted = document.getElementById("hideCompleted").checked;
  const filtersActive = !!q || diff !== "All" || importance !== "All" || freq !== "All";

  document.querySelectorAll(".problem-row").forEach((row) => {
    const matchesText = !q || row.dataset.question.includes(q);
    const matchesDiff = diff === "All" || row.dataset.difficulty === diff;
    const matchesImportance = importance === "All" || row.dataset.importance === importance;
    const matchesFreq = freq === "All" || row.dataset.freq === freq;
    const matchesCompleted = !hideCompleted || !row.classList.contains("done");
    row.classList.toggle("filtered-out", !(matchesText && matchesDiff && matchesImportance && matchesFreq && matchesCompleted));
  });

  document.querySelectorAll("details.pattern").forEach((pat) => {
    const anyVisible = Array.from(pat.querySelectorAll(".problem-row")).some((r) => !r.classList.contains("filtered-out"));
    pat.classList.toggle("filtered-out", !anyVisible);
    if (filtersActive && anyVisible) pat.open = true;
  });

  document.querySelectorAll("details.topic").forEach((topic) => {
    const anyVisible = Array.from(topic.querySelectorAll("details.pattern")).some((p) => !p.classList.contains("filtered-out"));
    topic.classList.toggle("filtered-out", !anyVisible);
    if (filtersActive && anyVisible) topic.open = true;
  });
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
  const store = mutateProblem(row.dataset.id, { done: e.target.checked });
  row.classList.toggle("done", e.target.checked);
  updateProgress(store);
  applyFilters();
});

document.getElementById("topics").addEventListener("click", (e) => {
  const starBtn = e.target.closest(".star-btn");
  if (starBtn) {
    const row = starBtn.closest(".problem-row");
    const revise = !getState(loadStore(), row.dataset.id).revise;
    const store = mutateProblem(row.dataset.id, { revise });
    starBtn.classList.toggle("active", revise);
    renderAnalytics(store);
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

document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyFilters();
  });
});
document.getElementById("search").addEventListener("input", applyFilters);
document.getElementById("hideCompleted").addEventListener("change", applyFilters);
document.getElementById("importanceFilter").addEventListener("change", applyFilters);
document.getElementById("freqFilter").addEventListener("change", applyFilters);

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(loadStore(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dsa-tracker-progress.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("importInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      saveStore(JSON.parse(reader.result));
      render();
    } catch (err) {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

function selfTest() {
  const fixture = [{ id: "x1" }, { id: "x2" }, { id: "x3" }];
  const store = { problems: { x1: { done: true }, x3: { done: true } } };
  console.assert(countDone(fixture, store) === 2, "countDone smoke test failed");
}
selfTest();
render();
