// Saved words as CSV: one row per word, readable in spreadsheets and importable into Anki.

const COLUMNS = [
  ["Word", (entry) => entry.word],
  ["Reading", (entry) => entry.reading],
  ["Meaning", (entry) => entry.definitions?.join("; ") || entry.translation],
  ["Translation", (entry) => entry.translation],
  ["Sentence", (entry) => entry.sentence],
  ["Sentence translation", (entry) => entry.sentenceTranslation],
  ["Language", (entry) => entry.lang],
  ["Source", (entry) => entry.pageUrl],
  ["Saved", (entry) => new Date(entry.at).toISOString().slice(0, 10)],
];

// Quotes fields with commas, quotes or line breaks. A leading = + - @ would make a spreadsheet
// run the cell as a formula, so such fields get a ' in front.
function field(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(entries) {
  const rows = [COLUMNS.map(([name]) => name), ...entries.map((entry) => COLUMNS.map(([, get]) => get(entry)))];
  return rows.map((row) => row.map(field).join(",")).join("\r\n") + "\r\n";
}
