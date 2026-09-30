// POST /api/row -- tulis data dashboard-guru (pengganti handleRow Apps Script).
// Semua aksi wajib login. Aman untuk banyak guru sekaligus -- lihat functions/_lib/writes.js.
//
// Aksi: add | update | delete | deleteFolder | reorder | reorderQuestions | batch
//   batch: { ops: [{ action: add|update|delete, sheetName, id?, row?, expectedUpdatedAt? }] }
//          -> satu transaksi: semua tersimpan, atau (kalau ada yang bentrok) tidak ada sama sekali.
import { TABLES, rowToJson } from '../_lib/tables.js';
import { requireSession, json } from '../_lib/auth.js';
import {
  bumpVersion, guardChanged, guardDeleted, GUARD_MARK, expectedVersion, sameVersion,
  buildAdd, buildUpdate, buildDelete, friendlyDbError,
} from '../_lib/writes.js';

const MAX_BATCH_OPS = 300;
const CONFLICT_MSG = 'Data ini baru saja diubah oleh guru lain. Perubahan Anda belum tersimpan — muat ulang untuk melihat versi terbaru, lalu ulangi.';
const GONE_MSG = 'Data ini sudah dihapus oleh guru lain.';

const readRow = (db, cfg, id) => db.prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).bind(String(id)).first();

async function singleAdd(db, cfg, row) {
  const [res] = await db.batch([buildAdd(db, cfg, row, Date.now()), bumpVersion(db)]);
  const out = res.results && res.results[0];
  if (!out) return { success: false, duplicate: true, error: (cfg.unique && cfg.unique.message) || 'Data duplikat.' };
  return { success: true, id: String(out.id), updatedAt: out.updated_at };
}

async function singleUpdate(db, cfg, params) {
  const id = String(params.id != null ? params.id : (params.row || {}).id);
  const cas = expectedVersion(params);
  const [res] = await db.batch([buildUpdate(db, cfg, id, params.row, cas, Date.now()), bumpVersion(db)]);
  const out = res.results && res.results[0];
  if (out) return { success: true, id, updatedAt: out.updated_at };
  const cur = await readRow(db, cfg, id);
  if (!cur) return { success: false, notFound: true, error: GONE_MSG };
  return { success: false, conflict: true, error: CONFLICT_MSG, current: rowToJson(cfg, cur) };
}

async function singleDelete(db, cfg, params) {
  const id = String(params.id);
  const cas = expectedVersion(params);
  const [res] = await db.batch([buildDelete(db, cfg, id, cas), bumpVersion(db)]);
  if (res.meta && res.meta.changes > 0) return { success: true };
  const cur = await readRow(db, cfg, id);
  if (!cur) return { success: true, alreadyDeleted: true }; // sudah dihapus guru lain -> tujuan tercapai
  return { success: false, conflict: true, error: 'Data ini baru saja diubah oleh guru lain, jadi tidak dihapus. Muat ulang dulu untuk melihat perubahannya.', current: rowToJson(cfg, cur) };
}

async function runBatch(db, ops) {
  if (!Array.isArray(ops) || ops.length === 0) return { success: true, results: [] };
  if (ops.length > MAX_BATCH_OPS) return { success: false, error: `Terlalu banyak perubahan sekaligus (maks ${MAX_BATCH_OPS}).` };

  const now = Date.now();
  const stmts = [];
  const plan = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i] || {};
    const cfg = TABLES[op.sheetName];
    if (!cfg) return { success: false, error: 'sheet tidak diizinkan: ' + op.sheetName };
    const cas = expectedVersion(op);
    if (op.action === 'add') {
      plan.push({ i, kind: 'add', idx: stmts.length, cfg });
      stmts.push(buildAdd(db, cfg, op.row, now));
      if (cfg.unique) stmts.push(guardChanged(db)); // duplikat -> batalkan semuanya
    } else if (op.action === 'update') {
      if (op.id == null) return { success: false, error: 'id wajib untuk update' };
      plan.push({ i, kind: 'update', idx: stmts.length, cfg, id: String(op.id), cas });
      stmts.push(buildUpdate(db, cfg, op.id, op.row, cas, now));
      stmts.push(guardChanged(db)); // bentrok / sudah dihapus -> batalkan semuanya
    } else if (op.action === 'delete') {
      if (op.id == null) return { success: false, error: 'id wajib untuk delete' };
      plan.push({ i, kind: 'delete', idx: stmts.length, cfg, id: String(op.id), cas });
      stmts.push(buildDelete(db, cfg, op.id, cas));
      if (cas.check) stmts.push(guardDeleted(db, cfg.table, op.id));
    } else {
      return { success: false, error: 'action batch tidak dikenal: ' + op.action };
    }
  }
  stmts.push(bumpVersion(db));

  try {
    const res = await db.batch(stmts);
    const results = plan.map((p) => {
      const r = res[p.idx];
      const out = r.results && r.results[0];
      if (p.kind === 'add') return { success: true, id: String(out.id), updatedAt: out.updated_at };
      if (p.kind === 'update') return { success: true, id: p.id, updatedAt: out.updated_at };
      return { success: true, id: p.id };
    });
    return { success: true, results };
  } catch (err) {
    if (!String((err && err.message) || err).includes(GUARD_MARK)) {
      return { success: false, error: friendlyDbError(err) };
    }
    // Transaksi dibatalkan -> TIDAK ADA yang tersimpan. Cari baris mana penyebabnya.
    const conflicts = [];
    for (const p of plan) {
      if (p.kind === 'add') continue;
      const cur = await readRow(db, p.cfg, p.id);
      if (p.kind === 'update' && !cur) conflicts.push({ index: p.i, id: p.id, notFound: true });
      else if (cur && p.cas.check && !sameVersion(cur.updated_at, p.cas.value)) conflicts.push({ index: p.i, id: p.id, current: rowToJson(p.cfg, cur) });
    }
    return {
      success: false, conflict: true, conflicts,
      error: conflicts.length
        ? `${conflicts.length} baris baru saja diubah/dihapus oleh guru lain. Tidak ada yang tersimpan — muat ulang untuk melihat versi terbaru, lalu ulangi.`
        : 'Ada data duplikat atau bentrok dengan perubahan guru lain. Tidak ada yang tersimpan — muat ulang lalu ulangi.',
    };
  }
}

export async function onRequestPost({ request, env }) {
  const session = await requireSession(request, env);
  if (!session) return json({ success: false, error: 'Sesi login habis. Silakan login ulang.' }, { status: 401 });

  let params;
  try { params = await request.json(); } catch { return json({ success: false, error: 'Body tidak valid' }, { status: 400 }); }

  const db = env.DB;
  const { action, sheetName } = params;

  try {
    if (action === 'batch') return json(await runBatch(db, params.ops));

    const cfg = TABLES[sheetName];
    if (!cfg) return json({ success: false, error: 'sheet tidak diizinkan' });

    if (action === 'add') return json(await singleAdd(db, cfg, params.row));
    if (action === 'update') return json(await singleUpdate(db, cfg, params));
    if (action === 'delete') return json(await singleDelete(db, cfg, params));

    if (action === 'deleteFolder') {
      // Folder + seluruh soalnya dalam satu transaksi.
      // `ids` (opsional) = soal di folder ini yang TERLIHAT oleh guru saat menekan hapus. Kalau
      // ternyata ada soal lain (baru ditambah guru lain yang belum ia lihat), penghapusan DITOLAK
      // supaya kerja guru lain tidak ikut terhapus tanpa sepengetahuannya.
      const id = String(params.id);
      const stmts = [];
      if (Array.isArray(params.ids)) {
        const seen = params.ids.map(String);
        const notSeen = seen.length ? ` AND id NOT IN (${seen.map(() => '?').join(', ')})` : '';
        stmts.push(db.prepare(`INSERT INTO cas_guard (v) SELECT NULL WHERE EXISTS (SELECT 1 FROM questions WHERE folder_id = ?${notSeen})`).bind(id, ...seen));
      }
      stmts.push(
        db.prepare('DELETE FROM questions WHERE folder_id = ?').bind(id),
        db.prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).bind(id),
        bumpVersion(db),
      );
      try {
        await db.batch(stmts);
      } catch (err) {
        if (String((err && err.message) || err).includes(GUARD_MARK)) {
          return json({ success: false, conflict: true, error: 'Folder ini baru saja ditambah soal oleh guru lain, jadi TIDAK dihapus. Muat ulang untuk melihat soal barunya dulu.' });
        }
        throw err;
      }
      return json({ success: true });
    }

    if (action === 'reorderQuestions' || action === 'reorder') {
      const col = action === 'reorderQuestions' ? 'order_num' : cfg.orderCol;
      const table = action === 'reorderQuestions' ? 'questions' : cfg.table;
      if (!col || col === 'rowid') return json({ success: false, error: 'tabel ini tidak mendukung reorder' });
      const ids = (params.ids || []).map(String);
      // Satu transaksi, satu kali bolak-balik ke database. updated_at sengaja TIDAK
      // diubah: mengatur urutan tidak boleh membuat form edit guru lain jadi "bentrok".
      await db.batch([
        ...ids.map((id, i) => db.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`).bind(i + 1, id)),
        bumpVersion(db),
      ]);
      return json({ success: true });
    }

    return json({ success: false, error: 'action tidak dikenal: ' + action });
  } catch (err) {
    return json({ success: false, error: friendlyDbError(err) });
  }
}
