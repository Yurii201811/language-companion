// Words the user saved from the card (☆), kept in browser.storage.local for the Saved words page.
// Works without Anki; words added to Anki are saved here too. Entries, newest last:
//   { id, at, lang, word, reading, translation, definitions, sentence, sentenceTranslation,
//     pageUrl, pageTitle, host }
// One entry per word and language: saving a word again updates it with the new context.
// Only the background writes the list; extension pages read it and listen to storage.onChanged.

export const SAVED_KEY = "savedWords";

const MAX_TEXT = 1000;
const MAX_DEFINITIONS = 5;

export async function loadSaved() {
  const { [SAVED_KEY]: entries = [] } = await browser.storage.local.get(SAVED_KEY);
  return entries;
}

// Read-modify-write steps run one after another, so two saves can't overwrite each other.
let lock = Promise.resolve();

function update(change) {
  const run = lock.then(async () => {
    const entries = await loadSaved();
    const result = change(entries);
    await browser.storage.local.set({ [SAVED_KEY]: entries });
    return result;
  });
  lock = run.catch(() => {});
  return run;
}

const text = (value) => (typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "");

function webUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

const sameWord = (lang, word) => (entry) => entry.lang === lang && entry.word === word;

// The entry for a card (see getCard in content/popup-ui.js).
export function entryFor(card, now = Date.now()) {
  const url = webUrl(card.pageUrl);
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: now,
    lang: text(card.sourceLang),
    word: text(card.word),
    reading: text(card.reading),
    translation: text(card.translation),
    definitions: (Array.isArray(card.definitions) ? card.definitions : []).filter((d) => typeof d === "string").slice(0, MAX_DEFINITIONS).map(text),
    sentence: text(card.sentence),
    sentenceTranslation: text(card.sentenceTranslation),
    pageUrl: url ? url.href : "",
    pageTitle: url ? text(card.pageTitle) : "",
    host: url ? url.hostname.replace(/^www\./, "") : "",
  };
}

// Saves the card's word, or updates it (moved to the end, as the newest) if it's already saved.
export function saveWord(card) {
  const entry = entryFor(card);
  return update((entries) => {
    const index = entries.findIndex(sameWord(entry.lang, entry.word));
    if (index >= 0) {
      entry.id = entries[index].id;
      entries.splice(index, 1);
    }
    entries.push(entry);
    return entry.id;
  });
}

export function unsaveWord(lang, word) {
  return update((entries) => {
    const index = entries.findIndex(sameWord(lang, text(word)));
    if (index >= 0) entries.splice(index, 1);
  });
}

export function removeSaved(id) {
  return update((entries) => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index >= 0) entries.splice(index, 1);
  });
}

export async function isSaved(lang, word) {
  return (await loadSaved()).some(sameWord(lang, text(word)));
}
