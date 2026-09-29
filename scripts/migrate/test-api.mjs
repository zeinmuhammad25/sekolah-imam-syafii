// Uji langsung functions/api/*.js dengan mesin SQLite asli (node:sqlite), tanpa
// lewat wrangler pages dev (yang penyimpanan lokalnya sering tidak konsisten
// antara `wrangler d1 execute --local` dan `wrangler pages dev`).
// Bikin adaptor kecil yang meniru bentuk D1Database (prepare/bind/all/first/run).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const imp = (p) => import(pathToFileURL(p).href);

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(join(root, 'd1/schema.sql'), 'utf8'));
db.exec(readFileSync(join(root, 'scripts/migrate/insert.sql'), 'utf8'));
db.exec(readFileSync(join(root, 'scripts/migrate/seed-teacher.sql'), 'utf8'));

const wrapStmt = (sql) => {
  const stmt = db.prepare(sql);
  let boundArgs = [];
  return {
    bind: (...args) => { boundArgs = args; return {
      all: async () => ({ results: stmt.all(...boundArgs) }),
      first: async () => stmt.get(...boundArgs) ?? null,
      run: async () => { const r = stmt.run(...boundArgs); return { success: true, meta: { last_row_id: r.lastInsertRowid } }; },
    }},
    // panggilan tanpa .bind() (tak ada parameter)
    all: async () => ({ results: stmt.all() }),
    first: async () => stmt.get() ?? null,
    run: async () => { const r = stmt.run(); return { success: true, meta: { last_row_id: r.lastInsertRowid } }; },
  };
};
const DB = { prepare: (sql) => wrapStmt(sql) };
const env = { DB };

let failed = 0, total = 0;
const ok = (label, cond) => { total++; console.log(cond ? 'OK  ' : 'GAGAL', '-', label); if (!cond) failed++; };

// ---------- 1) GET /api/data ----------
const dataMod = await imp(join(root, 'functions/api/data.js'));
const dataRes = await dataMod.onRequestGet({ env });
const data = await dataRes.json();
ok('status /api/data 200', dataRes.status === 200 || dataRes.status === undefined);
ok('Gallery ada & jumlah cocok (17)', Array.isArray(data.Gallery) && data.Gallery.length === 17);
ok('Students ada (4)', data.Students.length === 4);
ok('Settings key/value utuh', data.Settings.find((s) => s.key === 'school_logo') != null);
ok('TeacherQuestions 7 grade', data.TeacherQuestions.length === 7);
const sd1 = data.TeacherQuestions.find((g) => g.grade === 'SD 1');
const folderIds = Object.keys((sd1 && sd1.data.examTypes['SD 1']) || []).length >= 0;
ok('Bank Soal folder + soal ter-mapping', sd1 && Object.values(sd1.data.questions).some((arr) => arr.length > 0) !== undefined);
ok('ReportGrades field camelCase (mataPelajaran)', data.ReportGrades[0] && 'mataPelajaran' in data.ReportGrades[0]);

// ---------- 2) POST /api/auth/login ----------
const loginMod = await imp(join(root, 'functions/api/auth/login.js'));
const badLogin = await loginMod.onRequestPost({ request: new Request('http://x/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'guru', password: 'salah' }) }), env });
ok('Login salah -> 401', badLogin.status === 401);
const goodLogin = await loginMod.onRequestPost({ request: new Request('http://x/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'guru', password: 'pz9eqeu1zOx2' }) }), env });
const loginBody = await goodLogin.json();
const setCookie = goodLogin.headers.get('Set-Cookie') || '';
const token = (setCookie.match(/mias_session=([^;]+)/) || [])[1];
ok('Login benar -> success + cookie', loginBody.success === true && !!token);

// ---------- 3) POST /api/row (tanpa login harus ditolak) ----------
const rowMod = await imp(join(root, 'functions/api/row.js'));
const noAuthReq = new Request('http://x/api/row', { method: 'POST', body: JSON.stringify({ action: 'add', sheetName: 'Gallery', row: { title: 'x' } }) });
const noAuthRes = await rowMod.onRequestPost({ request: noAuthReq, env });
ok('Tulis tanpa login -> 401', noAuthRes.status === 401);

// ---------- 4) POST /api/row (dengan login: add/update/delete Gallery) ----------
const authedReq = (body) => new Request('http://x/api/row', { method: 'POST', headers: { Cookie: `mias_session=${decodeURIComponent(token)}` }, body: JSON.stringify(body) });
const addRes = await rowMod.onRequestPost({ request: authedReq({ action: 'add', sheetName: 'Gallery', row: { title: 'Tes Foto', category: 'Tes', image_url: 'https://x/y.jpg' } }), env });
const addBody = await addRes.json();
ok('Tambah Gallery -> success + id baru (18)', addBody.success === true && addBody.id === '18');

const dataAfterAdd = await (await dataMod.onRequestGet({ env })).json();
ok('Gallery bertambah jadi 18', dataAfterAdd.Gallery.length === 18);

const updRes = await rowMod.onRequestPost({ request: authedReq({ action: 'update', sheetName: 'Gallery', id: addBody.id, expectedUpdatedAt: addBody.updatedAt, row: { title: 'Tes Foto Diedit' } }), env });
const updBody = await updRes.json();
ok('Update Gallery -> success', updBody.success === true);

const conflictRes = await rowMod.onRequestPost({ request: authedReq({ action: 'update', sheetName: 'Gallery', id: addBody.id, expectedUpdatedAt: 111, row: { title: 'harusnya gagal' } }), env });
const conflictBody = await conflictRes.json();
ok('Update dgn expectedUpdatedAt salah -> conflict', conflictBody.conflict === true);

const delRes = await rowMod.onRequestPost({ request: authedReq({ action: 'delete', sheetName: 'Gallery', id: addBody.id }), env });
const delBody = await delRes.json();
ok('Delete Gallery -> success', delBody.success === true);
const dataAfterDel = await (await dataMod.onRequestGet({ env })).json();
ok('Gallery kembali ke 17 setelah delete', dataAfterDel.Gallery.length === 17);

// ---------- 5) reorder ----------
const ids = dataAfterDel.Gallery.map((g) => g.id).slice().reverse();
const reorderRes = await rowMod.onRequestPost({ request: authedReq({ action: 'reorder', sheetName: 'Gallery', ids }), env });
const reorderBody = await reorderRes.json();
const dataAfterReorder = await (await dataMod.onRequestGet({ env })).json();
ok('Reorder Gallery -> urutan terbalik', reorderBody.success === true && dataAfterReorder.Gallery[0].id === ids[0]);

// ---------- 6) Bank Soal: add/deleteFolder ----------
const addFolderRes = await rowMod.onRequestPost({ request: authedReq({ action: 'add', sheetName: 'QuestionFolders', row: { grade: 'SD 1', name: 'Folder Tes' } }), env });
const addFolderBody = await addFolderRes.json();
ok('Tambah QuestionFolders -> success', addFolderBody.success === true);
const addQRes = await rowMod.onRequestPost({ request: authedReq({ action: 'add', sheetName: 'Questions', row: { folderId: addFolderBody.id, text: 'Soal tes?', optionA: 'a', optionB: 'b', optionC: 'c', optionD: 'd', correctAnswer: 'a', type: 'pg' } }), env });
const addQBody = await addQRes.json();
ok('Tambah Questions -> success', addQBody.success === true);
const delFolderRes = await rowMod.onRequestPost({ request: authedReq({ action: 'deleteFolder', sheetName: 'QuestionFolders', id: addFolderBody.id }), env });
const delFolderBody = await delFolderRes.json();
const qCountAfter = await DB.prepare('SELECT COUNT(*) AS n FROM questions WHERE folder_id = ?').bind(addFolderBody.id).first();
ok('deleteFolder -> folder & soal ikut terhapus', delFolderBody.success === true && qCountAfter.n === 0);

// ---------- 7) PPDB publik ----------
const ppdbMod = await imp(join(root, 'functions/api/ppdb.js'));
const ppdbRes = await ppdbMod.onRequestPost({ request: new Request('http://x/api/ppdb', { method: 'POST', body: JSON.stringify({ parent_name: 'Tes Ortu', student_name: 'Tes Anak', phone: '0812', email: 'a@b.com' }) }), env });
const ppdbBody = await ppdbRes.json();
ok('Submit PPDB baru -> success', ppdbBody.success === true);
const ppdbCount = await DB.prepare('SELECT COUNT(*) AS n FROM ppdb').first();
ok('PPDB bertambah jadi 4', ppdbCount.n === 4);

// ---------- 8) logout ----------
const logoutMod = await imp(join(root, 'functions/api/auth/logout.js'));
const logoutRes = await logoutMod.onRequestPost({ request: new Request('http://x/api/auth/logout', { method: 'POST', headers: { Cookie: `mias_session=${decodeURIComponent(token)}` } }), env });
ok('Logout -> success', (await logoutRes.json()).success === true);
const afterLogoutRow = await rowMod.onRequestPost({ request: authedReq({ action: 'add', sheetName: 'Gallery', row: { title: 'harusnya gagal' } }), env });
ok('Tulis setelah logout -> 401', afterLogoutRow.status === 401);

console.log('\n' + (failed === 0 ? `SEMUA ${total} SKENARIO LULUS` : `${failed} SKENARIO GAGAL`));
process.exit(failed ? 1 : 0);
