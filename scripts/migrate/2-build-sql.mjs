// Tahap 2: baca dump.json (hasil tahap 1) -> hasilkan insert.sql (INSERT OR REPLACE)
// untuk dijalankan ke D1. Tidak menyentuh Sheets sama sekali.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TABLES, READONLY_TABLES, GRADES } from '../../functions/_lib/tables.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dump = JSON.parse(readFileSync(join(__dirname, 'dump.json'), 'utf8'));

const esc = (v) => {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

let sql = '-- Auto-generated oleh scripts/migrate/2-build-sql.mjs — JANGAN diedit manual.\nPRAGMA foreign_keys = OFF;\n\n';
const counts = {};

const insertRows = (table, cols, rows) => {
  counts[table] = (counts[table] || 0) + rows.length;
  if (!rows.length) return;
  for (const row of rows) {
    const vals = cols.map((c) => esc(row[c]));
    sql += `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
  }
  sql += '\n';
};

// ---- Tabel CRUD biasa (Gallery, Teachers, News, Videos, Students, ReportPeriods, dst) ----
// QuestionFolders/Questions ditangani terpisah di bawah (dari TeacherQuestions).
for (const [sheetName, cfg] of Object.entries(TABLES)) {
  if (sheetName === 'QuestionFolders' || sheetName === 'Questions') continue;
  const rows = dump[sheetName] || [];
  const dbCols = cfg.fields.map(([, col]) => col);
  const withPosition = cfg.orderCol !== 'rowid' && cfg.orderCol !== 'order_num';
  const cols = withPosition ? [...dbCols, cfg.orderCol] : dbCols;
  const mapped = rows.map((r, i) => {
    const o = {};
    cfg.fields.forEach(([json, col]) => { o[col] = r[json]; });
    if (withPosition) o[cfg.orderCol] = i + 1;
    return o;
  });
  insertRows(cfg.table, cols, mapped);
}

// ---- Settings / Announcements (read-only tables, tapi tetap dipindah datanya) ----
for (const [sheetName, cfg] of Object.entries(READONLY_TABLES)) {
  const rows = dump[sheetName] || [];
  const dbCols = cfg.fields.map(([, col]) => col);
  const withPosition = cfg.orderCol !== 'rowid';
  const cols = withPosition ? [...dbCols, cfg.orderCol] : dbCols;
  const mapped = rows.map((r, i) => {
    const o = {};
    cfg.fields.forEach(([json, col]) => {
      let v = r[json];
      if (sheetName === 'Announcements' && json === 'id' && !v) v = `ann-${i + 1}`; // sheet Announcements tak selalu punya id
      o[col] = v;
    });
    if (withPosition) o[cfg.orderCol] = i + 1;
    return o;
  });
  insertRows(cfg.table, cols, mapped);
}

// ---- PPDB (sheet lama pakai kolom `timestamp`, tanpa `id`) ----
const ppdbRows = (dump.PPDB || []).map((r, i) => ({
  id: `ppdb-migrasi-${i + 1}`,
  parent_name: r.parent_name,
  student_name: r.student_name,
  phone: r.phone,
  email: r.email,
  status: 'baru',
  created_at: r.timestamp ? new Date(r.timestamp).getTime() : Date.now(),
}));
insertRows('ppdb', ['id', 'parent_name', 'student_name', 'phone', 'email', 'status', 'created_at'], ppdbRows);

// ---- QuestionFolders + Questions, dibongkar dari TeacherQuestions (bentuk yang sudah jadi) ----
const tq = dump.TeacherQuestions || [];
const folderRows = [];
const questionRows = [];
tq.forEach(({ grade, data }) => {
  const folders = (data && data.examTypes && data.examTypes[grade]) || [];
  folders.forEach((f) => {
    folderRows.push({ id: f.id, grade, name: f.name, updated_at: (data && data.updatedAt) || Date.now() });
    const qs = (data && data.questions && data.questions[f.id]) || [];
    qs.forEach((q) => {
      questionRows.push({
        id: q.id, folder_id: f.id, text: q.text,
        option_a: q.options?.a, option_b: q.options?.b, option_c: q.options?.c, option_d: q.options?.d,
        correct_answer: q.correctAnswer, type: q.type || 'pg', order_num: q.order, updated_at: q.updatedAt,
      });
    });
  });
});
insertRows('question_folders', ['id', 'grade', 'name', 'updated_at'], folderRows);
insertRows('questions', ['id', 'folder_id', 'text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'type', 'order_num', 'updated_at'], questionRows);

sql += 'PRAGMA foreign_keys = ON;\n';
writeFileSync(join(__dirname, 'insert.sql'), sql);

console.log('insert.sql dibuat. Jumlah baris per tabel:');
for (const [t, n] of Object.entries(counts)) console.log(' -', t, ':', n);
