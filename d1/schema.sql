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
  nis                    TEXT,
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
  foto_siswa               TEXT,              -- URL foto resmi siswa di Cloudflare R2
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
CREATE INDEX IF NOT EXISTS idx_periods_lookup ON report_periods(kelas, tahun_ajaran, semester);
CREATE INDEX IF NOT EXISTS idx_periods_student_sem ON report_periods(student_id, tahun_ajaran, semester);

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
CREATE INDEX IF NOT EXISTS idx_report_grades_composite ON report_grades(report_period_id, mata_pelajaran);

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
  password_hash TEXT NOT NULL,
  password_plain TEXT,   -- hash (PBKDF2/scrypt via Web Crypto), JANGAN plaintext
  name          TEXT,
  role          TEXT DEFAULT 'guru', -- 'superadmin' | 'guru' | 'tu' | 'humas' | 'custom'
  permissions   TEXT DEFAULT '["all"]', -- JSON array of module keys
  is_active     INTEGER DEFAULT 1,
  created_at    INTEGER,
  updated_at    INTEGER
);

-- Sesi login sederhana (token acak) supaya API bisa memverifikasi request tanpa
-- server session store yang berat. Token dikirim via cookie HttpOnly.
CREATE TABLE IF NOT EXISTS teacher_sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES teacher_users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON teacher_sessions(user_id);

-- ---------- Penjagaan edit bersamaan (lihat d1/migrations/0002_concurrency.sql) ----------

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO meta (key, value) VALUES ('data_version', 1);

CREATE TABLE IF NOT EXISTS cas_guard (
  v INTEGER NOT NULL
);

-- ---------- Penilaian Ujian Berkala (PH / PTS / PAS / Tahfidz) & Portal Ortu ----------

CREATE TABLE IF NOT EXISTS exam_sessions (
  id            TEXT PRIMARY KEY,
  grade         TEXT NOT NULL,
  subject       TEXT NOT NULL,
  title         TEXT NOT NULL,
  semester      TEXT DEFAULT '1',
  academic_year TEXT NOT NULL,
  exam_date     TEXT,
  teacher_name  TEXT,
  is_published  INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_grade ON exam_sessions(grade);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_published ON exam_sessions(is_published);

CREATE TABLE IF NOT EXISTS exam_grades (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score       REAL NOT NULL,
  notes       TEXT,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exam_grades_session ON exam_grades(session_id);
CREATE INDEX IF NOT EXISTS idx_exam_grades_student ON exam_grades(student_id);

-- ---------- Master Data Mata Pelajaran & Aspek Perkembangan (TK & SD) ----------

CREATE TABLE IF NOT EXISTS master_subjects (
  id          TEXT PRIMARY KEY,
  level       TEXT NOT NULL,        -- 'SD 1'..'SD 6' | 'TK'
  kelompok    TEXT NOT NULL,        -- SD: 'umum' | 'mulok'; TK: 'agama' | 'jatidiri' | 'literasi'
  nama        TEXT NOT NULL,        -- Nama mata pelajaran / aspek
  induk       TEXT,                 -- Induk (misal: 'Seni (Pilihan)')
  urutan      INTEGER DEFAULT 0,    -- Urutan tampil
  is_active   INTEGER DEFAULT 1,    -- 1 = aktif
  updated_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_master_subjects_level ON master_subjects(level);
CREATE INDEX IF NOT EXISTS idx_master_subjects_kelompok ON master_subjects(kelompok);
CREATE INDEX IF NOT EXISTS idx_master_subjects_urutan ON master_subjects(level, urutan);

-- ---------- Kontrol Publikasi Rapor per Kelas untuk Portal Wali Murid ----------

CREATE TABLE IF NOT EXISTS grade_publications (
  id             TEXT PRIMARY KEY,  -- mis. 'pub-SD 1-20252026-1'
  grade          TEXT NOT NULL,     -- 'SD 1'..'SD 6' atau 'TK'
  academic_year  TEXT NOT NULL,     -- '2025/2026'
  semester       TEXT NOT NULL,     -- '1' | '2'
  is_published   INTEGER DEFAULT 0, -- 1 = Terbit ke Ortu, 0 = Draft
  published_at   INTEGER,
  published_by   TEXT,
  notes          TEXT,              -- Catatan/pesan pengumuman untuk wali murid
  updated_at     INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_pub_unique ON grade_publications(grade, academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_grade_pub_status ON grade_publications(grade, is_published);

-- ---------- Presensi / Absensi Guru & Staf (GPS & Waktu Kerja Individual) ----------

CREATE TABLE IF NOT EXISTS attendance_settings (
  id                  TEXT PRIMARY KEY,  -- 'default'
  work_start_time     TEXT NOT NULL DEFAULT '07:15',
  late_threshold_time TEXT NOT NULL DEFAULT '07:30',
  work_end_time       TEXT NOT NULL DEFAULT '15:00',
  school_latitude     REAL NOT NULL DEFAULT 3.662972,
  school_longitude    REAL NOT NULL DEFAULT 98.719222,
  max_distance_meters INTEGER NOT NULL DEFAULT 100,
  is_geofence_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_attendance_members (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  nip                 TEXT,
  role                TEXT,
  work_start_time     TEXT NOT NULL DEFAULT '07:15',
  late_threshold_time TEXT NOT NULL DEFAULT '07:30',
  work_end_time       TEXT NOT NULL DEFAULT '15:00',
  work_days           TEXT DEFAULT '["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]',
  is_active           INTEGER DEFAULT 1,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_att_members_active ON teacher_attendance_members(is_active);

CREATE TABLE IF NOT EXISTS teacher_attendances (
  id                  TEXT PRIMARY KEY,
  teacher_id          TEXT NOT NULL,
  teacher_name        TEXT NOT NULL,
  date                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'hadir',
  check_in_time       TEXT,
  check_in_status     TEXT,
  late_minutes        INTEGER DEFAULT 0,
  check_in_distance   INTEGER,
  check_in_lat        REAL,
  check_in_lng        REAL,
  check_out_time      TEXT,
  check_out_status    TEXT,
  early_minutes       INTEGER DEFAULT 0,
  check_out_distance  INTEGER,
  notes               TEXT,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teacher_att_date ON teacher_attendances(date);
CREATE INDEX IF NOT EXISTS idx_teacher_att_tid ON teacher_attendances(teacher_id);

-- ---------- Presensi Siswa (Scan QR & Rekap Harian) ----------

CREATE TABLE IF NOT EXISTS student_attendances (
  id              TEXT PRIMARY KEY,              -- Format: "att-YYYY-MM-DD-student_id" (anti-duplikat unik)
  date            TEXT NOT NULL,                 -- YYYY-MM-DD (WIB)
  kelas           TEXT NOT NULL,                 -- TK, SD 1..SD 6
  student_id      TEXT NOT NULL,                 -- Relasi ke students.id
  student_name    TEXT NOT NULL,                 -- Snapshot nama siswa
  status          TEXT NOT NULL,                 -- 'hadir', 'sakit', 'izin', 'alpha'
  method          TEXT NOT NULL,                 -- 'qr_scan' | 'manual_wali_kelas'
  scan_time       TEXT,                          -- '07:15:22'
  notes           TEXT,                          -- Keterangan (cth: 'Ketinggalan kartu', 'Demam', dsb.)
  submitted_by    TEXT,                          -- Nama guru/wali kelas yang submit
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_std_att_date_kelas ON student_attendances(date, kelas);
CREATE INDEX IF NOT EXISTS idx_std_att_student ON student_attendances(student_id, date);
CREATE INDEX IF NOT EXISTS idx_std_att_date ON student_attendances(date);


