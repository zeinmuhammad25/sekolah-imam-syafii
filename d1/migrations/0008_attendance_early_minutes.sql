-- Migrasi 0008: Tambah kolom early_minutes untuk pelacakan kepulangan lebih awal
ALTER TABLE teacher_attendances ADD COLUMN early_minutes INTEGER DEFAULT 0;

