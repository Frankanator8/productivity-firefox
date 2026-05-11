const TOTAL_PROBLEMS = 10;

const views = {
  locked: document.getElementById("locked-view"),
  unblocked: document.getElementById("unblocked-view"),
  gauntlet: document.getElementById("gauntlet-view"),
  duration: document.getElementById("duration-view"),
};
const statusEl = document.getElementById("status");
const timeLeftEl = document.getElementById("time-left");
const aEl = document.getElementById("a");
const bEl = document.getElementById("b");
const answerEl = document.getElementById("answer");
const progressEl = document.getElementById("progress");
const feedbackEl = document.getElementById("feedback");

let state = { unblockedUntil: 0 };
let countdownTimer = null;
let problems = [];
let problemIdx = 0;

function show(name) {
  for (const k of Object.keys(views)) views[k].hidden = k !== name;
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function render() {
  const now = Date.now();
  const isUnblocked = state.unblockedUntil > now;
  if (isUnblocked) {
    statusEl.textContent = "unblocked";
    timeLeftEl.textContent = fmt(state.unblockedUntil - now);
    show("unblocked");
  } else {
    statusEl.textContent = "blocked";
    show("locked");
  }
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(async () => {
    if (!state.unblockedUntil) return;
    if (Date.now() >= state.unblockedUntil) {
      state.unblockedUntil = 0;
      render();
    } else if (!views.unblocked.hidden) {
      timeLeftEl.textContent = fmt(state.unblockedUntil - Date.now());
    }
  }, 500);
}

function rand2() {
  return 10 + Math.floor(Math.random() * 90);
}

function buildProblems() {
  problems = [];
  for (let i = 0; i < TOTAL_PROBLEMS; i++) {
    problems.push([rand2(), rand2()]);
  }
  problemIdx = 0;
}

function showProblem() {
  const [a, b] = problems[problemIdx];
  aEl.textContent = a;
  bEl.textContent = b;
  progressEl.textContent = problemIdx + 1;
  answerEl.value = "";
  feedbackEl.textContent = "";
  answerEl.focus();
}

function startGauntlet() {
  buildProblems();
  show("gauntlet");
  showProblem();
}

function checkAnswer() {
  const [a, b] = problems[problemIdx];
  const v = Number(answerEl.value);
  if (!Number.isFinite(v) || answerEl.value.trim() === "") return;
  if (v === a + b) {
    problemIdx++;
    if (problemIdx >= TOTAL_PROBLEMS) {
      show("duration");
    } else {
      showProblem();
    }
  } else {
    feedbackEl.textContent = "Wrong — try again.";
    answerEl.value = "";
    answerEl.focus();
  }
}

answerEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    checkAnswer();
  }
});

document.getElementById("start-unblock").addEventListener("click", startGauntlet);
document.getElementById("cancel-gauntlet").addEventListener("click", render);
document.getElementById("lock-now").addEventListener("click", async () => {
  const res = await browser.runtime.sendMessage({ type: "lock" });
  state.unblockedUntil = res?.unblockedUntil || 0;
  render();
});

for (const btn of document.querySelectorAll(".durations button")) {
  btn.addEventListener("click", async () => {
    const minutes = Number(btn.dataset.min);
    const res = await browser.runtime.sendMessage({
      type: "grantUnblock",
      minutes,
    });
    state.unblockedUntil = res?.unblockedUntil || 0;
    render();
  });
}

(async function init() {
  const res = await browser.runtime.sendMessage({ type: "getState" });
  state.unblockedUntil = res?.unblockedUntil || 0;
  render();
  startCountdown();
})();
