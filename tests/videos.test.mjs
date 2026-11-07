// Rauchtest Videos (R2) – ohne Abhängigkeiten:  node tests/videos.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import worker, { video, VIDEO_PFAD } from "../src/worker.js";
import { videoListe, VIDEO_MAX_MB } from "../scripts/atlas.mjs";

let n = 0; const ok = (name) => console.log(`ok ${++n} – ${name}`);

// Nachgebautes R2 (verhält sich wie R2Bucket.get mit range/onlyIf)
const DATA = new Uint8Array(1000).map((_, i) => i % 256);
const fakeR2 = { async get(key, opt = {}) {
  if (key !== "bayern-2026/tag-03-test.mp4") return null;
  const etag = '"abc"';
  const inm = opt.onlyIf && opt.onlyIf.get && opt.onlyIf.get("if-none-match");
  const base = { size: DATA.length, httpEtag: etag };
  if (inm === etag) return base;
  const rh = opt.range && opt.range.get && opt.range.get("range");
  if (rh) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rh); if (!m) throw new Error("bad range");
    let range;
    if (m[1] === "") range = { suffix: +m[2] };
    else range = { offset: +m[1], length: (m[2] === "" ? DATA.length - 1 : Math.min(+m[2], DATA.length - 1)) - +m[1] + 1 };
    const s = range.suffix != null ? DATA.length - range.suffix : range.offset;
    const l = range.suffix != null ? range.suffix : range.length;
    return { ...base, range, body: new Blob([DATA.slice(s, s + l)]).stream() };
  }
  return { ...base, body: new Blob([DATA]).stream() };
} };
const env = { VIDEOS: fakeR2, ASSETS: { fetch: async () => new Response("asset") } };
const call = (p, headers = {}, method = "GET") => worker.fetch(new Request("https://x.test" + p, { method, headers }), env);

let r = await call("/video/bayern-2026/tag-03-test.mp4");
assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "video/mp4");
assert.equal(r.headers.get("accept-ranges"), "bytes"); assert.equal((await r.arrayBuffer()).byteLength, 1000); ok("ganzes Video 200");

r = await call("/video/bayern-2026/tag-03-test.mp4", { range: "bytes=0-1" });
assert.equal(r.status, 206); assert.equal(r.headers.get("content-range"), "bytes 0-1/1000");
assert.equal(r.headers.get("content-length"), "2"); assert.equal((await r.arrayBuffer()).byteLength, 2); ok("Safari-Probe bytes=0-1 → 206");

r = await call("/video/bayern-2026/tag-03-test.mp4", { range: "bytes=500-" });
assert.equal(r.status, 206); assert.equal(r.headers.get("content-range"), "bytes 500-999/1000");
const b = new Uint8Array(await r.arrayBuffer()); assert.equal(b.length, 500); assert.equal(b[0], 500 % 256); ok("offener Bereich bytes=500-");

r = await call("/video/bayern-2026/tag-03-test.mp4", { range: "bytes=-100" });
assert.equal(r.status, 206); assert.equal(r.headers.get("content-range"), "bytes 900-999/1000"); ok("Suffix-Bereich bytes=-100");

r = await call("/video/bayern-2026/tag-03-test.mp4", { "if-none-match": '"abc"' });
assert.equal(r.status, 304); ok("ETag → 304");

r = await call("/video/bayern-2026/tag-03-test.mp4", {}, "HEAD");
assert.equal(r.status, 200); assert.equal(r.headers.get("content-length"), "1000"); ok("HEAD");

assert.equal((await call("/video/bayern-2026/fehlt.mp4")).status, 404);
assert.equal((await call("/video/bayern-2026/unter/x.mp4")).status, 404);
assert.equal((await call("/video/bayern-2026/x.mov")).status, 404);
assert.equal((await call("/video/bayern-2026/tag-03-test.mp4", {}, "POST")).status, 405); ok("404/405 bei falschen Pfaden und Methoden");

assert.equal((await video(new Request("https://x.test/video/a/b.mp4"), {}, new URL("https://x.test/video/a/b.mp4"))).status, 503); ok("ohne Bindung 503 statt Absturz");
assert.equal(await (await call("/atlas/")).text(), "asset"); ok("übrige Seite unverändert über ASSETS");
assert.ok(!VIDEO_PFAD.test("/video/A/b.mp4")); ok("Pfadmuster nur klein");

const warn = console.warn; console.warn = () => {};
const l = videoListe({ tage: { "3": [{ datei: "tag-03-ok.mp4", mb: 20 }, { datei: "Böse Datei.mp4" }, { datei: "x.mov" }, { datei: "gross.mp4", mb: VIDEO_MAX_MB + 1 }] } }, 3);
console.warn = warn;
assert.deepEqual(l.map((v) => v.datei), ["tag-03-ok.mp4"]); assert.deepEqual(videoListe(null, 1), []); ok("_videos.json: Name, Format, Größengrenze");

// Build-Rauchtest: echter Build mit einem Testvideo in einer Kopie des Repos
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rc-video-"));
for (const d of ["scripts", "src", "content", "books.json", "reisen.json", "package.json", "tools"]) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
fs.mkdirSync(path.join(tmp, "assets"), { recursive: true });
for (const d of fs.readdirSync(path.join(ROOT, "assets"))) if (d !== "reisen") fs.cpSync(path.join(ROOT, "assets", d), path.join(tmp, "assets", d), { recursive: true });
fs.mkdirSync(path.join(tmp, "assets", "reisen", "bayern-2026", "videos"), { recursive: true });
fs.writeFileSync(path.join(tmp, "assets", "reisen", "bayern-2026", "videos", "tag-03-test.jpg"), "jpg");
fs.writeFileSync(path.join(tmp, "content", "reisen", "bayern-2026", "_videos.json"), JSON.stringify({ tage: { "3": [{ datei: "tag-03-test.mp4", text: "Testvideo", dauer: 12, mb: 3 }] } }));
const { spawnSync } = await import("node:child_process");
const bld = spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: tmp, encoding: "utf8" });
if (bld.status !== 0) { console.log(bld.stdout.slice(-2000), bld.stderr.slice(-2000)); }
assert.equal(bld.status, 0, "Build läuft");
const data = JSON.parse(fs.readFileSync(path.join(tmp, "dist", "atlas", "data", "bayern-2026.json"), "utf8"));
const t3 = data.tage.find((t) => t.tag === 3);
assert.deepEqual(t3.clips.find((c) => c.url.startsWith("/video/")), { url: "/video/bayern-2026/tag-03-test.mp4", poster: "/assets/reisen/bayern-2026/videos/tag-03-test.jpg", text: "Testvideo", dauer: 12 });
ok("Build: Video erscheint in /atlas/data/bayern-2026.json mit Vorschaubild");
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nalle ${n} Prüfungen grün`);
