// Copies kuromoji (Japanese tokenizer, for furigana in speech bubbles) from node_modules into
// src/vendor. Its browser build fetches the dictionary itself with XMLHttpRequest; that one
// function is replaced so the dictionary goes through background/furigana.js instead, which
// downloads pinned files, checks their SHA-256 and caches them (like the OCR models).
// Runs automatically before npm start, build, lint and test; the copy is not committed.

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/kuromoji");
const to = join(root, "src/vendor/kuromoji");

const LOADER = "BrowserDictionaryLoader.prototype.loadArrayBuffer = function (url, callback) {";
const PATCHED = `${LOADER}
    // Patched by scripts/vendor-kuromoji.mjs: the extension supplies the verified files.
    globalThis.LC_KUROMOJI_LOAD(url).then(function (buffer) { callback(null, buffer); }, function (error) { callback(error, null); });
    return;`;

// The bundled async library finds the global object with Function("return this"), which the
// extension's CSP forbids and the add-on linter flags; it never gets there, but globalThis is simpler.
const GLOBAL = "var root = freeGlobal || freeSelf || Function('return this')();";

let source = readFileSync(join(from, "build/kuromoji.js"), "utf8");
for (const [find, replacement] of [
  [LOADER, PATCHED],
  [GLOBAL, "var root = globalThis;"],
]) {
  if (source.split(find).length !== 2) throw new Error(`kuromoji's build changed; update scripts/vendor-kuromoji.mjs (${find.slice(0, 40)}…).`);
  source = source.replace(find, replacement);
}

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
writeFileSync(join(to, "kuromoji.js"), source);
copyFileSync(join(from, "LICENSE-2.0.txt"), join(to, "LICENSE-2.0.txt"));
copyFileSync(join(from, "NOTICE.md"), join(to, "NOTICE.md"));
console.log(`Copied kuromoji to ${to}`);
