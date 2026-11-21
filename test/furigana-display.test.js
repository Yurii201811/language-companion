import { test } from "node:test";
import assert from "node:assert/strict";
import "../src/shared/settings.js";
import "../src/shared/furigana.js";

const { pieces } = globalThis.LC.furigana;
const { getSettings } = globalThis.LC.settings;

// 今日は友達と (きょう over 今日, ともだち over 友達)
const text = "今日は友達と";
const readings = [
  { start: 0, end: 2, rt: "きょう" },
  { start: 3, end: 5, rt: "ともだち" },
];

test("pieces without readings or mark is the whole text", () => {
  assert.deepEqual(pieces("ねえ", []), [{ text: "ねえ", marked: false }]);
});

test("pieces puts readings over their kanji", () => {
  assert.deepEqual(pieces(text, readings), [
    { text: "今日", rt: "きょう", marked: false },
    { text: "は", marked: false },
    { text: "友達", rt: "ともだち", marked: false },
    { text: "と", marked: false },
  ]);
});

test("pieces marks the highlighted word with its reading", () => {
  assert.deepEqual(pieces(text, readings, { start: 3, end: 5 }), [
    { text: "今日", rt: "きょう", marked: false },
    { text: "は", marked: false },
    { text: "友達", rt: "ともだち", marked: true },
    { text: "と", marked: false },
  ]);
});

test("a mark inside a reading takes the whole reading", () => {
  assert.deepEqual(pieces(text, readings, { start: 4, end: 6 }), [
    { text: "今日", rt: "きょう", marked: false },
    { text: "は", marked: false },
    { text: "友達", rt: "ともだち", marked: true },
    { text: "と", marked: true },
  ]);
});

test("readings outside the text are ignored", () => {
  assert.deepEqual(pieces("今", [{ start: 0, end: 3, rt: "いま" }]), [{ text: "今", marked: false }]);
});

function withStored(stored, run) {
  globalThis.browser = { storage: { sync: { get: async () => stored } } };
  return run().finally(() => delete globalThis.browser);
}

test("furigana is on by default", () => withStored({}, async () => assert.equal((await getSettings()).furigana, true)));

test("furigana keeps the choice made for speech bubbles before", () =>
  withStored({ bubbleFurigana: false }, async () => assert.equal((await getSettings()).furigana, false)));

test("furigana prefers the current setting", () =>
  withStored({ bubbleFurigana: false, furigana: true }, async () => assert.equal((await getSettings()).furigana, true)));
