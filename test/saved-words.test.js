import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { entryFor, isSaved, loadSaved, removeSaved, saveWord, unsaveWord } from "../src/background/saved-words.js";
import { toCsv } from "../src/words/csv.js";

// browser.storage.local in memory.
let store;
beforeEach(() => {
  store = {};
  globalThis.browser = {
    storage: {
      local: {
        get: async (key) => (key in store ? { [key]: structuredClone(store[key]) } : {}),
        set: async (values) => void Object.assign(store, structuredClone(values)),
      },
    },
  };
});

const card = (word, extra = {}) => ({
  word,
  reading: "たべる",
  translation: "to eat",
  definitions: ["to eat", "to live on"],
  sentence: `パンを${word}`,
  sentenceTranslation: "I eat bread",
  pageUrl: "https://www.example.jp/page",
  pageTitle: "Example",
  sourceLang: "ja",
  ...extra,
});

test("a saved word is saved", async () => {
  await saveWord(card("食べる"));
  assert.equal(await isSaved("ja", "食べる"), true);
  assert.equal(await isSaved("ko", "食べる"), false);
  const [entry] = await loadSaved();
  assert.equal(entry.host, "example.jp");
  assert.deepEqual(entry.definitions, ["to eat", "to live on"]);
});

test("saving a word again keeps one entry with the new context", async () => {
  await saveWord(card("食べる"));
  await saveWord(card("飲む"));
  const [first] = await loadSaved();
  await saveWord(card("食べる", { sentence: "ご飯を食べる" }));
  const entries = await loadSaved();
  assert.deepEqual(entries.map((e) => e.word), ["飲む", "食べる"]);
  assert.equal(entries[1].sentence, "ご飯を食べる");
  assert.equal(entries[1].id, first.id);
});

test("saves at the same time don't lose words", async () => {
  await Promise.all(["一", "二", "三", "四"].map((word) => saveWord(card(word))));
  assert.equal((await loadSaved()).length, 4);
});

test("unsave and remove take words out", async () => {
  await saveWord(card("食べる"));
  await saveWord(card("飲む"));
  await unsaveWord("ja", "食べる");
  const [left] = await loadSaved();
  assert.equal(left.word, "飲む");
  await removeSaved(left.id);
  assert.deepEqual(await loadSaved(), []);
});

test("only web pages are kept as the source", () => {
  const entry = entryFor(card("食べる", { pageUrl: "javascript:alert(1)", pageTitle: "x" }));
  assert.equal(entry.pageUrl, "");
  assert.equal(entry.pageTitle, "");
  assert.equal(entry.host, "");
});

test("long texts are cut", () => {
  assert.equal(entryFor(card("食べる", { sentence: "あ".repeat(5000) })).sentence.length, 1000);
});

test("the CSV quotes fields and keeps spreadsheets from running formulas", () => {
  const csv = toCsv([entryFor(card("食べる", { translation: '=HYPERLINK("x")', sentence: "a, b" }), Date.UTC(2026, 10, 21))]);
  const [header, row] = csv.trim().split("\r\n");
  assert.equal(header, "Word,Reading,Meaning,Translation,Sentence,Sentence translation,Language,Source,Saved");
  assert.equal(row, `食べる,たべる,to eat; to live on,"'=HYPERLINK(""x"")","a, b",I eat bread,ja,https://www.example.jp/page,2026-11-21`);
});
