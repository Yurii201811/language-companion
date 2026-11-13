import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createTokenizer, rubyRanges } from "../src/background/furigana.js";

// The dictionary from node_modules instead of the download (same files, see DICT_FILES).
const dict = new URL("../node_modules/kuromoji/dict/", import.meta.url);
const tokenizer = createTokenizer({ files: (name) => readFile(new URL(name, dict)) });

async function readings(text) {
  return rubyRanges(text, (await tokenizer).tokenize(text)).map(({ start, end, rt }) => `${text.slice(start, end)}(${rt})`);
}

test("readings go over the kanji only, in hiragana", async () => {
  assert.deepEqual(await readings("今日は友達と食べ物を買いました。"), ["今日(きょう)", "友達(ともだち)", "食(た)", "物(もの)", "買(か)"]);
});

test("kana, latin and punctuation get no readings", async () => {
  assert.deepEqual(await readings("ねえ、ABC！"), []);
});

test("offsets point into the original text", async () => {
  const text = "　東京へ行く";
  const ranges = rubyRanges(text, (await tokenizer).tokenize(text));
  assert.deepEqual(ranges, [
    { start: 1, end: 3, rt: "とうきょう" },
    { start: 4, end: 5, rt: "い" },
  ]);
});

test("tokens without a reading are skipped", () => {
  assert.deepEqual(rubyRanges("謎X", [{ surface_form: "謎X", reading: undefined }]), []);
  assert.deepEqual(rubyRanges("謎", [{ surface_form: "謎", reading: "*" }]), []);
});
