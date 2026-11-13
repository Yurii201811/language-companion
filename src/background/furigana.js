// Furigana for whole Japanese sentences (speech bubbles): kuromoji splits the text into words with
// their readings, and shared/furigana.js puts each reading over the word's kanji only.
// Runs locally; the dictionary (about 17 MB) is downloaded once, only while the setting is on.
import "../shared/furigana.js";

const { furigana } = globalThis.LC;

// The dictionary from the kuromoji npm package, pinned to its version, each file with its SHA-256,
// checked before it's cached or used.
const DICT_URL = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict";
const DICT_FILES = {
  "base.dat.gz": "0803327762e1c93ca731e4319ab8343340f2806bb84941207782cde9d2d5a8eb",
  "cc.dat.gz": "02b7631be0d4de3a1a75cd9f9cc51536e4f94c9e6b389b813e06ba0f6e7de765",
  "check.dat.gz": "193ae0035fff6fe812b58d9ee730e7a7d7ee601d918481ce51075c58114f6cc9",
  "tid.dat.gz": "d43d831cb6fb0f0a411739cd287a6d5e998e121a8daca614df14a81a0dcac586",
  "tid_map.dat.gz": "33efd5ffd87a70f669add093fa39dee44341d58f940844ef107c8fd98bb795b2",
  "tid_pos.dat.gz": "60dbfc99a6ab993f30c5dab648bec6ad7f9aaefa5c14e1843837d95e509f8895",
  "unk.dat.gz": "f7f991cdeb9bfd3e9c0e4577cc50ee0815a11c508cccd444a9d3ab3c81521100",
  "unk_char.dat.gz": "9a8e86fd9aff32d323fbb59f5a7006f05927a11f8173c90712cc56293aeb3225",
  "unk_compat.dat.gz": "50f60aa29bc2e86c2903ab8c825bb6fa604d2b294d96941c1d3924259791899d",
  "unk_invoke.dat.gz": "6b210889548457c3006913afd12c8b525562255f2709e404604be9614a25e94c",
  "unk_map.dat.gz": "6df12460e5477230bb6fd9641def918b699fc0a8868016b6c9f794488630509b",
  "unk_pos.dat.gz": "5b183a29f281acc7e0542beca47b83f7985047c0a2d27e78a66f32276be5ad11",
};
export const DICT_CACHE = "furigana-dict-v1";

// Where readings go in a text, from kuromoji's tokens: [{ start, end, rt }] over kanji runs, with
// string offsets and readings in hiragana. Tokens without kanji or without a known reading get none.
export function rubyRanges(text, tokens) {
  const ranges = [];
  let cursor = 0;
  for (const { surface_form: surface, reading } of tokens) {
    const start = text.indexOf(surface, cursor);
    if (start < 0) continue;
    cursor = start + surface.length;
    if (!reading || reading === "*" || !furigana.hasKanji(surface)) continue;
    let offset = start;
    for (const part of furigana.segments(surface, reading)) {
      if (part.rt) ranges.push({ start: offset, end: offset + part.text.length, rt: furigana.toHiragana(part.rt) });
      offset += part.text.length;
    }
  }
  return ranges;
}

async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// One dictionary file, from the cache or downloaded and checked.
async function dictFile(name) {
  const expected = DICT_FILES[name];
  if (!expected) throw new Error(`Unknown dictionary file: ${name}`);
  const url = `${DICT_URL}/${name}`;
  const cache = await caches.open(DICT_CACHE);
  const cached = await cache.match(url);
  if (cached) return cached.arrayBuffer();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Couldn't download the furigana dictionary (HTTP ${response.status}).`);
  const bytes = await response.arrayBuffer();
  if ((await sha256(bytes)) !== expected) throw new Error("The downloaded furigana dictionary is damaged. Try again.");
  await cache.put(url, new Response(bytes));
  return bytes;
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

// kuromoji asks for "<dicPath>/<file>" (see scripts/vendor-kuromoji.mjs) and gets the unzipped file.
// `files` replaces the download, for tests.
export function createTokenizer({ files = dictFile } = {}) {
  return (async () => {
    globalThis.LC_KUROMOJI_LOAD = async (path) => gunzip(await files(path.split("/").pop()));
    await import("../vendor/kuromoji/kuromoji.js");
    const builder = globalThis.kuromoji.builder({ dicPath: "dict/" });
    return new Promise((resolve, reject) => builder.build((error, tokenizer) => (error ? reject(error) : resolve(tokenizer))));
  })();
}

// The tokenizer is built once; a failed download is retried on the next request.
let tokenizer = null;

export async function sentenceFurigana(text) {
  if (!furigana.hasKanji(text)) return [];
  if (!tokenizer) {
    tokenizer = createTokenizer();
    tokenizer.catch(() => (tokenizer = null));
  }
  return rubyRanges(text, (await tokenizer).tokenize(text));
}
