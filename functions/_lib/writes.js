// Pembangun statement tulis untuk D1 -- inti penjagaan edit bersamaan.
//
// Prinsip: D1 (SQLite) menjalankan query satu per satu, jadi SATU statement selalu
// atomik. Karena itu setiap cek + tulis dijadikan satu statement (bukan "baca dulu,
// baru tulis" yang punya celah waktu di antaranya):
//   - TAMBAH : id (MAX+1), urutan (MAX+1) & cek duplikat dihitung DI DALAM INSERT.
//   - EDIT   : "UPDATE ... WHERE id = ? AND updated_at IS <versi yang dilihat guru>".
//              Kalau guru lain sudah menyimpan lebih dulu, versi berbeda -> 0 baris
//              berubah -> ditolak sebagai bentrok, tidak ada yang tertimpa.
//   - HAPUS  : sama, hanya menghapus kalau versinya masih sama.
// Untuk simpan banyak baris sekaligus (db.batch = satu transaksi), setiap cek yang
// gagal memicu GUARD -> seluruh transaksi dibatalkan (semua atau tidak sama sekali).
import { jsonToRow } from './tables.js';

export const bumpVersion = (db) =>
  db.prepare("UPDATE meta SET value = value + 1 WHERE key = 'data_version'");

// Gagal (NOT NULL constraint) kalau statement sebelumnya tidak mengubah satu baris pun.
export const guardChanged = (db) =>
  db.prepare('INSERT INTO cas_guard (v) SELECT NULL WHERE changes() = 0');

// Untuk HAPUS: gagal hanya kalau tidak ada yang terhapus TAPI barisnya masih ada
// (= versinya beda). Kalau barisnya memang sudah dihapus guru lain, anggap beres.
export const guardDeleted = (db, table, id) =>
  db.prepare(`INSERT INTO cas_guard (v) SELECT NULL WHERE changes() = 0 AND EXISTS (SELECT 1 FROM ${table} WHERE id = ?)`).bind(String(id));

export const GUARD_MARK = 'cas_guard';

// Versi yang diharapkan klien: tidak dikirim -> tanpa cek; null -> baris yang belum
// pernah punya versi (data lama hasil migrasi); angka/teks angka -> angka.
export function expectedVersion(op) {
  if (!op || !Object.prototype.hasOwnProperty.call(op, 'expectedUpdatedAt') || op.expectedUpdatedAt === undefined) return { check: false };
  const v = op.expectedUpdatedAt;
  if (v === null || v === '') return { check: true, value: null };
  const n = Number(v);
  return { check: true, value: Number.isFinite(n) ? n : v };
}

export const sameVersion = (current, expected) =>
  expected === null ? current == null : current != null && Number(current) === Number(expected);

const norm = (expr) => `COALESCE(lower(trim(CAST(${expr} AS TEXT))), '')`;
const hasOrderCol = (cfg) => cfg.orderCol && cfg.orderCol !== 'rowid';

// INSERT ... SELECT ... [WHERE NOT EXISTS duplikat] RETURNING id, updated_at
// Hasil kosong = ditolak karena duplikat (lihat cfg.unique).
export function buildAdd(db, cfg, rowIn, now) {
  const data = jsonToRow(cfg, rowIn || {});
  delete data.id; delete data.updated_at;
  const cols = Object.keys(data);

  const selects = [];
  const binds = [];
  // id = MAX(bagian angka di depan id) + 1 -- sama dengan perilaku Apps Script lama.
  selects.push(`CAST(COALESCE((SELECT MAX(CAST(id AS INTEGER)) FROM ${cfg.table}), 0) + 1 AS TEXT) || ?`);
  binds.push(cfg.idSuffix || '');
  selects.push('?'); binds.push(now);

  const autoOrder = hasOrderCol(cfg) && !cols.includes(cfg.orderCol);
  if (autoOrder) {
    if (cfg.orderScope && cols.includes(cfg.orderScope)) {
      selects.push(`COALESCE((SELECT MAX(${cfg.orderCol}) FROM ${cfg.table} WHERE ${cfg.orderScope} = ?), 0) + 1`);
      binds.push(data[cfg.orderScope]);
    } else {
      selects.push(`COALESCE((SELECT MAX(${cfg.orderCol}) FROM ${cfg.table}), 0) + 1`);
    }
  }
  cols.forEach((c) => { selects.push('?'); binds.push(data[c]); });

  let where = '';
  if (cfg.unique) {
    // cfg.unique.cols = nama field JSON (sama seperti yang dikirim frontend), bukan nama kolom D1.
    const uniqCols = cfg.unique.cols.map((json) => {
      const f = cfg.fields.find(([j]) => j === json);
      if (!f) throw new Error(`Konfigurasi unique ${cfg.table} salah: field "${json}" tidak ada`);
      return f[1];
    });
    where = ` WHERE NOT EXISTS (SELECT 1 FROM ${cfg.table} WHERE ${uniqCols.map((c) => `${norm(c)} = ${norm('?')}`).join(' AND ')})`;
    uniqCols.forEach((c) => binds.push(data[c] ?? null));
  }

  const colList = ['id', 'updated_at', ...(autoOrder ? [cfg.orderCol] : []), ...cols];
  const sql = `INSERT INTO ${cfg.table} (${colList.join(', ')}) SELECT ${selects.join(', ')}${where} RETURNING id, updated_at`;
  return db.prepare(sql).bind(...binds);
}

// UPDATE ... WHERE id = ? [AND updated_at IS ?] RETURNING updated_at
// Hasil kosong = bentrok (versi beda) atau baris sudah dihapus.
// Versi baru selalu > versi lama (MAX(now, lama+1)) walau 2 simpan jatuh di milidetik sama.
export function buildUpdate(db, cfg, id, rowIn, cas, now) {
  const row = { ...(rowIn || {}) };
  delete row.id; delete row.updatedAt;
  const data = jsonToRow(cfg, row);
  const cols = Object.keys(data);
  const sets = [...cols.map((c) => `${c} = ?`), 'updated_at = MAX(?, COALESCE(updated_at, 0) + 1)'];
  const binds = [...cols.map((c) => data[c]), now, String(id)];
  let where = 'id = ?';
  if (cas.check) { where += ' AND updated_at IS ?'; binds.push(cas.value); }
  return db.prepare(`UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE ${where} RETURNING updated_at`).bind(...binds);
}

export function buildDelete(db, cfg, id, cas) {
  const binds = [String(id)];
  let where = 'id = ?';
  if (cas.check) { where += ' AND updated_at IS ?'; binds.push(cas.value); }
  return db.prepare(`DELETE FROM ${cfg.table} WHERE ${where}`).bind(...binds);
}

// Terjemahkan error database jadi pesan yang dimengerti guru.
export function friendlyDbError(err) {
  const msg = String((err && err.message) || err);
  if (/FOREIGN KEY/i.test(msg)) return 'Data induknya (folder soal / semester e-raport / siswa) sudah dihapus oleh guru lain. Muat ulang halaman.';
  if (/UNIQUE/i.test(msg)) return 'Data yang sama baru saja disimpan guru lain. Muat ulang lalu coba lagi.';
  return msg;
}
