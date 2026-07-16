// =======================
// 設定
// =======================
const CHOICE_MARKERS = ["1", "2", "3", "4"];

const TYPE_LABELS = {
  choice: "四択",
  short: "記述",
  cloze: "論述"
};

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
  try {
    const response = await fetch("data/questions.json");

    if (!response.ok) {
      throw new Error(`questions.json の読込に失敗しました（HTTP ${response.status}）`);
    }

    const questions = await response.json();

    if (!Array.isArray(questions)) {
      throw new Error("questions.json の形式が配列ではありません。");
    }

    state.allQuestions = questions;

    document.getElementById("start-btn").addEventListener("click", startExam);
    document.getElementById("next-btn").addEventListener("click", nextQuestion);
    document.getElementById("back-to-start-btn").addEventListener("click", backToStart);
    document.addEventListener("keydown", handleQuizKeydown);
  } catch (error) {
    showStartError(error.message || "問題データを読み込めませんでした。");
    document.getElementById("start-btn").disabled = true;
    console.error(error);
  }
}

window.addEventListener("DOMContentLoaded", init);

// =======================
// 試験開始
// =======================
function startExam() {
  clearStartError();

  const year = document.querySelector('input[name="year"]:checked')?.value;
  const format = document.querySelector('input[name="format"]:checked')?.value;

  if (!year || !format) {
    showStartError("出題年度と出題形式を選択してください。");
    return;
  }

  const config = getFormatConfig(format);
  const questions = buildExam(state.allQuestions, year, config);

  if (questions.length === 0) {
    showStartError("選択した条件に該当する問題がありません。");
    return;
  }

  state.questions = questions;
  state.answers = {};
  state.currentIndex = 0;

  showScreen("screen-quiz");
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =======================
// 出題形式
// =======================
function getFormatConfig(format) {
  switch (format) {
    case "mid":
      return { choice: 22, short: 3, cloze: 0 };
    case "small1":
      return { choice: 10, short: 2, cloze: 0 };
    case "small2":
      return { choice: 4, short: 1, cloze: 0 };
    case "choice10":
      return { choice: 10, short: 0, cloze: 0 };
    case "choice5":
      return { choice: 5, short: 0, cloze: 0 };
    case "short5":
      return { choice: 0, short: 5, cloze: 0 };
    case "short2":
      return { choice: 0, short: 2, cloze: 0 };
    case "choice1":
      return { choice: 1, short: 0, cloze: 0 };
    case "short1":
      return { choice: 0, short: 1, cloze: 0 };
    default:
      return { choice: 0, short: 0, cloze: 0 };
  }
}

// =======================
// 出題生成
// =======================
function buildExam(allQuestions, year, config) {
  const pool =
    year === "all"
      ? allQuestions
      : allQuestions.filter(question => String(question.year) === String(year));

  return shuffle([
    ...pick(pool, "choice", config.choice),
    ...pick(pool, "short", config.short),
    ...pick(pool, "cloze", config.cloze)
  ]);
}

function pick(pool, type, count) {
  const filtered = pool.filter(question => question.type === type);
  return shuffle(filtered).slice(0, count);
}

// Fisher-Yates shuffle
function shuffle(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}

// =======================
// 問題表示
// =======================
function renderQuestion() {
  const question = state.questions[state.currentIndex];
  const total = state.questions.length;
  const current = state.currentIndex + 1;

  document.getElementById("question-meta").textContent =
    `${question.year}年　第${question.questionNumber}問　${TYPE_LABELS[question.type] || ""}`;

  document.getElementById("question-counter").textContent =
    `${current} / ${total}`;

  updateProgress(current, total);

  const image = document.getElementById("question-image");
  image.src = question.image;
  image.alt = `${question.year}年 第${question.questionNumber}問の問題画像`;

  renderClozeText(question);

  const answerArea = document.getElementById("answer-area");
  answerArea.innerHTML = "";

  if (question.type === "choice") {
    renderChoice(answerArea, question);
  } else if (question.type === "short") {
    renderShort(answerArea, question);
  } else if (question.type === "cloze") {
    renderCloze(answerArea, question);
  }

  restoreAnswer(question);
  updateQuizHint(question.type);

  const nextButton = document.getElementById("next-btn");
  nextButton.textContent =
    state.currentIndex === total - 1 ? "結果を見る" : "次へ";

  updateNextButtonState(question);
}

function updateProgress(current, total) {
  const percent = Math.round(((current - 1) / total) * 100);

  document.getElementById("progress-fill").style.width = `${percent}%`;
  document.getElementById("progress-bar").setAttribute("aria-valuenow", String(percent));
}

function renderClozeText(question) {
  const area = document.getElementById("cloze-text");
  area.innerHTML = "";

  if (question.type !== "cloze") {
    area.hidden = true;
    return;
  }

  area.hidden = false;

  if (question.instruction) {
    const instruction = document.createElement("p");
    instruction.className = "cloze-instruction";
    instruction.textContent = question.instruction;
    area.appendChild(instruction);
  }

  if (question.promptText) {
    const prompt = document.createElement("p");
    prompt.className = "cloze-prompt";
    prompt.textContent = question.promptText;
    area.appendChild(prompt);
  }
}

// =======================
// 四択UI
// =======================
function renderChoice(area, question) {
  ["1", "2", "3", "4"].forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.dataset.choice = choice;
    button.setAttribute("aria-pressed", "false");

    const marker = document.createElement("span");
    marker.className = "choice-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = CHOICE_MARKERS[index];

    const text = document.createElement("span");
    text.className = "choice-text";
    text.textContent = `選択肢 ${toCircledNumber(choice)}`;

    button.append(marker, text);

    button.addEventListener("click", () => {
      state.answers[question.id] = choice;
      highlightChoice(area, choice);
      updateNextButtonState(question);
    });

    area.appendChild(button);
  });
}

function toCircledNumber(value) {
  return ["①", "②", "③", "④"][Number(value) - 1] || value;
}

function highlightChoice(container, selectedChoice) {
  [...container.querySelectorAll(".choice-btn")].forEach(button => {
    const selected = button.dataset.choice === String(selectedChoice);

    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

// =======================
// 記述UI
// =======================
function renderShort(area, question) {
  const label = document.createElement("label");
  label.className = "input-label";
  label.setAttribute("for", `answer-${question.id}`);
  label.textContent = "解答";

  const input = document.createElement("input");
  input.id = `answer-${question.id}`;
  input.type = "text";
  input.className = "answer-input";
  input.autocomplete = "off";
  input.placeholder = "解答を入力";

  input.addEventListener("input", event => {
    state.answers[question.id] = event.target.value;
    updateNextButtonState(question);
  });

  area.append(label, input);
}

// =======================
// 論述UI（将来データに含まれた場合にも対応）
// =======================
function renderCloze(area, question) {
  const blanks = Array.isArray(question.blanks) ? question.blanks : [];

  blanks.forEach((blank, index) => {
    const field = document.createElement("div");
    field.className = "cloze-field";

    const label = document.createElement("label");
    label.className = "input-label";
    label.setAttribute("for", `blank-${question.id}-${index}`);
    label.textContent = blank.label;

    const input = document.createElement("input");
    input.id = `blank-${question.id}-${index}`;
    input.type = "text";
    input.className = "answer-input";
    input.autocomplete = "off";
    input.placeholder = `${blank.label}を入力`;

    input.addEventListener("input", event => {
      if (!state.answers[question.id]) {
        state.answers[question.id] = {};
      }

      state.answers[question.id][blank.label] = event.target.value;
      updateNextButtonState(question);
    });

    field.append(label, input);
    area.appendChild(field);
  });
}

// =======================
// 回答復元
// =======================
function restoreAnswer(question) {
  const answer = state.answers[question.id];

  if (answer === undefined) {
    return;
  }

  if (question.type === "choice") {
    highlightChoice(document.getElementById("answer-area"), answer);
    return;
  }

  if (question.type === "short") {
    const input = document.querySelector("#answer-area input");

    if (input) {
      input.value = answer;
    }

    return;
  }

  if (question.type === "cloze") {
    const inputs = document.querySelectorAll("#answer-area input");
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];

    blanks.forEach((blank, index) => {
      if (inputs[index]) {
        inputs[index].value = answer?.[blank.label] || "";
      }
    });
  }
}

function updateQuizHint(type) {
  const hint = document.getElementById("quiz-hint");

  if (type === "choice") {
    hint.textContent = "キー 1〜4 で選択 ／ 次へはボタン";
  } else {
    hint.textContent = "解答を入力して「次へ」を押してください";
  }
}

// =======================
// 回答済み判定・「次へ」制御
// =======================
function isQuestionAnswered(question) {
  const answer = state.answers[question.id];

  if (question.type === "choice") {
    return answer !== undefined && answer !== null && answer !== "";
  }

  if (question.type === "short") {
    return normalize(answer) !== "";
  }

  // 2級には論述問題はないが、将来データに含まれた場合の保険
  if (question.type === "cloze") {
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];

    return (
      blanks.length > 0 &&
      blanks.every(blank => normalize(answer?.[blank.label]) !== "")
    );
  }

  return false;
}

function updateNextButtonState(question) {
  const nextButton = document.getElementById("next-btn");
  nextButton.disabled = !isQuestionAnswered(question);
}

// =======================
// キーボード操作
// 四択の数字キー1〜4だけを扱う。
// Enterは日本語変換・確定に使うため、画面遷移には使用しない。
// =======================
function handleQuizKeydown(event) {
  const quizScreen = document.getElementById("screen-quiz");

  if (
    quizScreen.hidden ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing
  ) {
    return;
  }

  const question = state.questions[state.currentIndex];

  if (!question || question.type !== "choice") {
    return;
  }

  const activeElement = document.activeElement;
  const isEditing =
    activeElement?.tagName === "INPUT" ||
    activeElement?.tagName === "TEXTAREA" ||
    activeElement?.isContentEditable;

  if (isEditing) {
    return;
  }

  const keyIndex = ["1", "2", "3", "4"].indexOf(event.key);

  if (keyIndex === -1) {
    return;
  }

  const buttons = document.querySelectorAll("#answer-area .choice-btn");

  if (buttons[keyIndex]) {
    buttons[keyIndex].click();
    event.preventDefault();
  }
}

// =======================
// 次へ
// =======================
function nextQuestion() {
  const question = state.questions[state.currentIndex];

  if (!question || !isQuestionAnswered(question)) {
    return;
  }

  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex += 1;
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  showResult();
}

// =======================
// 採点
// =======================
function normalize(value) {
  return String(value ?? "").trim();
}

function judge(question, answer) {
  if (answer === undefined || answer === null || answer === "") {
    return false;
  }

  if (question.type === "choice") {
    return normalize(answer) === normalize(question.answer);
  }

  if (question.type === "short") {
    return normalize(answer) === normalize(question.answer);
  }

  if (question.type === "cloze") {
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];

    return blanks.every(blank =>
      normalize(answer?.[blank.label]) === normalize(blank.answer)
    );
  }

  return false;
}

// =======================
// 結果表示
// =======================
function showResult() {
  showScreen("screen-result");

  let correctCount = 0;
  const list = document.getElementById("result-list");
  list.innerHTML = "";

  state.questions.forEach((question, index) => {
    const answer = state.answers[question.id];
    const isCorrect = judge(question, answer);

    if (isCorrect) {
      correctCount += 1;
    }

    list.appendChild(createResultItem(question, answer, isCorrect, index));
  });

  const total = state.questions.length;
  const percent = Math.round((correctCount / total) * 100);

  const score = document.getElementById("score");
  score.innerHTML = "";

  const scoreNum = document.createElement("span");
  scoreNum.className = "score-num";
  scoreNum.textContent = String(correctCount);

  score.append("得点 ", scoreNum, ` / ${total}`);

  document.getElementById("score-percent").textContent = `正答率 ${percent}%`;
  document.getElementById("score-sub").textContent =
    percent === 100
      ? "全問正解です。見事。"
      : percent >= 60
        ? "合格ライン（60%）に到達しています。"
        : "合格ラインは60%です。復習して再挑戦しましょう。";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function createResultItem(question, answer, isCorrect, index) {
  const item = document.createElement("li");
  item.className = `result-item ${isCorrect ? "is-correct" : "is-incorrect"}`;

  const badge = document.createElement("span");
  badge.className = "result-badge";
  badge.textContent = isCorrect ? "○" : "×";
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", isCorrect ? "正解" : "不正解");

  const body = document.createElement("div");
  body.className = "result-body";

  const meta = document.createElement("p");
  meta.className = "result-meta";
  meta.textContent =
    `Q${index + 1}　${question.year}年　第${question.questionNumber}問　${TYPE_LABELS[question.type] || ""}`;

  const image = document.createElement("img");
  image.className = "result-image";
  image.src = question.image;
  image.alt = `${question.year}年 第${question.questionNumber}問の問題画像`;
  image.loading = "lazy";

  const answers = document.createElement("dl");
  answers.className = "result-answers";

  answers.appendChild(
    createAnswerLine("正解", getCorrectText(question), "answer-correct")
  );

  answers.appendChild(
    createAnswerLine(
      "あなたの答え",
      getUserText(question, answer),
      isCorrect ? "answer-correct" : "answer-wrong"
    )
  );

  body.append(meta, image, answers);
  item.append(badge, body);

  return item;
}

function createAnswerLine(labelText, value, valueClass) {
  const line = document.createElement("div");

  const label = document.createElement("dt");
  label.textContent = labelText;

  const detail = document.createElement("dd");
  detail.textContent = value;
  detail.className = valueClass;

  line.append(label, detail);

  return line;
}

// =======================
// 表示用変換
// =======================
function getCorrectText(question) {
  if (question.type === "choice") {
    return toCircledNumber(question.answer);
  }

  if (question.type === "short") {
    return question.answer;
  }

  if (question.type === "cloze") {
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];
    return blanks.map(blank => `${blank.label}：${blank.answer}`).join(" ／ ");
  }

  return "-";
}

function getUserText(question, answer) {
  if (answer === undefined || answer === null || answer === "") {
    return "未回答";
  }

  if (question.type === "choice") {
    return toCircledNumber(answer);
  }

  if (question.type === "short") {
    return answer;
  }

  if (question.type === "cloze") {
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];

    return blanks
      .map(blank => `${blank.label}：${answer?.[blank.label] || "未回答"}`)
      .join(" ／ ");
  }

  return "未回答";
}

// =======================
// エラー表示
// =======================
function showStartError(message) {
  const area = document.getElementById("start-error");
  area.textContent = message;
  area.hidden = false;
}

function clearStartError() {
  const area = document.getElementById("start-error");
  area.textContent = "";
  area.hidden = true;
}

// =======================
// 画面切り替え
// =======================
function showScreen(id) {
  ["screen-start", "screen-quiz", "screen-result"].forEach(screenId => {
    document.getElementById(screenId).hidden = true;
  });

  document.getElementById(id).hidden = false;
}

// =======================
// 戻る
// =======================
function backToStart() {
  state.questions = [];
  state.answers = {};
  state.currentIndex = 0;

  showScreen("screen-start");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
