-- Migrasi 0005: Kontrol Publikasi Nilai Rapor per Kelas untuk Portal Wali Murid

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

-- Seed Data Status Awal untuk Tahun Ajaran 2025/2026 Semester 1 (Ganjil)
INSERT OR IGNORE INTO grade_publications (id, grade, academic_year, semester, is_published, published_at, published_by, notes, updated_at) VALUES
  ('pub-TK-20252026-1', 'TK', '2025/2026', '1', 1, strftime('%s','now')*1000, 'Admin Sekolah', 'Rapor Semester Ganjil TK Qur''an Imam Syafi''i', strftime('%s','now')*1000),
  ('pub-SD1-20252026-1', 'SD 1', '2025/2026', '1', 1, strftime('%s','now')*1000, 'Admin Sekolah', 'Nilai Rapor Kurikulum Merdeka Semester 1 telah resmi diterbitkan.', strftime('%s','now')*1000),
  ('pub-SD2-20252026-1', 'SD 2', '2025/2026', '1', 1, strftime('%s','now')*1000, 'Admin Sekolah', 'Nilai Rapor Kurikulum Merdeka Semester 1 telah resmi diterbitkan.', strftime('%s','now')*1000),
  ('pub-SD3-20252026-1', 'SD 3', '2025/2026', '1', 1, strftime('%s','now')*1000, 'Admin Sekolah', 'Nilai Rapor Kurikulum Merdeka Semester 1 telah resmi diterbitkan.', strftime('%s','now')*1000),
  ('pub-SD4-20252026-1', 'SD 4', '2025/2026', '1', 0, NULL, NULL, '', strftime('%s','now')*1000),
  ('pub-SD5-20252026-1', 'SD 5', '2025/2026', '1', 0, NULL, NULL, '', strftime('%s','now')*1000),
  ('pub-SD6-20252026-1', 'SD 6', '2025/2026', '1', 0, NULL, NULL, '', strftime('%s','now')*1000);

