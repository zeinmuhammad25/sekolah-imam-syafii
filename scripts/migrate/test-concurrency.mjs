// Uji penjagaan edit bersamaan: banyak guru menyimpan di waktu yang sama persis
// (Promise.all -> request benar-benar saling menyela di setiap await, seperti di server).
import { createEnv, imp, loginToken, makeChecker } from './_d1.mjs';

const { env, sqlite } = createEnv();
const { ok, done } = makeChecker();
const rowMod = await imp('functions/api/row.js');
const dataMod = await imp('functions/api/data.js');

// 6 "guru" = 6 sesi login terpisah.
const tokens = [];
for (let i = 0; i < 6; i++) tokens.push(await loginToken(env));
const call = async (body, t = 0) => (await rowMod.onRequestPost({ request: new Request('http://x/api/row', { method: 'POST', headers: { Cookie: `mias_session=${tokens[t]}` }, body: JSON.stringify(body) }), env })).json();
const q = (sql, ...a) => sqlite.prepare(sql).all(...a);
const one = (sql, ...a) => sqlite.prepare(sql).get(...a);
const snapshot = async (headers = {}) => dataMod.onRequestGet({ request: new Request('http://x/api/data', { headers }), env });

console.log('\n=== BANK SOAL (5+ guru bersamaan) ===');
const F = one('SELECT folder_id f FROM questions GROUP BY folder_id ORDER BY COUNT(*) DESC LIMIT 1').f;
const maxOrderBefore = one('SELECT MAX(order_num) m FROM questions WHERE folder_id = ?', F).m;
const qRow = (text) => ({ folderId: F, text, optionA: 'a', optionB: 'b', optionC: 'c', optionD: 'd', correctAnswer: 'a', type: 'pg' });

const adds = await Promise.all([0, 1, 2, 3, 4].map((t) => call({ action: 'add', sheetName: 'Questions', row: qRow(`Soal guru ${t}`) }, t)));
const addIds = adds.map((r) => r.id);
ok('5 guru tambah soal bersamaan -> semua berhasil', adds.every((r) => r.success));
ok('5 soal baru dapat ID berbeda semua (tidak ada tabrakan ID)', new Set(addIds).size === 5);
const newOrders = q(`SELECT order_num o FROM questions WHERE id IN (${addIds.map(() => '?').join(',')})`, ...addIds).map((r) => r.o);
ok('Urutan 5 soal baru unik & semuanya di akhir folder', new Set(newOrders).size === 5 && Math.min(...newOrders) > maxOrderBefore);

const target = one('SELECT id, updated_at u FROM questions WHERE id = ?', addIds[0]);
const edits = await Promise.all([0, 1, 2, 3, 4].map((t) => call({ action: 'update', sheetName: 'Questions', id: target.id, expectedUpdatedAt: target.u, row: qRow(`Versi guru ${t}`) }, t)));
const winners = edits.filter((r) => r.success);
ok('5 guru edit soal yang SAMA bersamaan -> tepat 1 berhasil', winners.length === 1);
ok('4 guru lainnya ditolak sebagai bentrok (tidak menimpa diam-diam)', edits.filter((r) => r.conflict).length === 4);
const winnerIdx = edits.findIndex((r) => r.success);
ok('Isi soal = milik pemenang, bukan tertimpa guru terakhir', one('SELECT text FROM questions WHERE id = ?', target.id).text === `Versi guru ${winnerIdx}`);
ok('Guru yang bentrok menerima versi terbaru untuk ditampilkan', edits.find((r) => r.conflict).current.text === `Versi guru ${winnerIdx}`);

// Guru A buka soal (versi v1), guru B menyimpan dulu, lalu A menghapus -> jangan hapus kerja B.
const s2 = one('SELECT id, updated_at u FROM questions WHERE id = ?', addIds[1]);
const bSave = await call({ action: 'update', sheetName: 'Questions', id: s2.id, expectedUpdatedAt: s2.u, row: qRow('Diperbaiki guru B') }, 1);
const aDel = await call({ action: 'delete', sheetName: 'Questions', id: s2.id, expectedUpdatedAt: s2.u }, 0);
ok('Hapus soal yang barusan diedit guru lain -> DITOLAK', bSave.success && aDel.success === false && aDel.conflict);
ok('Soal hasil edit guru B tetap aman', one('SELECT text FROM questions WHERE id = ?', s2.id).text === 'Diperbaiki guru B');

// A hapus lebih dulu, B lalu menyimpan editan -> B diberi tahu soal sudah dihapus.
const s3 = one('SELECT id, updated_at u FROM questions WHERE id = ?', addIds[2]);
await call({ action: 'delete', sheetName: 'Questions', id: s3.id, expectedUpdatedAt: s3.u }, 0);
const bLate = await call({ action: 'update', sheetName: 'Questions', id: s3.id, expectedUpdatedAt: s3.u, row: qRow('telat') }, 1);
ok('Edit soal yang sudah dihapus guru lain -> ditolak "sudah dihapus"', bLate.success === false && bLate.notFound === true);

const dbl = await Promise.all([0, 1].map((t) => call({ action: 'delete', sheetName: 'Questions', id: addIds[3] }, t)));
ok('2 guru hapus soal yang sama bersamaan -> keduanya aman (tidak error)', dbl.every((r) => r.success));

// Folder dihapus sementara 3 guru menambah soal ke folder itu.
const fNew = await call({ action: 'add', sheetName: 'QuestionFolders', row: { grade: 'SD 3', name: 'UTS Tes Race' } });
const race = await Promise.all([
  call({ action: 'add', sheetName: 'Questions', row: { ...qRow('r1'), folderId: fNew.id } }, 1),
  call({ action: 'deleteFolder', sheetName: 'QuestionFolders', id: fNew.id }, 0),
  call({ action: 'add', sheetName: 'Questions', row: { ...qRow('r2'), folderId: fNew.id } }, 2),
  call({ action: 'add', sheetName: 'Questions', row: { ...qRow('r3'), folderId: fNew.id } }, 3),
]);
ok('Hapus folder vs tambah soal bersamaan -> tidak ada soal "yatim" tertinggal', one('SELECT COUNT(*) n FROM questions WHERE folder_id = ?', fNew.id).n === 0);
ok('Guru yang menambah setelah folder dihapus diberi pesan jelas', race.filter((r) => !r.success).every((r) => /dihapus/.test(r.error)));

// Guru A melihat folder berisi 1 soal lalu menekan hapus, padahal guru B baru menambah soal ke sana.
const fB = await call({ action: 'add', sheetName: 'QuestionFolders', row: { grade: 'SD 4', name: 'Folder Dikerjakan B' } });
const q1 = await call({ action: 'add', sheetName: 'Questions', row: { ...qRow('dilihat A'), folderId: fB.id } }, 0);
await call({ action: 'add', sheetName: 'Questions', row: { ...qRow('baru dari B'), folderId: fB.id } }, 1);
const delStale = await call({ action: 'deleteFolder', sheetName: 'QuestionFolders', id: fB.id, ids: [q1.id] }, 0);
ok('Hapus folder yang baru diisi soal oleh guru lain -> DITOLAK', delStale.success === false && delStale.conflict);
ok('Folder & semua soal (termasuk kerja guru B) tetap utuh', one('SELECT COUNT(*) n FROM questions WHERE folder_id = ?', fB.id).n === 2 && !!one('SELECT id FROM question_folders WHERE id = ?', fB.id));
const allIds = q('SELECT id FROM questions WHERE folder_id = ?', fB.id).map((r) => r.id);
const delFresh = await call({ action: 'deleteFolder', sheetName: 'QuestionFolders', id: fB.id, ids: allIds }, 0);
ok('Setelah melihat soal terbaru, hapus folder berhasil (folder + soal terhapus bersih)', delFresh.success && one('SELECT COUNT(*) n FROM questions WHERE folder_id = ?', fB.id).n === 0);

const dupF = await Promise.all([0, 1].map((t) => call({ action: 'add', sheetName: 'QuestionFolders', row: { grade: 'SD 2', name: t ? '  pts ganjil ' : 'PTS Ganjil' } }, t)));
ok('2 guru buat folder nama sama bersamaan -> hanya 1 terbuat', dupF.filter((r) => r.success).length === 1 && dupF.filter((r) => r.duplicate).length === 1);
ok('Folder kembar tidak ada di database', one("SELECT COUNT(*) n FROM question_folders WHERE grade = 'SD 2' AND lower(trim(name)) = 'pts ganjil'").n === 1);

const listIds = q('SELECT id FROM questions WHERE folder_id = ? ORDER BY order_num', F).map((r) => r.id);
const [reo, lateAdd] = await Promise.all([
  call({ action: 'reorderQuestions', sheetName: 'Questions', ids: [...listIds].reverse() }, 0),
  call({ action: 'add', sheetName: 'Questions', row: qRow('Soal saat reorder') }, 1),
]);
const lastInFolder = one('SELECT id FROM questions WHERE folder_id = ? ORDER BY order_num DESC LIMIT 1', F).id;
ok('Atur urutan + tambah soal bersamaan -> soal baru tetap di paling akhir', reo.success && lateAdd.success && lastInFolder === lateAdd.id);
const beforeReoU = one('SELECT updated_at u FROM questions WHERE id = ?', listIds[0]).u;
await call({ action: 'reorderQuestions', sheetName: 'Questions', ids: listIds });
ok('Atur urutan TIDAK mengubah versi soal (form edit guru lain tidak jadi bentrok)', one('SELECT updated_at u FROM questions WHERE id = ?', listIds[0]).u === beforeReoU);

console.log('\n=== E-RAPORT ===');
const stu = one('SELECT id FROM students ORDER BY rowid LIMIT 1').id;
const perDup = await Promise.all([0, 1].map((t) => call({ action: 'add', sheetName: 'ReportPeriods', row: { studentId: stu, kelas: 'SD 1', tahunAjaran: '2030/2031', semester: '1' } }, t)));
ok('2 guru buat semester yang sama untuk siswa yang sama -> hanya 1 terbuat', perDup.filter((r) => r.success).length === 1 && perDup.filter((r) => r.duplicate).length === 1);
const P = perDup.find((r) => r.success).id;

const g0 = await call({ action: 'batch', ops: [
  { action: 'add', sheetName: 'ReportGrades', row: { reportPeriodId: P, kelompok: 'umum', mataPelajaran: 'Matematika', nilaiAngka: '80' } },
  { action: 'add', sheetName: 'ReportGrades', row: { reportPeriodId: P, kelompok: 'umum', mataPelajaran: 'IPA', nilaiAngka: '85' } },
  { action: 'add', sheetName: 'ReportGrades', row: { reportPeriodId: P, kelompok: 'mulok', mataPelajaran: 'Tahfidz', nilaiAngka: '90' } },
] });
ok('Simpan 3 nilai sekaligus -> 1 transaksi, semua berhasil', g0.success && g0.results.length === 3 && new Set(g0.results.map((r) => r.id)).size === 3);
const [mat, ipa, tah] = g0.results;

// Dua guru sama-sama membuka tabel nilai (versi sama) lalu menyimpan bersamaan.
const [bA, bB] = await Promise.all([
  call({ action: 'batch', ops: [
    { action: 'update', sheetName: 'ReportGrades', id: mat.id, expectedUpdatedAt: mat.updatedAt, row: { nilaiAngka: '88' } },
    { action: 'add', sheetName: 'ReportGrades', row: { reportPeriodId: P, kelompok: 'umum', mataPelajaran: 'Bahasa A' } },
  ] }, 0),
  call({ action: 'batch', ops: [
    { action: 'update', sheetName: 'ReportGrades', id: mat.id, expectedUpdatedAt: mat.updatedAt, row: { nilaiAngka: '70' } },
    { action: 'add', sheetName: 'ReportGrades', row: { reportPeriodId: P, kelompok: 'umum', mataPelajaran: 'Bahasa B' } },
    { action: 'delete', sheetName: 'ReportGrades', id: ipa.id, expectedUpdatedAt: ipa.updatedAt },
  ] }, 1),
]);
const winner = bA.success ? 'A' : 'B';
ok('2 guru simpan tabel nilai bersamaan -> tepat 1 berhasil', [bA, bB].filter((r) => r.success).length === 1);
ok('Guru yang kalah: TIDAK ADA satu pun barisnya yang tersimpan (tidak setengah-setengah)',
  one("SELECT COUNT(*) n FROM report_grades WHERE mata_pelajaran = ?", winner === 'A' ? 'Bahasa B' : 'Bahasa A').n === 0
  && (winner === 'B' || one('SELECT COUNT(*) n FROM report_grades WHERE id = ?', ipa.id).n === 1));
ok('Guru yang kalah diberi tahu baris mana yang bentrok', (bA.success ? bB : bA).conflicts.some((c) => c.id === mat.id));
ok('Nilai akhir = milik pemenang', one('SELECT nilai_angka v FROM report_grades WHERE id = ?', mat.id).v === (winner === 'A' ? '88' : '70'));

// Baris yang mau dihapus ternyata sudah dihapus guru lain -> tidak menggagalkan simpan.
const tahNow = one('SELECT updated_at u FROM report_grades WHERE id = ?', tah.id).u;
await call({ action: 'delete', sheetName: 'ReportGrades', id: tah.id }, 2);
const gone = await call({ action: 'batch', ops: [
  { action: 'delete', sheetName: 'ReportGrades', id: tah.id, expectedUpdatedAt: tahNow },
  { action: 'add', sheetName: 'ReportGrades', row: { reportPeriodId: P, kelompok: 'mulok', mataPelajaran: 'Tahsin' } },
] });
ok('Hapus baris yang sudah dihapus guru lain -> simpan tetap berhasil', gone.success);

// Semester dihapus guru lain sementara guru ini menyimpan nilai.
const perVer = one('SELECT updated_at u FROM report_periods WHERE id = ?', P).u;
await call({ action: 'delete', sheetName: 'ReportPeriods', id: P, expectedUpdatedAt: perVer }, 3);
const orphan = await call({ action: 'batch', ops: [{ action: 'add', sheetName: 'ReportGrades', row: { reportPeriodId: P, kelompok: 'umum', mataPelajaran: 'Yatim' } }] });
ok('Simpan nilai ke semester yang sudah dihapus -> ditolak dgn pesan jelas', orphan.success === false && /dihapus/.test(orphan.error));
ok('Tidak ada nilai "yatim" & nilai lama ikut terhapus bersama semesternya', one('SELECT COUNT(*) n FROM report_grades WHERE report_period_id = ?', P).n === 0);

const per5 = one('SELECT id, updated_at u FROM report_periods ORDER BY rowid DESC LIMIT 1');
const c1 = await call({ action: 'update', sheetName: 'ReportPeriods', id: per5.id, expectedUpdatedAt: per5.u, row: { catatanWaliKelas: 'catatan guru 1' } }, 0);
const c2 = await call({ action: 'update', sheetName: 'ReportPeriods', id: per5.id, expectedUpdatedAt: per5.u, row: { catatanWaliKelas: 'catatan guru 2' } }, 1);
ok('Catatan guru (semester) diedit 2 guru dari versi sama -> yang kedua ditolak', c1.success && c2.conflict);

console.log('\n=== DATA SISWA ===');
const sDup = await Promise.all([0, 1, 2].map((t) => call({ action: 'add', sheetName: 'Students', row: { nama_siswa: ['Ahmad Fauzi', ' ahmad fauzi', 'AHMAD FAUZI  '][t], kelas: 'SD 1' } }, t)));
ok('3 guru tambah siswa bernama sama bersamaan -> hanya 1 terdaftar', sDup.filter((r) => r.success).length === 1 && one("SELECT COUNT(*) n FROM students WHERE lower(trim(nama_siswa)) = 'ahmad fauzi'").n === 1);

const imports = await Promise.all(Array.from({ length: 20 }, (_, i) => call({ action: 'add', sheetName: 'Students', row: { nama_siswa: `Import ${i}`, kelas: 'TK' } }, i % 6)));
ok('Import 20 siswa bersamaan dari beberapa guru -> 20 ID unik', imports.every((r) => r.success) && new Set(imports.map((r) => r.id)).size === 20);

const st = one("SELECT id, updated_at u FROM students WHERE nama_siswa = 'Import 0'");
const [naik, edit] = await Promise.all([
  call({ action: 'update', sheetName: 'Students', id: st.id, expectedUpdatedAt: st.u, row: { kelas: 'SD 1' } }, 0),
  call({ action: 'update', sheetName: 'Students', id: st.id, expectedUpdatedAt: st.u, row: { alamat: 'Jl. Baru' } }, 1),
]);
ok('Naik kelas (guru A) & edit alamat (guru B) bersamaan -> satu ditolak, tidak saling timpa', [naik, edit].filter((r) => r.success).length === 1 && [naik, edit].filter((r) => r.conflict).length === 1);

const legacy = one('SELECT id FROM students WHERE updated_at IS NULL LIMIT 1');
if (legacy) {
  const l1 = await call({ action: 'update', sheetName: 'Students', id: legacy.id, expectedUpdatedAt: null, row: { alamat: 'x' } });
  const l2 = await call({ action: 'update', sheetName: 'Students', id: legacy.id, expectedUpdatedAt: null, row: { alamat: 'y' } });
  ok('Data lama (tanpa versi) bisa diedit, lalu terlindungi setelahnya', l1.success && l2.conflict);
}

console.log('\n=== UMUM & PERFORMA ===');
const posMax = one('SELECT MAX(position) m FROM gallery').m;
const gAdd = await call({ action: 'add', sheetName: 'Gallery', row: { title: 'Foto baru', category: 'Tes', image_url: 'u' } });
const snap1 = await (await snapshot()).json();
ok('Item galeri baru tampil paling AKHIR (seperti di Sheets dulu)', snap1.Gallery[snap1.Gallery.length - 1].id === gAdd.id && one('SELECT position p FROM gallery WHERE id = ?', gAdd.id).p === posMax + 1);
const nAdd = await call({ action: 'add', sheetName: 'News', row: { title: 'Berita tes' } });
ok('ID berita tetap format "<angka>-News"', /^\d+-News$/.test(nAdd.id));

const r1 = await snapshot();
const etag = r1.headers.get('ETag');
ok('/api/data mengirim ETag versi data', !!etag && typeof (await r1.json())._version === 'number');
const r2 = await snapshot({ 'If-None-Match': etag });
ok('Data belum berubah -> 304 (browser pakai salinannya, tanpa unduh ulang)', r2.status === 304);
await call({ action: 'update', sheetName: 'Gallery', id: gAdd.id, expectedUpdatedAt: gAdd.updatedAt, row: { title: 'Foto baru 2' } });
const r3 = await snapshot({ 'If-None-Match': etag });
ok('Setelah ada yang menyimpan -> data baru langsung terkirim (tidak basi)', r3.status === 200 && (await r3.json()).Gallery.some((g) => g.title === 'Foto baru 2'));

sqlite.prepare('UPDATE gallery SET updated_at = ? WHERE id = ?').run(Date.now() + 60000, gAdd.id);
const fut = one('SELECT updated_at u FROM gallery WHERE id = ?', gAdd.id).u;
const bump = await call({ action: 'update', sheetName: 'Gallery', id: gAdd.id, expectedUpdatedAt: fut, row: { title: 'jam server beda' } });
ok('Versi baru selalu lebih besar dari versi lama (walau jam/ms sama)', bump.success && bump.updatedAt > fut);

done();
