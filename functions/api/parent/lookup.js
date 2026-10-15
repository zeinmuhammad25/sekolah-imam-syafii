import { json } from '../../_lib/auth.js';

// Helper untuk mengambil seluruh nilai ujian terbit & rapor siswa
async function getStudentFullData(db, studentId) {
  // 1. Data Siswa
  const student = await db.prepare(`
    SELECT id, nama_siswa, jenis_kelamin, kelas, nisn, nis, status, tahun_ajaran_masuk
    FROM students
    WHERE id = ?
  `).bind(studentId).first();

  if (!student) return null;

  // 2. Nilai Ujian Berkala (Hanya yang is_published = 1)
  const exams = await db.prepare(`
    SELECT 
      eg.id,
      eg.score,
      eg.notes,
      es.id AS session_id,
      es.grade,
      es.subject,
      es.title,
      es.semester,
      es.academic_year,
      es.exam_date,
      es.teacher_name
    FROM exam_grades eg
    JOIN exam_sessions es ON eg.session_id = es.id
    WHERE eg.student_id = ? AND es.is_published = 1
    ORDER BY es.exam_date DESC, es.created_at DESC
  `).bind(studentId).all();

  // 3. E-Raport Semester (ReportPeriods)
  const periods = await db.prepare(`
    SELECT * FROM report_periods 
    WHERE student_id = ?
    ORDER BY tahun_ajaran DESC, semester DESC
  `).bind(studentId).all();

  const periodList = periods.results || [];
  let reportGrades = [];
  let reportAspects = [];
  let reportExtras = [];

  if (periodList.length > 0) {
    const periodIds = periodList.map((p) => p.id);
    const placeholders = periodIds.map(() => '?').join(',');

    const [gradesRes, aspectsRes, extrasRes] = await db.batch([
      db.prepare(`SELECT * FROM report_grades WHERE report_period_id IN (${placeholders}) ORDER BY rowid ASC`).bind(...periodIds),
      db.prepare(`SELECT * FROM report_aspects WHERE report_period_id IN (${placeholders}) ORDER BY rowid ASC`).bind(...periodIds),
      db.prepare(`SELECT * FROM report_extras WHERE report_period_id IN (${placeholders}) ORDER BY rowid ASC`).bind(...periodIds),
    ]);

    reportGrades = gradesRes.results || [];
    reportAspects = aspectsRes.results || [];
    reportExtras = extrasRes.results || [];
  }

  return {
    student,
    exams: exams.results || [],
    reportPeriods: periodList,
    reportGrades,
    reportAspects,
    reportExtras,
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  const studentId = url.searchParams.get('studentId');
  const q = String(url.searchParams.get('q') || '').trim();

  try {
    // A. Akses langsung via studentId (misal setelah ortu memilih dari daftar nama)
    if (studentId) {
      const data = await getStudentFullData(db, studentId);
      if (!data) {
        return json({ success: false, message: 'Data ananda tidak ditemukan' }, { status: 404 });
      }
      return json({ success: true, single: true, ...data });
    }

    // B. Pencarian via Nama / NIK / NISN
    if (!q || q.length < 2) {
      return json({ success: false, message: 'Silakan ketik minimal 2 karakter (Nama, NIK, atau NISN)' }, { status: 400 });
    }

    // Cari di tabel students
    const normalized = q.toLowerCase();
    const wild = `%${normalized}%`;

    const matches = await db.prepare(`
      SELECT id, nama_siswa, jenis_kelamin, kelas, nisn, nis, nik_siswa
      FROM students
      WHERE LOWER(nama_siswa) LIKE ? 
         OR nik_siswa = ? 
         OR nisn = ?
         OR nis = ?
         OR REPLACE(REPLACE(LOWER(nama_siswa), '.', ''), ' ', '') LIKE ?
      ORDER BY nama_siswa ASC
      LIMIT 15
    `).bind(wild, q, q, q, `%${normalized.replace(/[\s.]/g, '')}%`).all();

    const results = matches.results || [];

    if (results.length === 0) {
      return json({
        success: true,
        found: false,
        message: 'Data ananda tidak ditemukan. Mohon pastikan ejaan Nama, NIK, atau NISN sudah sesuai.',
      });
    }

    // Jika tepat cocok 1 siswa -> langsung muat seluruh nilai dan rapornya
    if (results.length === 1) {
      const data = await getStudentFullData(db, results[0].id);
      return json({
        success: true,
        found: true,
        single: true,
        ...data,
      });
    }

    // Jika ada lebih dari 1 siswa dengan nama mirip -> kembalikan daftar ringkas agar ortu bisa memilih
    return json({
      success: true,
      found: true,
      multiple: true,
      students: results.map((s) => ({
        id: s.id,
        nama_siswa: s.nama_siswa,
        kelas: s.kelas,
        jenis_kelamin: s.jenis_kelamin,
        nisn: s.nisn ? `${s.nisn.slice(0, 4)}***` : '',
      })),
    });
  } catch (err) {
    return json({ success: false, message: err.message }, { status: 500 });
  }
}

