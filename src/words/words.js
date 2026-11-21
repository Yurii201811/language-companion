import { SAVED_KEY, loadSaved } from "../background/saved-words.js";
import { toCsv } from "./csv.js";

const { MSG, languages, furigana } = globalThis.LC;

const $ = (selector) => document.querySelector(selector);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

async function send(type, payload = {}) {
  const response = await browser.runtime.sendMessage({ type, ...payload });
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

// Minimal element builder: h("td", { class: "x" }, child, "text").
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "class") el.className = value;
    else el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((child) => child != null && child !== false && child !== ""));
  return el;
}

function wordWithReading({ word, reading, lang }) {
  if (lang !== "ja" || !reading || reading === word) return word;
  return furigana.segments(word, reading).map(({ text, rt }) => (rt ? h("ruby", {}, text, h("rt", {}, rt)) : text));
}

// The sentence with the word marked, when it appears in it.
function sentenceWithWord(sentence, word) {
  const index = sentence.indexOf(word);
  if (index < 0) return sentence;
  return [sentence.slice(0, index), h("mark", {}, word), sentence.slice(index + word.length)];
}

function renderEntry(entry) {
  const meaning = entry.definitions?.length ? entry.definitions.join("; ") : "";
  return h(
    "li",
    { class: "entry" },
    h(
      "div",
      { class: "entry-head" },
      h("span", { class: "word", lang: entry.lang }, wordWithReading(entry)),
      h("span", { class: "translation" }, entry.translation),
      h("button", { type: "button", class: "remove", "aria-label": `Delete ${entry.word}`, onClick: () => send(MSG.SAVED_REMOVE, { id: entry.id }) }, "Delete"),
    ),
    meaning && meaning !== entry.translation && h("p", { class: "definitions" }, meaning),
    entry.sentence &&
      h(
        "div",
        { class: "sentence" },
        h("div", { lang: entry.lang }, sentenceWithWord(entry.sentence, entry.word)),
        entry.sentenceTranslation && h("div", { class: "sentence-translation" }, entry.sentenceTranslation),
      ),
    h(
      "div",
      { class: "source" },
      dateFormat.format(entry.at),
      entry.pageUrl && [" · ", h("a", { href: entry.pageUrl, target: "_blank", rel: "noopener noreferrer", title: entry.pageTitle || entry.pageUrl }, entry.pageTitle || entry.host)],
    ),
  );
}

let saved = [];

function matches(entry, query, lang) {
  if (lang && entry.lang !== lang) return false;
  if (!query) return true;
  const hiragana = furigana.toHiragana(query);
  return [entry.word, entry.reading, entry.translation, entry.sentence, entry.sentenceTranslation, ...(entry.definitions ?? [])].some((text) => {
    const lower = (text ?? "").toLowerCase();
    return lower.includes(query) || furigana.toHiragana(lower).includes(hiragana);
  });
}

function render() {
  const query = $("#search").value.trim().toLowerCase();
  const lang = $("#language").value;
  const shown = saved.filter((entry) => matches(entry, query, lang)).reverse();
  $("#empty").hidden = saved.length > 0;
  $("#filters").hidden = saved.length === 0;
  $("#export").hidden = saved.length === 0;
  $("#clear").hidden = saved.length === 0;
  $("#no-match").hidden = saved.length === 0 || shown.length > 0;
  $("#count").textContent = saved.length === 0 ? "" : shown.length === saved.length ? `${saved.length} words` : `${shown.length} of ${saved.length} words`;
  $("#words").replaceChildren(...shown.map(renderEntry));
}

// The language filter, only when words of more than one language are saved.
function renderLanguages() {
  const codes = [...new Set(saved.map((entry) => entry.lang))].sort();
  const select = $("#language");
  select.hidden = codes.length < 2;
  if (select.hidden) select.value = "";
  const current = select.value;
  select.replaceChildren(h("option", { value: "" }, "All languages"), ...codes.map((code) => h("option", { value: code }, languages.name(code))));
  select.value = codes.includes(current) ? current : "";
}

async function load() {
  saved = await loadSaved();
  renderLanguages();
  render();
}

function exportCsv() {
  // The byte order mark makes spreadsheet apps read Japanese and Korean as UTF-8.
  const blob = new Blob(["﻿", toCsv(saved)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = h("a", { href: url, download: `saved-words-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("#search").addEventListener("input", render);
$("#language").addEventListener("change", render);
$("#export").addEventListener("click", exportCsv);
$("#clear").addEventListener("click", () => {
  const count = saved.length;
  if (!confirm(`Delete all ${count} saved words? This can't be undone. Export them as CSV first if you want to keep them.`)) return;
  send(MSG.SAVED_CLEAR);
});
browser.storage.onChanged.addListener((changes, area) => area === "local" && changes[SAVED_KEY] && load());
load();
