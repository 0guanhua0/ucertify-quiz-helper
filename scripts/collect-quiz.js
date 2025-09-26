// ======================== 核心脚本 ========================

// 初始化数据库
if (!window.quizData) window.quizData = {};

// 工具函数：清理文本
function normalizeText(text) {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/–/g, "-")
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "'")
    .trim();
}

// 根据字母拿选项文本（顺序映射：A=第1个，B=第2个...）
function getOptionTextByLetter(letter) {
  const answers = [...document.querySelectorAll(".answer")];
  const idx = letter.charCodeAt(0) - "A".charCodeAt(0);
  if (idx < 0 || idx >= answers.length) return `<未找到 ${letter}>`;
  return normalizeText(answers[idx].innerText);
}

// 从 Explanation 提取正确答案字母（支持单选/多选）
function parseCorrectLetters() {
  const exp =
    document.querySelector(".explanation_content") ||
    document.querySelector("#item_explanation .explanation_content");
  if (!exp) return null;

  const txt = exp.innerText;

  // 单选：Answer F is correct
  let single = txt.match(/Answer\s+([A-G])\s+is\s+correct/i);
  if (single) return [single[1].toUpperCase()];

  // 多选：Answers B, C, and E are correct
  let multi = txt.match(/Answers?\s+([A-G,\sand&]+)\s+are\s+correct/i);
  if (multi) {
    return multi[1]
      .replace(/and/gi, ",")
      .replace(/&/g, ",")
      .split(",")
      .map((s) => s.replace(/[^A-G]/gi, "").toUpperCase())
      .filter(Boolean);
  }

  return null;
}

// 收集当前题目：题干 + 正确答案
function collectCurrentQuestion() {
  const qEl = document.querySelector(".test-question .ebook_item_text");
  if (!qEl) return console.warn("❌ 没找到题目元素");

  const question = normalizeText(qEl.innerText);
  const letters = parseCorrectLetters();
  const texts = letters
    ? letters.map(getOptionTextByLetter)
    : ["<No answer captured>"];

  window.quizData[question] = texts;

  console.log(
    "✅ 已收集:",
    question,
    "→",
    texts,
    "(letters:",
    letters || "-",
    ")",
  );
  return { question, letters, texts };
}

// 导出数据库为 JSON
function exportDB() {
  const output = JSON.stringify(window.quizData, null, 2);
  copy(output);
  console.log("📋 已复制，可以粘贴到 db.js 里");
}

// 调试：打印当前题所有选项
function debugOptions() {
  const answers = [...document.querySelectorAll(".answer")];
  answers.forEach((el, i) => {
    const letter = String.fromCharCode("A".charCodeAt(0) + i);
    console.log(letter, "→", normalizeText(el.innerText));
  });
}

// ======================== 自动翻页增强 ========================

// 等待 Explanation 出现（保证答案已加载）
function waitForExplanation(timeout = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      const exp = document.querySelector(".explanation_content");
      if (exp) return resolve(true);
      if (Date.now() - start > timeout) return resolve(false);
      requestAnimationFrame(check);
    }
    check();
  });
}

// 自动收集所有题
async function autoCollectAll(maxQuestions = 50, delayAfterNext = 500) {
  for (let i = 0; i < maxQuestions; i++) {
    const ok = await waitForExplanation();
    if (!ok) {
      console.warn("⚠️ 超时：没等到 Explanation，跳过这一题");
    }
    collectCurrentQuestion();

    const nextBtn = document.querySelector(
      'button[aria-label="Next"], .intro-id-ite_next',
    );
    if (!nextBtn) {
      console.log("🚪 没找到 Next 按钮，可能已经是最后一题");
      break;
    }

    nextBtn.click(); // 翻页
    console.log(`➡️ 已完成第 ${i + 1} 题，进入下一题...`);
    await new Promise((r) => setTimeout(r, delayAfterNext)); // 等待切换
  }

  console.log("🏁 自动收集完成，可以 exportDB() 导出 JSON");
}
