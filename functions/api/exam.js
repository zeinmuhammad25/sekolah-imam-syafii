import { requireSession, json } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const session = await requireSession(request, env);
  if (!session) {
    return json({ success: false, message: 'Autentikasi diperlukan' }, { status: 401 });
  }

  const url = new URL(request.url);
  const grade = url.searchParams.get('grade');
  const sessionId = url.searchParams.get('sessionId');

  try {
    // 1. Ambil detail 1 sesi ujian + nilai seluruh siswa di kelas tersebut
    if (sessionId) {
      const examSession = await db.prepare('SELECT * FROM exam_sessions WHERE id = ?').bind(sessionId).first();
      if (!examSession) {
        return json({ success: false, message: 'Sesi ujian tidak ditemukan' }, { status: 404 });
      }

      // Ambil seluruh siswa aktif di kelas tersebut
      const students = await db.prepare(
        "SELECT id, nama_siswa, jenis_kelamin, nisn FROM students WHERE kelas = ? AND status != 'Pindah' ORDER BY nama_siswa ASC"
      ).bind(examSession.grade).all();

      // Ambil nilai yang sudah tersimpan untuk sesi ini
      const grades = await db.prepare(
        'SELECT student_id, score, notes, updated_at FROM exam_grades WHERE session_id = ?'
      ).bind(sessionId).all();

      const gradeMap = {};
      (grades.results || []).forEach((g) => {
        gradeMap[g.student_id] = { score: g.score, notes: g.notes || '' };
      });

      return json({
        success: true,
        session: examSession,
        students: (students.results || []).map((s) => ({
          ...s,
          score: gradeMap[s.id]?.score ?? '',
          notes: gradeMap[s.id]?.notes ?? '',
        })),
      });
    }

    // 2. Ambil daftar sesi ujian berdasarkan kelas (grade)
    if (grade) {
      const sessions = await db.prepare(`
        SELECT 
          s.*,
          (SELECT COUNT(*) FROM exam_grades WHERE session_id = s.id) AS student_count,
          (SELECT ROUND(AVG(score), 1) FROM exam_grades WHERE session_id = s.id) AS avg_score
        FROM exam_sessions s
        WHERE s.grade = ?
        ORDER BY s.exam_date DESC, s.created_at DESC
      `).bind(grade).all();

      return json({ success: true, sessions: sessions.results || [] });
    }

    // Default: ambil semua sesi terbaru
    const all = await db.prepare(`
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM exam_grades WHERE session_id = s.id) AS student_count,
        (SELECT ROUND(AVG(score), 1) FROM exam_grades WHERE session_id = s.id) AS avg_score
      FROM exam_sessions s
      ORDER BY s.exam_date DESC, s.created_at DESC
      LIMIT 100
    `).all();

    return json({ success: true, sessions: all.results || [] });
  } catch (err) {
    return json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  const session = await requireSession(request, env);
  if (!session) {
    return json({ success: false, message: 'Autentikasi diperlukan' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'JSON body tidak valid' }, { status: 400 });
  }

  const { action } = body;
  const now = Date.now();

  try {
    // 1. Simpan atau perbarui sesi ujian beserta nilai-nilai siswa
    if (action === 'save_session') {
      const s = body.session || {};
      if (!s.grade || !s.subject || !s.title) {
        return json({ success: false, message: 'Kelas, mata pelajaran, dan judul ujian wajib diisi' }, { status: 400 });
      }

      const sessionId = s.id || `es-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const isNew = !s.id;
      const isPublished = s.is_published !== undefined ? (s.is_published ? 1 : 0) : 1;

      const queries = [];

      if (isNew) {
        queries.push(
          db.prepare(`
            INSERT INTO exam_sessions (id, grade, subject, title, semester, academic_year, exam_date, teacher_name, is_published, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            sessionId,
            s.grade,
            s.subject,
            s.title,
            s.semester || '1',
            s.academic_year || '2025/2026',
            s.exam_date || new Date().toISOString().slice(0, 10),
            s.teacher_name || session.name || 'Guru',
            isPublished,
            now,
            now
          )
        );
      } else {
        queries.push(
          db.prepare(`
            UPDATE exam_sessions 
            SET grade = ?, subject = ?, title = ?, semester = ?, academic_year = ?, exam_date = ?, teacher_name = ?, is_published = ?, updated_at = ?
            WHERE id = ?
          `).bind(
            s.grade,
            s.subject,
            s.title,
            s.semester || '1',
            s.academic_year || '2025/2026',
            s.exam_date || '',
            s.teacher_name || session.name || 'Guru',
            isPublished,
            now,
            sessionId
          )
        );
      }

      // Hapus nilai lama jika perbarui
      queries.push(db.prepare('DELETE FROM exam_grades WHERE session_id = ?').bind(sessionId));

      // Masukkan nilai siswa
      const grades = Array.isArray(body.grades) ? body.grades : [];
      grades.forEach((g) => {
        const scoreVal = Number(g.score);
        if (!isNaN(scoreVal) && g.score !== '' && g.score !== null) {
          const gid = `eg-${now}-${Math.random().toString(36).slice(2, 7)}`;
          queries.push(
            db.prepare(`
              INSERT INTO exam_grades (id, session_id, student_id, score, notes, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(gid, sessionId, g.student_id, scoreVal, String(g.notes || '').trim(), now)
          );
        }
      });

      await db.batch(queries);
      return json({ success: true, sessionId, message: 'Nilai ujian berhasil disimpan' });
    }

    // 2. Toggle status publikasi (Draft <-> Terbit)
    if (action === 'toggle_publish') {
      const { sessionId, isPublished } = body;
      if (!sessionId) return json({ success: false, message: 'Session ID diperlukan' }, { status: 400 });

      await db.prepare('UPDATE exam_sessions SET is_published = ?, updated_at = ? WHERE id = ?')
        .bind(isPublished ? 1 : 0, now, sessionId)
        .run();

      return json({ success: true, message: `Status berhasil diubah ke ${isPublished ? 'Terbit' : 'Draft'}` });
    }

    // 3. Hapus sesi ujian
    if (action === 'delete_session') {
      const { sessionId } = body;
      if (!sessionId) return json({ success: false, message: 'Session ID diperlukan' }, { status: 400 });

      await db.prepare('DELETE FROM exam_sessions WHERE id = ?').bind(sessionId).run();
      return json({ success: true, message: 'Sesi ujian berhasil dihapus' });
    }

    return json({ success: false, message: `Aksi "${action}" tidak dikenal` }, { status: 400 });
  } catch (err) {
    return json({ success: false, message: err.message }, { status: 500 });
  }
}

