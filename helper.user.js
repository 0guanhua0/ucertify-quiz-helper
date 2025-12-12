// ==UserScript==
// @name         ucertify-quiz-helper
// @version      3.1.6
// @description  ucertify-quiz-helper
// @author       guanhua
// @include      *ucertify*
// @require      https://raw.githubusercontent.com/0guanhua0/ucertify-quiz-helper/refs/heads/main/db.js
// ==/UserScript==

(function () {
  "use strict";

  // https://aistudio.google.com/app/apikey
  // update MY_API_KEY
  let GEMINI_API_KEY = "MY_API_KEY";

  let lastProcessedQuestion = null;

  function normalizeText(text) {
    return text
      .replace(/ /g, " ")
      .replace(/–/g, "-")
      .replace(/−/g, "-")
      .replace(/\u00A0/g, " ")
      .replace(/“|”/g, '"')
      .replace(/‘|’/g, "'")
      .trim();
  }

  function matchKey(question, quiz) {
    for (let key in quiz) {
      if (question.includes(key)) {
        return key;
      }
    }
    return null;
  }

  function highlightAnswers(answersToHighlight, optionElements) {
    answersToHighlight.forEach((value) => {
      for (let element of optionElements) {
        let text = normalizeText(element.innerText.trim());
        if (text === value) {
          element.style.backgroundColor = "#00ff00";
          console.log("Highlighting answer:", value);
        }
      }
    });
  }

  async function askGemini(question, options) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "MY_API_KEY") {
      console.error("no Gemini API Key.");
      return [];
    }

    let API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    let prompt = `
      Respond exact text of the correct option(s).
      If multiple options, list each one on a new line.

      Question:
      ${question}

      Options:
      ${options.join("\n")}
    `;

    try {
      let response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        generationConfig: {
          temperature: 0,
        },
      });

      if (!response.ok) {
        let errorData = await response.json();
        console.error(errorData.error.message);
        return [];
      }

      let data = await response.json();
      let aiResponseText = data.candidates[0].content.parts[0].text;

      return aiResponseText
        .trim()
        .split("\n")
        .map((ans) => ans.trim())
        .filter(Boolean);
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async function runHelper() {
    let questionElement = document.querySelector('[data-itemtype="question"]');
    if (!questionElement) {
      return;
    }

    let currentQuestion = normalizeText(questionElement.innerText.trim());
    console.log(JSON.stringify(currentQuestion));

    lastProcessedQuestion = currentQuestion;

    let optionElements = document.querySelectorAll("#item_answer seq");
    let options = Array.from(optionElements).map((el) =>
      normalizeText(el.innerText.trim()),
    );

    console.log(JSON.stringify(options));

    let matchingKey = matchKey(currentQuestion, quiz);

    if (matchingKey) {
      highlightAnswers(quiz[matchingKey], optionElements);
    } else {
      console.log("No match in DB, ask gemini-2.5-flash...");
      let aiAnswers = await askGemini(currentQuestion, options);

      if (aiAnswers.length > 0) {
        console.log("Gemini AI suggests:", aiAnswers);
        highlightAnswers(aiAnswers, optionElements);
      } else {
        console.log("no answer from ai");
      }
    }
  }

  let observer = new MutationObserver((mutations) => {
    let questionElement = document.querySelector('[data-itemtype="question"]');
    let currentQuestionTextOnPage = questionElement
      ? normalizeText(questionElement.innerText.trim())
      : null;

    if (
      currentQuestionTextOnPage &&
      currentQuestionTextOnPage !== lastProcessedQuestion
    ) {
      console.log("new question, run helper");
      lastProcessedQuestion = currentQuestionTextOnPage;
      setTimeout(() => {
        runHelper();
      }, 100);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("load", function () {
    console.log("Page loaded, running quiz logic");
    setTimeout(runHelper, 100);
  });

  let patch = {};

  function getAnsLetter() {
    let txt = document.querySelector(".explanation_content").innerText;

    let single = txt.match(/Answer\s+([A-Z])\s+is\s+correct/i);
    if (single) return [single[1].toUpperCase()];

    let multi = txt.match(/Answers?\s+([A-Z,\sand&]+)\s+are\s+correct/i);
    return multi[1]
      .replace(/and/gi, ",")
      .replace(/&/g, ",")
      .split(",")
      .map((s) => s.replace(/[^A-Z]/gi, "").toUpperCase())
      .filter(Boolean);
  }

  function getCurr() {
    let question = normalizeText(
      document.querySelector(".ebook_item_text").innerText,
    ).replace("Copy \nStart of code", "Start of code");
    let letter = getAnsLetter();

    let allAns = [...document.querySelectorAll(".answer")];
    let ans = letter.map((l) => {
      let idx = l.charCodeAt(0) - "A".charCodeAt(0);
      return normalizeText(allAns[idx].innerText);
    });
    return { question, ans };
  }

  async function getAll() {
    while (true) {
      let current = getCurr();
      let status = document.querySelector("#ans-text").innerText;
      patch[current.question] = current.ans;

      document.querySelector("#next").click();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  unsafeWindow.patch = patch;
  unsafeWindow.getCurr = getCurr;
  unsafeWindow.getAll = getAll;
})();
