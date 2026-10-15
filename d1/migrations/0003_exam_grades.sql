-- ============================================================
-- 0003_exam_grades.sql
-- Tabel penilaian ujian berkala (PH/PTS/PAS/Tahfidz) & portal orang tua.
-- ============================================================

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

