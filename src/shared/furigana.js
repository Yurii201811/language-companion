// Splits a Japanese word into parts with readings over the kanji only, e.g.
// 食べ物 + たべもの -> 食(た) べ 物(もの). Shared by the card and the Anki note.
(() => {
  const LC = (globalThis.LC ??= {});

  // CJK ideographs plus 々 (repeat mark), which is read like a kanji.
  const KANJI = /[一-鿿々]/;
  const RUNS = /[一-鿿々]+|[^一-鿿々]+/g;

  const toHiragana = (text) => text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Returns [{ text, rt? }]. Kana between kanji anchors the split; if the reading does not
  // line up with the word (e.g. after editing), the whole word gets the whole reading.
  function segments(word, reading) {
    if (!word || !reading || !KANJI.test(word)) return [{ text: word }];
    const runs = word.match(RUNS);
    const pattern = runs.map((run) => (KANJI.test(run) ? "(.+?)" : `(${escapeRegex(toHiragana(run))})`)).join("");
    const match = new RegExp(`^${pattern}$`).exec(toHiragana(reading));
    if (!match) return [{ text: word, rt: reading }];
    return runs.map((run, i) => (KANJI.test(run) ? { text: run, rt: match[i + 1] } : { text: run }));
  }

  // Splits text for display into [{ text, rt?, marked? }]: readings ({ start, end, rt }, sorted,
  // not overlapping) become pieces with rt, and mark ({ start, end } or null) sets marked. A
  // reading across the mark's edge is marked as a whole, so a reading is never cut in two.
  function pieces(text, readings = [], mark = null) {
    const valid = readings.filter(({ start, end, rt }) => rt && start >= 0 && end <= text.length && start < end);
    let markStart = mark ? Math.max(0, mark.start) : -1;
    let markEnd = mark ? Math.min(text.length, mark.end) : -1;
    for (const { start, end } of valid) {
      if (start < markStart && end > markStart) markStart = start;
      if (start < markEnd && end > markEnd) markEnd = end;
    }
    const cuts = new Set([0, text.length]);
    for (const { start, end } of valid) cuts.add(start).add(end);
    if (markStart < markEnd) cuts.add(markStart).add(markEnd);
    const sorted = [...cuts].sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const [start, end] = [sorted[i], sorted[i + 1]];
      const rt = valid.find((r) => r.start === start && r.end === end)?.rt;
      const marked = markStart < markEnd && start >= markStart && end <= markEnd;
      const last = result.at(-1);
      if (!rt && last && !last.rt && last.marked === marked) last.text += text.slice(start, end);
      else result.push({ text: text.slice(start, end), ...(rt ? { rt } : {}), marked });
    }
    return result;
  }

  LC.furigana = Object.freeze({ segments, pieces, toHiragana, hasKanji: (text) => KANJI.test(text ?? "") });
})();
