// 核心脚本
// 初始化数据库
if (!window.quizData) window.quizData = {};
if (!window.quizCorrectOnly) window.quizCorrectOnly = {};
if (!window.quizIncorrectOnly) window.quizIncorrectOnly = {};

// 工具函数：清理文本
function normalizeText(text) {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/–/g, "-")
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "'")
    .trim();
}

// 根据字母拿选项文本
function getOptionTextByLetter(letter) {
  const answers = [...document.querySelectorAll(".answer")];
  const idx = letter.charCodeAt(0) - "A".charCodeAt(0);
  if (idx < 0 || idx >= answers.length) return `<未找到 ${letter}>`;
  return normalizeText(answers[idx].innerText);
}

// 提取正确答案字母（支持 A-Z）
function parseCorrectLetters() {
  const exp =
    document.querySelector(".explanation_content") ||
    document.querySelector("#item_explanation .explanation_content");
  if (!exp) return null;

  const txt = exp.innerText;
  console.log("Explanation 原文:", txt);

  // 单选 (兼容冒号)
  let single = txt.match(/Answer[:\s]+([A-Z])\s+is\s+correct/i);
  if (single) return [single[1].toUpperCase()];

  // 多选 (兼容逗号/and/&)
  let multi = txt.match(/Answers?[:\s]*([A-Z,\sand&]+)\s+are\s+correct/i);
  if (multi) {
    return multi[1]
      .replace(/and/gi, ",")
      .replace(/&/g, ",")
      .split(/[,\s]+/)
      .map((s) =>
        s
          .trim()
          .replace(/[^A-Z]/gi, "")
          .toUpperCase(),
      )
      .filter(Boolean);
  }

  console.warn("未能解析 Explanation:", txt);
  return null;
}

// 收集当前题目
function collectCurrentQuestion() {
  const qEl = document.querySelector(".test-question .ebook_item_text");
  if (!qEl) {
    console.warn("没找到题目元素");
    return null;
  }

  const question = normalizeText(qEl.innerText);
  const letters = parseCorrectLetters();
  const texts = letters
    ? letters.map(getOptionTextByLetter)
    : ["<No answer captured>"];

  // 存入总库
  window.quizData[question] = texts;

  // 存入 correctOnly
  if (letters && texts.length > 0 && texts[0] !== "<No answer captured>") {
    window.quizCorrectOnly[question] = texts;
  }

  // 存入 incorrectOnly（如果没抓到答案，就算错题）
  if (!letters || texts[0] === "<No answer captured>") {
    window.quizIncorrectOnly[question] = texts;
  }

  console.log(
    "已收集:",
    question,
    "→",
    texts,
    "(letters:",
    letters || "-",
    ")",
  );
  return { question, letters, texts };
}

// 导出函数
function exportDB() {
  const output = JSON.stringify(window.quizData, null, 2);
  copy(output);
  console.log("已复制 quizData，可以粘贴到 db.js 里");
}

function exportCorrectOnly() {
  const output = JSON.stringify(window.quizCorrectOnly, null, 2);
  copy(output);
  console.log("已复制 quizCorrectOnly");
}

function exportIncorrectOnly() {
  const output = JSON.stringify(window.quizIncorrectOnly, null, 2);
  copy(output);
  console.log("已复制 quizIncorrectOnly");
}

// 自动翻页增强

// 等待 Explanation 出现（保证答案已加载）
function waitForExplanation(timeout = 8000) {
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

// 自动收集所有题（防止死循环 & 可手动停止）
async function autoCollectAll(maxQuestions = 100, delayAfterNext = 1000) {
  window.stopAutoCollect = false;
  let lastQuestion = null;

  for (let i = 0; i < maxQuestions; i++) {
    if (window.stopAutoCollect) {
      console.log("手动停止收集");
      break;
    }

    await waitForExplanation();
    await new Promise((r) => setTimeout(r, 1000)); // 再等 1 秒，保证渲染
    const result = collectCurrentQuestion();
    if (!result) break;

    if (lastQuestion === result.question) {
      console.log("检测到重复题目，可能已经到最后一题，结束收集。");
      break;
    }
    lastQuestion = result.question;

    const nextBtn = document.querySelector(
      'button[aria-label="Next"], .intro-id-ite_next',
    );

    if (
      !nextBtn ||
      nextBtn.disabled ||
      /Results|Go Back/i.test(nextBtn.innerText)
    ) {
      console.log("已到最后一题或结果页，收集结束");
      break;
    }

    nextBtn.click();
    console.log(`已完成第 ${i + 1} 题，进入下一题...`);
    await new Promise((r) => setTimeout(r, delayAfterNext));
  }
}
