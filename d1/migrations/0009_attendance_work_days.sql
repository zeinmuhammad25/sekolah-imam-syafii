-- Migrasi 0009: Hari kerja / wajib presensi per guru individual
ALTER TABLE teacher_attendance_members ADD COLUMN work_days TEXT DEFAULT '["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]';

