-- Hapus data master SD umum lama, ganti dengan pemisahan SD 1 s/d SD 6
DELETE FROM master_subjects WHERE level = 'SD';

-- SD 1 (Fase A - tanpa IPAS)
INSERT OR REPLACE INTO master_subjects (id, level, kelompok, nama, induk, urutan, is_active, updated_at) VALUES
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
  ('subj-sd1-mulok-4', 'SD 1', 'mulok', 'Bahasa Arab', '', 4, 1, strftime('%s','now')*1000);

-- SD 2 (Fase A - tanpa IPAS)
INSERT OR REPLACE INTO master_subjects (id, level, kelompok, nama, induk, urutan, is_active, updated_at) VALUES
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
  ('subj-sd2-mulok-4', 'SD 2', 'mulok', 'Bahasa Arab', '', 4, 1, strftime('%s','now')*1000);

-- SD 3 (Fase B - ada IPAS)
INSERT OR REPLACE INTO master_subjects (id, level, kelompok, nama, induk, urutan, is_active, updated_at) VALUES
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

-- SD 4 (Fase B - ada IPAS)
INSERT OR REPLACE INTO master_subjects (id, level, kelompok, nama, induk, urutan, is_active, updated_at) VALUES
  ('subj-sd4-umum-1', 'SD 4', 'umum', 'Pendidikan Agama Islam dan Budi Pekerti', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd4-umum-2', 'SD 4', 'umum', 'Pendidikan Pancasila', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd4-umum-3', 'SD 4', 'umum', 'Bahasa Indonesia', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd4-umum-4', 'SD 4', 'umum', 'Matematika', '', 4, 1, strftime('%s','now')*1000),
  ('subj-sd4-umum-5', 'SD 4', 'umum', 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', '', 5, 1, strftime('%s','now')*1000),
  ('subj-sd4-umum-6', 'SD 4', 'umum', 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', '', 6, 1, strftime('%s','now')*1000),
  ('subj-sd4-umum-7', 'SD 4', 'umum', 'Seni Rupa', 'Seni (Pilihan)', 7, 1, strftime('%s','now')*1000),
  ('subj-sd4-umum-8', 'SD 4', 'umum', 'Bahasa Inggris', '', 8, 1, strftime('%s','now')*1000),
  ('subj-sd4-mulok-1', 'SD 4', 'mulok', 'Tahfidz Al-Qur''an', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd4-mulok-2', 'SD 4', 'mulok', 'Tauhid & Aqidah', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd4-mulok-3', 'SD 4', 'mulok', 'Fiqih Ibadah', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd4-mulok-4', 'SD 4', 'mulok', 'Bahasa Arab', '', 4, 1, strftime('%s','now')*1000);

-- SD 5 (Fase C - ada IPAS)
INSERT OR REPLACE INTO master_subjects (id, level, kelompok, nama, induk, urutan, is_active, updated_at) VALUES
  ('subj-sd5-umum-1', 'SD 5', 'umum', 'Pendidikan Agama Islam dan Budi Pekerti', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd5-umum-2', 'SD 5', 'umum', 'Pendidikan Pancasila', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd5-umum-3', 'SD 5', 'umum', 'Bahasa Indonesia', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd5-umum-4', 'SD 5', 'umum', 'Matematika', '', 4, 1, strftime('%s','now')*1000),
  ('subj-sd5-umum-5', 'SD 5', 'umum', 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', '', 5, 1, strftime('%s','now')*1000),
  ('subj-sd5-umum-6', 'SD 5', 'umum', 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', '', 6, 1, strftime('%s','now')*1000),
  ('subj-sd5-umum-7', 'SD 5', 'umum', 'Seni Rupa', 'Seni (Pilihan)', 7, 1, strftime('%s','now')*1000),
  ('subj-sd5-umum-8', 'SD 5', 'umum', 'Bahasa Inggris', '', 8, 1, strftime('%s','now')*1000),
  ('subj-sd5-mulok-1', 'SD 5', 'mulok', 'Tahfidz Al-Qur''an', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd5-mulok-2', 'SD 5', 'mulok', 'Tauhid & Aqidah', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd5-mulok-3', 'SD 5', 'mulok', 'Fiqih Ibadah', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd5-mulok-4', 'SD 5', 'mulok', 'Bahasa Arab', '', 4, 1, strftime('%s','now')*1000);

-- SD 6 (Fase C - ada IPAS)
INSERT OR REPLACE INTO master_subjects (id, level, kelompok, nama, induk, urutan, is_active, updated_at) VALUES
  ('subj-sd6-umum-1', 'SD 6', 'umum', 'Pendidikan Agama Islam dan Budi Pekerti', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd6-umum-2', 'SD 6', 'umum', 'Pendidikan Pancasila', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd6-umum-3', 'SD 6', 'umum', 'Bahasa Indonesia', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd6-umum-4', 'SD 6', 'umum', 'Matematika', '', 4, 1, strftime('%s','now')*1000),
  ('subj-sd6-umum-5', 'SD 6', 'umum', 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', '', 5, 1, strftime('%s','now')*1000),
  ('subj-sd6-umum-6', 'SD 6', 'umum', 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', '', 6, 1, strftime('%s','now')*1000),
  ('subj-sd6-umum-7', 'SD 6', 'umum', 'Seni Rupa', 'Seni (Pilihan)', 7, 1, strftime('%s','now')*1000),
  ('subj-sd6-umum-8', 'SD 6', 'umum', 'Bahasa Inggris', '', 8, 1, strftime('%s','now')*1000),
  ('subj-sd6-mulok-1', 'SD 6', 'mulok', 'Tahfidz Al-Qur''an', '', 1, 1, strftime('%s','now')*1000),
  ('subj-sd6-mulok-2', 'SD 6', 'mulok', 'Tauhid & Aqidah', '', 2, 1, strftime('%s','now')*1000),
  ('subj-sd6-mulok-3', 'SD 6', 'mulok', 'Fiqih Ibadah', '', 3, 1, strftime('%s','now')*1000),
  ('subj-sd6-mulok-4', 'SD 6', 'mulok', 'Bahasa Arab', '', 4, 1, strftime('%s','now')*1000);

