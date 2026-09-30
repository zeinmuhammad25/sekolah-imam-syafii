-- ============================================================
-- 0002: Penjagaan edit bersamaan (banyak guru) + performa.
-- Aman dijalankan berkali-kali (idempotent).
-- ============================================================

-- Nomor versi seluruh data. Naik +1 di SETIAP penulisan (dalam transaksi yang
-- sama dengan perubahannya) -> dipakai /api/data untuk cache & ETag, sehingga
-- data yang tidak berubah tidak perlu dibaca ulang dari database.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO meta (key, value) VALUES ('data_version', 1);

-- Tabel "penjaga" yang tidak pernah berisi baris. Saat menyimpan banyak baris
-- sekaligus (mis. nilai e-raport), setiap pengecekan versi yang gagal memaksa
-- INSERT NULL ke kolom NOT NULL ini -> seluruh transaksi dibatalkan (semua atau
-- tidak sama sekali), jadi tidak pernah ada data yang tersimpan setengah.
CREATE TABLE IF NOT EXISTS cas_guard (
  v INTEGER NOT NULL
);

-- Normalisasi urutan yang kosong/0 dari hasil migrasi Sheets, supaya item baru
-- (yang otomatis ditaruh di MAX+1) muncul paling akhir, bukan di tengah/atas.
UPDATE videos
   SET order_num = (SELECT COUNT(*) FROM videos v2 WHERE v2.rowid <= videos.rowid)
 WHERE order_num IS NULL OR order_num = 0;

UPDATE questions
   SET order_num = (SELECT COUNT(*) FROM questions q2
                     WHERE q2.folder_id = questions.folder_id AND q2.rowid <= questions.rowid)
 WHERE order_num IS NULL;
