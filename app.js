// =======================
// 状態
// =======================
const state = {
  allQuestions: [],
  questions: [],
  answers: {},
  currentIndex: 0
};

// =======================
// 初期化
// =======================
async function init() {
  const res = await fetch("data/questions.json");
  state.allQuestions = await res.json();

  document.getElementById("start-btn").addEventListener("click", startExam);
  document.getElementById("next-btn").addEventListener("click", nextQuestion);
  document.getElementById("back-to-start-btn").addEventListener("click", backToStart);
}

window.onload = init;

// =======================
// 試験開始
// =======================
function startExam() {
  const year = document.querySelector('input[name="year"]:checked').value;
  const format = document.querySelector('input[name="format"]:checked').value;

  const config = getFormatConfig(format);

  state.questions = buildExam(state.allQuestions, year, config);
  state.answers = {};
  state.currentIndex = 0;

  showScreen("screen-quiz");
  renderQuestion();
}

// =======================
// 出題形式
// =======================
function getFormatConfig(format) {
  switch (format) {
    case "full": return { choice: 45, short: 5, cloze: 0 };
    case "mid": return { choice: 22, short: 3, cloze: 0 };
    case "small1": return { choice: 10, short: 2, cloze: 0 };
    case "small2": return { choice: 4, short: 1, cloze: 0 };
    case "choice10": return { choice: 10, short: 0, cloze: 0 };
    case "choice5": return { choice: 5, short: 0, cloze: 0 };
    case "short5": return { choice: 0, short: 5, cloze: 0 };
    case "short2": return { choice: 0, short: 2, cloze: 0 };
    case "choice1": return { choice: 1, short: 0, cloze: 0 };
    case "short1": return { choice: 0, short: 1, cloze: 0 };
  }
}

// =======================
// 出題生成
// =======================
function buildExam(all, year, config) {
  const pool = year === "all" ? all : all.filter(q => q.year == year);

  return shuffle([
    ...pick(pool, "choice", config.choice),
    ...pick(pool, "short", config.short),
    ...pick(pool, "cloze", config.cloze)
  ]);
}

function pick(pool, type, n) {
  const filtered = pool.filter(q => q.type === type);
  return shuffle(filtered).slice(0, n);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// =======================
// 問題表示
// =======================
function renderQuestion() {
  const q = state.questions[state.currentIndex];

  document.getElementById("question-counter").textContent =
    `問題 ${state.currentIndex + 1} / ${state.questions.length}`;

  document.getElementById("question-image").src = q.image;

  // 論述テキスト
  const clozeText = document.getElementById("cloze-text");
  clozeText.innerHTML = "";
  if (q.type === "cloze") {
    clozeText.innerHTML = `<p>${q.instruction || ""}</p><p>${q.promptText}</p>`;
  }

  // 回答エリア
  const area = document.getElementById("answer-area");
  area.innerHTML = "";

  if (q.type === "choice") {
    renderChoice(area, q);
  }

  if (q.type === "short") {
    renderShort(area, q);
  }

  if (q.type === "cloze") {
    renderCloze(area, q);
  }

  restoreAnswer(q);
}

// =======================
// UI生成
// =======================
function renderChoice(area, q) {
  const div = document.createElement("div");
  div.className = "d-grid gap-2";

  ["1", "2", "3", "4"].forEach(num => {
    const btn = document.createElement("button");
    btn.className = "btn btn-outline-light btn-lg";
    btn.textContent = ["①","②","③","④"][num-1];

    btn.onclick = () => {
      state.answers[q.id] = num;
      highlightChoice(div, num);
    };

    div.appendChild(btn);
  });

  area.appendChild(div);
}

function highlightChoice(div, selected) {
  [...div.children].forEach((btn, i) => {
    btn.classList.toggle("btn-light", String(i+1) === selected);
    btn.classList.toggle("btn-outline-light", String(i+1) !== selected);
  });
}

function renderShort(area, q) {
  const input = document.createElement("input");
  input.className = "form-control form-control-lg";
  input.oninput = e => {
    state.answers[q.id] = e.target.value;
  };
  area.appendChild(input);
}

function renderCloze(area, q) {
  q.blanks.forEach(b => {
    const label = document.createElement("label");
    label.textContent = b.label;

    const input = document.createElement("input");
    input.className = "form-control mb-2";
    input.oninput = e => {
      if (!state.answers[q.id]) state.answers[q.id] = {};
      state.answers[q.id][b.label] = e.target.value;
    };

    area.appendChild(label);
    area.appendChild(input);
  });
}

// =======================
// 回答復元
// =======================
function restoreAnswer(q) {
  const ans = state.answers[q.id];
  if (!ans) return;

  if (q.type === "choice") {
    highlightChoice(document.querySelector("#answer-area > div"), ans);
  }

  if (q.type === "short") {
    document.querySelector("#answer-area input").value = ans;
  }

  if (q.type === "cloze") {
    const inputs = document.querySelectorAll("#answer-area input");
    q.blanks.forEach((b, i) => {
      inputs[i].value = ans[b.label] || "";
    });
  }
}

// =======================
// 次へ
// =======================
function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    renderQuestion();
  } else {
    showResult();
  }
}

// =======================
// 採点
// =======================
function normalize(s) {
  return String(s || "").trim();
}

function judge(q, ans) {
  if (!ans) return false;

  if (q.type === "choice") {
    return normalize(ans) === normalize(q.answer);
  }

  if (q.type === "short") {
    return normalize(ans) === normalize(q.answer);
  }

  if (q.type === "cloze") {
    return q.blanks.every(b =>
      normalize(ans[b.label]) === normalize(b.answer)
    );
  }
}

// =======================
// 結果表示
// =======================
function showResult() {
  showScreen("screen-result");

  let correct = 0;

  const table = document.getElementById("result-table");
  const cards = document.getElementById("result-cards");

  table.innerHTML = "";
  cards.innerHTML = "";

  state.questions.forEach((q, i) => {
    const ans = state.answers[q.id];
    const ok = judge(q, ans);

    if (ok) correct++;

    const correctText = getCorrectText(q);
    const userText = getUserText(q, ans);

    // ===== PC 表 =====
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>
        <div class="mb-2">${q.year}年 第${q.questionNumber}問</div>
        <img src="${q.image}" class="result-image-pc img-fluid">
      </td>
      <td>${correctText}</td>
      <td>${userText}</td>
      <td class="${ok ? "correct" : "incorrect"}">${ok ? "○" : "×"}</td>
    `;
    table.appendChild(tr);

    // ===== スマホカード =====
    const card = document.createElement("div");
    card.className = "card bg-secondary mb-3";
    card.innerHTML = `
      <div class="card-body">
        <h6>${q.year}年 第${q.questionNumber}問</h6>
        <img src="${q.image}" class="img-fluid mb-3 result-image-mobile">
        <div class="mb-1"><strong>正解：</strong>${correctText}</div>
        <div class="mb-1"><strong>あなたの答え：</strong>${userText}</div>
        <div><strong>判定：</strong><span class="${ok ? "correct" : "incorrect"}">${ok ? "○" : "×"}</span></div>
      </div>
    `;
    cards.appendChild(card);
  });

  document.getElementById("score").textContent =
    `得点：${correct} / ${state.questions.length}`;
}

// =======================
// 表示用変換
// =======================
function getCorrectText(q) {
  if (q.type === "choice") return ["①","②","③","④"][q.answer-1];
  if (q.type === "short") return q.answer;
  if (q.type === "cloze") {
    return q.blanks.map(b => `${b.label}:${b.answer}`).join(" / ");
  }
}

function getUserText(q, ans) {
  if (!ans) return "-";

  if (q.type === "choice") return ["①","②","③","④"][ans-1];
  if (q.type === "short") return ans;
  if (q.type === "cloze") {
    return q.blanks.map(b => `${b.label}:${ans[b.label] || "-"}`).join(" / ");
  }
}

// =======================
// 画面切り替え
// =======================
function showScreen(id) {
  ["screen-start", "screen-quiz", "screen-result"]
    .forEach(s => document.getElementById(s).classList.add("d-none"));

  document.getElementById(id).classList.remove("d-none");
}

// =======================
// 戻る処理
// =======================
function backToStart() {
  state.questions = [];
  state.answers = {};
  state.currentIndex = 0;
  showScreen("screen-start");
}
