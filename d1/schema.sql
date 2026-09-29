-- ============================================================
-- Skema Cloudflare D1 (SQLite) — pengganti Google Sheets.
-- Mengikuti struktur tab yang didokumentasikan di readmi.md.
--
-- Konvensi:
--   - `id` tetap TEXT (bukan INTEGER autoincrement) supaya id lama dari Sheets
--     (termasuk format khusus seperti "12-News") bisa dipindah apa adanya.
--   - `updated_at` INTEGER = epoch ms (Date.now()), sama seperti kolom
--     `updatedAt` di Apps Script sekarang -> dipakai untuk optimistic concurrency.
--   - Sheets tidak punya kolom urutan eksplisit untuk sebagian tab (urutan = urutan
--     baris). SQL tidak menjamin urutan baris, jadi tab yang punya tombol
--     naik/turun/reorder (Gallery, Teachers, News, Announcements) diberi kolom
--     `position` (INTEGER) sebagai pengganti "urutan baris".
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- Konten publik ----------

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,   -- school_logo, hero_image, mpls_tk, mpls_sd, dst.
  value TEXT
);

CREATE TABLE IF NOT EXISTS teachers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT,
  photo_url  TEXT,
  gender     TEXT,          -- 'ikhwan' | 'akhwat'
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_teachers_position ON teachers(position);

CREATE TABLE IF NOT EXISTS gallery (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  category   TEXT,
  image_url  TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_gallery_position ON gallery(position);

CREATE TABLE IF NOT EXISTS news (
  id          TEXT PRIMARY KEY,   -- format lama "<n>-News" dipertahankan
  title       TEXT NOT NULL,
  summary     TEXT,
  image_url   TEXT,
  date        TEXT,               -- disimpan sebagai teks ISO (YYYY-MM-DD), sama seperti Sheets
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_news_position ON news(position);

CREATE TABLE IF NOT EXISTS videos (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  youtube_url TEXT,
  order_num   INTEGER NOT NULL DEFAULT 0,  -- kolom `order` yang sudah ada di Sheets
  updated_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_videos_order ON videos(order_num);

CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT PRIMARY KEY,
  text       TEXT,
  active     TEXT NOT NULL DEFAULT 'No',   -- 'Yes' / 'No' — dipertahankan sama seperti nilai di Sheets
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);

-- ---------- PPDB (saat ini TIDAK tersimpan sama sekali di server — lihat catatan) ----------

CREATE TABLE IF NOT EXISTS ppdb (
  id          TEXT PRIMARY KEY,
  parent_name TEXT NOT NULL,
  student_name TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  status      TEXT NOT NULL DEFAULT 'baru',  -- baru | dihubungi | diterima | ditolak (opsional, untuk TU)
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ppdb_created ON ppdb(created_at);

-- ---------- Data Siswa (KK) ----------

CREATE TABLE IF NOT EXISTS students (
  id                     TEXT PRIMARY KEY,
  nama_siswa             TEXT NOT NULL,
  nik_siswa              TEXT,
  nisn                   TEXT,
  jenis_kelamin          TEXT,
  tempat_lahir           TEXT,
  tanggal_lahir          TEXT,
  agama                  TEXT,
  anak_ke                TEXT,
  no_kk                  TEXT,
  alamat                 TEXT,
  kelurahan              TEXT,
  kecamatan              TEXT,
  kabupaten              TEXT,
  provinsi               TEXT,
  kode_pos               TEXT,
  nama_ayah              TEXT,
  nik_ayah               TEXT,
  pekerjaan_ayah         TEXT,
  pendidikan_ayah        TEXT,
  nama_ibu                TEXT,
  nik_ibu                 TEXT,
  pekerjaan_ibu           TEXT,
  pendidikan_ibu          TEXT,
  nama_wali               TEXT,
  pekerjaan_wali           TEXT,
  alamat_wali              TEXT,
  pendidikan_sebelumnya    TEXT,
  no_hp_ortu               TEXT,
  kelas                    TEXT NOT NULL,     -- TK, SD 1..SD 6, Tamat
  tahun_ajaran_masuk       TEXT,
  status                   TEXT,              -- aktif / alumni dst.
  foto_kk                  TEXT,              -- link Drive, dipertahankan apa adanya
  updated_at                INTEGER
);
CREATE INDEX IF NOT EXISTS idx_students_kelas ON students(kelas);
CREATE INDEX IF NOT EXISTS idx_students_nama ON students(nama_siswa);

-- ---------- Bank Soal (relasional) ----------

CREATE TABLE IF NOT EXISTS question_folders (
  id         TEXT PRIMARY KEY,
  grade      TEXT NOT NULL,     -- TK, SD 1..SD 6
  name       TEXT NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_qfolders_grade ON question_folders(grade);

CREATE TABLE IF NOT EXISTS questions (
  id             TEXT PRIMARY KEY,
  folder_id      TEXT NOT NULL REFERENCES question_folders(id) ON DELETE CASCADE,
  text           TEXT,
  option_a       TEXT,
  option_b       TEXT,
  option_c       TEXT,
  option_d       TEXT,
  correct_answer TEXT,
  type           TEXT NOT NULL DEFAULT 'pg',
  order_num      INTEGER,
  updated_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_questions_folder ON questions(folder_id, order_num);

-- ---------- E-Raport (relasional) ----------

CREATE TABLE IF NOT EXISTS report_periods (
  id                  TEXT PRIMARY KEY,
  student_id          TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kelas               TEXT NOT NULL,
  tahun_ajaran        TEXT,
  semester            TEXT,
  kehadiran_sakit     TEXT,
  kehadiran_izin      TEXT,
  kehadiran_alpa      TEXT,
  tempat_rapor        TEXT,
  tanggal_rapor       TEXT,
  tanggal_identitas   TEXT,
  nama_wali_kelas     TEXT,
  peringkat           TEXT,
  catatan_wali_kelas  TEXT,
  updated_at          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_periods_student ON report_periods(student_id);

CREATE TABLE IF NOT EXISTS report_grades (
  id                  TEXT PRIMARY KEY,
  report_period_id    TEXT NOT NULL REFERENCES report_periods(id) ON DELETE CASCADE,
  kelompok            TEXT NOT NULL DEFAULT 'umum',  -- umum | mulok
  induk               TEXT,
  mata_pelajaran      TEXT,
  nilai_angka         TEXT,
  deskripsi_capaian   TEXT,
  capaian_bimbingan   TEXT,
  updated_at          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_grades_period ON report_grades(report_period_id);

CREATE TABLE IF NOT EXISTS report_aspects (
  id                  TEXT PRIMARY KEY,
  report_period_id    TEXT NOT NULL REFERENCES report_periods(id) ON DELETE CASCADE,
  kelompok            TEXT NOT NULL DEFAULT 'agama', -- agama | jatidiri | literasi
  aspek               TEXT,
  deskripsi           TEXT,
  updated_at          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_aspects_period ON report_aspects(report_period_id);

CREATE TABLE IF NOT EXISTS report_extras (
  id                  TEXT PRIMARY KEY,
  report_period_id    TEXT NOT NULL REFERENCES report_periods(id) ON DELETE CASCADE,
  nama                TEXT,
  predikat            TEXT,
  keterangan          TEXT,
  updated_at          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_extras_period ON report_extras(report_period_id);

-- ---------- Auth guru (pengganti password "admin" statis di frontend) ----------

CREATE TABLE IF NOT EXISTS teacher_users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,   -- hash (PBKDF2/scrypt via Web Crypto), JANGAN plaintext
  name          TEXT,
  created_at    INTEGER
);

-- Sesi login sederhana (token acak) supaya API bisa memverifikasi request tanpa
-- server session store yang berat. Token dikirim via cookie HttpOnly.
CREATE TABLE IF NOT EXISTS teacher_sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES teacher_users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON teacher_sessions(user_id);
