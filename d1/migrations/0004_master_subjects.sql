-- Migrasi 0004: Master Data Mata Pelajaran & Aspek Perkembangan (TK & SD)

CREATE TABLE IF NOT EXISTS master_subjects (
  id          TEXT PRIMARY KEY,
  level       TEXT NOT NULL,        -- 'SD' | 'TK'
  kelompok    TEXT NOT NULL,        -- SD: 'umum' | 'mulok'; TK: 'agama' | 'jatidiri' | 'literasi'
  nama        TEXT NOT NULL,        -- Nama mata pelajaran / aspek perkembangan
  induk       TEXT,                 -- Induk mata pelajaran (opsional, misal: 'Seni (Pilihan)')
  urutan      INTEGER DEFAULT 0,    -- Urutan tampil di raport
  is_active   INTEGER DEFAULT 1,    -- 1 = aktif, 0 = nonaktif
  updated_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_master_subjects_level ON master_subjects(level);
CREATE INDEX IF NOT EXISTS idx_master_subjects_kelompok ON master_subjects(kelompok);

-- Seed Default Mata Pelajaran SD 1 s/d SD 6 (Kurikulum Merdeka + Diniyyah Imam Syafi'i)
-- SD 1 & SD 2 (Fase A - tanpa IPAS)
INSERT OR IGNORE INTO master_subjects (id, level, kelompok, nama, induk, urutan, is_active, updated_at) VALUES
  ('subj-sd1-umum-1', 'SD 1', 'umum', 'Pendidikan Agama Islam dan Budi Pekerti', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd1-umum-2', 'SD 1', 'umum', 'Pendidikan Pancasila', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd1-umum-3', 'SD 1', 'umum', 'Bahasa Indonesia', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd1-umum-4', 'SD 1', 'umum', 'Matematika', '', 4, 1, strftime('%s','now')*1000),
  ('subj-sd1-umum-5', 'SD 1', 'umum', 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', '', 5, 1, strftime('%s','now')*1000),
  ('subj-sd1-umum-6', 'SD 1', 'umum', 'Seni Rupa', 'Seni (Pilihan)', 6, 1, strftime('%s','now')*1000),
  ('subj-sd1-umum-7', 'SD 1', 'umum', 'Bahasa Inggris', '', 7, 1, strftime('%s','now')*1000),
  ('subj-sd1-mulok-1', 'SD 1', 'mulok', 'Tahfidz Al-Qur''an', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd1-mulok-2', 'SD 1', 'mulok', 'Tauhid & Aqidah', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd1-mulok-3', 'SD 1', 'mulok', 'Fiqih Ibadah', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd1-mulok-4', 'SD 1', 'mulok', 'Bahasa Arab', '', 4, 1, strftime('%s','now')*1000),

  ('subj-sd2-umum-1', 'SD 2', 'umum', 'Pendidikan Agama Islam dan Budi Pekerti', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd2-umum-2', 'SD 2', 'umum', 'Pendidikan Pancasila', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd2-umum-3', 'SD 2', 'umum', 'Bahasa Indonesia', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd2-umum-4', 'SD 2', 'umum', 'Matematika', '', 4, 1, strftime('%s','now')*1000),
  ('subj-sd2-umum-5', 'SD 2', 'umum', 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', '', 5, 1, strftime('%s','now')*1000),
  ('subj-sd2-umum-6', 'SD 2', 'umum', 'Seni Rupa', 'Seni (Pilihan)', 6, 1, strftime('%s','now')*1000),
  ('subj-sd2-umum-7', 'SD 2', 'umum', 'Bahasa Inggris', '', 7, 1, strftime('%s','now')*1000),
  ('subj-sd2-mulok-1', 'SD 2', 'mulok', 'Tahfidz Al-Qur''an', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd2-mulok-2', 'SD 2', 'mulok', 'Tauhid & Aqidah', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd2-mulok-3', 'SD 2', 'mulok', 'Fiqih Ibadah', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd2-mulok-4', 'SD 2', 'mulok', 'Bahasa Arab', '', 4, 1, strftime('%s','now')*1000),

  ('subj-sd3-umum-1', 'SD 3', 'umum', 'Pendidikan Agama Islam dan Budi Pekerti', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd3-umum-2', 'SD 3', 'umum', 'Pendidikan Pancasila', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd3-umum-3', 'SD 3', 'umum', 'Bahasa Indonesia', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd3-umum-4', 'SD 3', 'umum', 'Matematika', '', 4, 1, strftime('%s','now')*1000),
  ('subj-sd3-umum-5', 'SD 3', 'umum', 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', '', 5, 1, strftime('%s','now')*1000),
  ('subj-sd3-umum-6', 'SD 3', 'umum', 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', '', 6, 1, strftime('%s','now')*1000),
  ('subj-sd3-umum-7', 'SD 3', 'umum', 'Seni Rupa', 'Seni (Pilihan)', 7, 1, strftime('%s','now')*1000),
  ('subj-sd3-umum-8', 'SD 3', 'umum', 'Bahasa Inggris', '', 8, 1, strftime('%s','now')*1000),
  ('subj-sd3-mulok-1', 'SD 3', 'mulok', 'Tahfidz Al-Qur''an', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd3-mulok-2', 'SD 3', 'mulok', 'Tauhid & Aqidah', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd3-mulok-3', 'SD 3', 'mulok', 'Fiqih Ibadah', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd3-mulok-4', 'SD 3', 'mulok', 'Bahasa Arab', '', 4, 1, strftime('%s','now')*1000);

-- Seed Default Aspek Perkembangan TK (Kurikulum Merdeka PAUD)
INSERT OR IGNORE INTO master_subjects (id, level, kelompok, nama, induk, urutan, is_active, updated_at) VALUES
  ('subj-tk-agama-1', 'TK', 'agama', 'Mengenal Allah Subhanahu wa Ta''ala dan Ciptaan-Nya', '', 1, 1, strftime('%s','now')*1000),
  ('subj-tk-agama-2', 'TK', 'agama', 'Mempraktikkan Doa Harian, Adab Islami, dan Ibadah', '', 2, 1, strftime('%s','now')*1000),
  ('subj-tk-agama-3', 'TK', 'agama', 'Menunjukkan Sikap Kasih Sayang dan Akhlak Mulia', '', 3, 1, strftime('%s','now')*1000),

  ('subj-tk-jatidiri-1', 'TK', 'jatidiri', 'Mengenali dan Mengelola Emosi Diri secara Positif', '', 1, 1, strftime('%s','now')*1000),
  ('subj-tk-jatidiri-2', 'TK', 'jatidiri', 'Menjaga Kebersihan Diri, Kerapian, dan Keselamatan', '', 2, 1, strftime('%s','now')*1000),
  ('subj-tk-jatidiri-3', 'TK', 'jatidiri', 'Keterampilan Motorik Kasar dan Motorik Halus', '', 3, 1, strftime('%s','now')*1000),

  ('subj-tk-literasi-1', 'TK', 'literasi', 'Mengenal Huruf Hijaiyah, Abjad, dan Perbendaharaan Kata', '', 1, 1, strftime('%s','now')*1000),
  ('subj-tk-literasi-2', 'TK', 'literasi', 'Mengenal Konsep Bilangan, Bentuk, dan Berhitung', '', 2, 1, strftime('%s','now')*1000),
  ('subj-tk-literasi-3', 'TK', 'literasi', 'Eksplorasi Sains, Rasa Ingin Tahu, dan Ekspresi Seni Kreatif', '', 3, 1, strftime('%s','now')*1000);
