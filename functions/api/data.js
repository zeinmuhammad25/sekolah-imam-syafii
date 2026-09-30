// GET /api/data -- pengganti Apps Script doGet(). Bentuk balasan SAMA dengan
// fetchSchoolData() lama supaya frontend tidak perlu ditulis ulang.
//
// Performa:
//  1. Semua tabel dibaca dalam SATU db.batch (satu bolak-balik ke D1, bukan 13).
//  2. Tiap penulisan menaikkan meta.data_version. Snapshot di-cache di edge Cloudflare
//     dengan kunci versi -> selama tidak ada yang mengubah data, D1 tidak dibaca ulang.
//     Begitu ada guru menyimpan, versi naik -> cache lama otomatis tidak dipakai lagi
//     (tidak pernah menyajikan data basi).
//  3. ETag per versi -> browser cukup bertanya "masih versi X?" dan dapat 304 kosong
//     kalau belum berubah (hemat kuota & lebih cepat di HP).
import { TABLES, READONLY_TABLES, GRADES, rowToJson } from '../_lib/tables.js';

const orderBy = (cfg) => (cfg.orderCol === 'rowid' ? 'rowid' : `${cfg.orderCol}, rowid`);

// Bentuk ulang QuestionFolders + Questions -> TeacherQuestions (persis buildTeacherQuestions di Code.gs lama).
function buildTeacherQuestions(folders, questions) {
  const byFolder = {};
  questions.forEach((q) => {
    const fid = String(q.folderId);
    (byFolder[fid] ||= []).push({
      id: String(q.id), text: q.text,
      options: { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD },
      correctAnswer: q.correctAnswer, type: q.type || 'pg', updatedAt: q.updatedAt, order: q.order,
    });
  });
  const orderNum = (v) => (v === '' || v == null || isNaN(Number(v)) ? Infinity : Number(v));
  Object.values(byFolder).forEach((arr) => arr.sort((a, b) => orderNum(a.order) - orderNum(b.order)));

  return GRADES.map((grade) => {
    const gradeFolders = folders.filter((f) => String(f.grade) === grade).map((f) => ({ id: String(f.id), name: f.name, updatedAt: f.updatedAt }));
    const questionsObj = {};
    gradeFolders.forEach((f) => { questionsObj[f.id] = byFolder[f.id] || []; });
    return { grade, data: { updatedAt: Date.now(), examTypes: { [grade]: gradeFolders }, questions: questionsObj } };
  });
}

async function buildSnapshot(db, version) {
  const entries = [...Object.entries(TABLES), ...Object.entries(READONLY_TABLES)];
  const res = await db.batch(entries.map(([, cfg]) => db.prepare(`SELECT * FROM ${cfg.table} ORDER BY ${orderBy(cfg)}`)));
  const rowsOf = {};
  entries.forEach(([name, cfg], i) => { rowsOf[name] = (res[i].results || []).map((r) => rowToJson(cfg, r)); });

  const result = {};
  for (const [name] of entries) {
    if (name === 'QuestionFolders' || name === 'Questions') continue; // diekspos lewat TeacherQuestions
    result[name] = rowsOf[name];
  }
  result.TeacherQuestions = buildTeacherQuestions(rowsOf.QuestionFolders, rowsOf.Questions);
  result._version = version; // dipakai frontend untuk tahu ada perubahan dari guru lain
  return result;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  let version = null;
  try {
    const r = await db.prepare("SELECT value FROM meta WHERE key = 'data_version'").first();
    version = r ? Number(r.value) : null;
  } catch { /* tabel meta belum ada -> jalan tanpa cache */ }

  const etag = version != null ? `W/"v${version}"` : null;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
  if (etag) headers.ETag = etag;

  if (etag && request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers });
  }

  const cache = version != null && typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = cache ? new Request(`${new URL(request.url).origin}/__cache/api-data/v${version}`) : null;
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return new Response(await hit.text(), { headers: { ...headers, 'X-Data-Cache': 'HIT' } });
    } catch { /* cache gagal -> baca dari D1 */ }
  }

  const body = JSON.stringify(await buildSnapshot(db, version));
  if (cache) {
    const put = cache.put(cacheKey, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } })).catch(() => {});
    if (typeof context.waitUntil === 'function') context.waitUntil(put);
  }
  return new Response(body, { headers: { ...headers, 'X-Data-Cache': 'MISS' } });
}
