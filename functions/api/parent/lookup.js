import { json } from '../../_lib/auth.js';

// Sensor field privat kependudukan jika ada isinya
function maskValue(val, type = 'nik') {
  if (!val || typeof val !== 'string') return val;
  const s = val.trim();
  if (!s) return s;
  if (type === 'nik' || type === 'kk') {
    if (s.length <= 6) return s;
    return `${s.slice(0, 6)}${'*'.repeat(Math.max(s.length - 10, 4))}${s.slice(-4)}`;
  }
  if (type === 'phone') {
    if (s.length <= 4) return s;
    return `${s.slice(0, 4)}****${s.slice(-3)}`;
  }
  return s;
}

// Helper untuk mengambil data profil siswa (dengan sensor data sensitif)
async function getStudentProfile(db, studentId) {
  const row = await db.prepare(`
    SELECT * FROM students WHERE id = ?
  `).bind(studentId).first();

  if (!row) return null;

  // Mask data identitas sensitif
  const safeProfile = {
    ...row,
    nik_siswa: maskValue(row.nik_siswa, 'nik'),
    no_kk: maskValue(row.no_kk, 'kk'),
    nik_ayah: maskValue(row.nik_ayah, 'nik'),
    nik_ibu: maskValue(row.nik_ibu, 'nik'),
    no_hp_ortu: maskValue(row.no_hp_ortu, 'phone'),
  };

  return safeProfile;
}

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

  // 3. Status Publikasi Rapor per Kelas (grade_publications)
  const pubsRes = await db.prepare(`
    SELECT grade, academic_year, semester, is_published, published_at, published_by, notes
    FROM grade_publications
  `).all();
  const publications = pubsRes.results || [];
  const pubMap = new Map();
  publications.forEach((pub) => {
    const key = `${String(pub.grade).trim()}|${String(pub.academic_year).replace(/\s+/g, '')}|${String(pub.semester).trim()}`;
    pubMap.set(key, pub);
  });

  // 4. E-Raport Semester (ReportPeriods)
  const periods = await db.prepare(`
    SELECT * FROM report_periods 
    WHERE student_id = ?
    ORDER BY tahun_ajaran DESC, semester DESC
  `).bind(studentId).all();

  const allPeriods = periods.results || [];
  // Pasangkan status publikasi pada setiap periode
  const periodList = allPeriods.map((p) => {
    const pGrade = String(p.kelas || student.kelas || '').trim();
    const pYear = String(p.tahun_ajaran || p.tahunAjaran || '').replace(/\s+/g, '');
    const pSem = String(p.semester || '').trim();
    const key = `${pGrade}|${pYear}|${pSem}`;
    const pub = pubMap.get(key);
    const isPub = pub ? Number(pub.is_published) === 1 : false;
    return {
      ...p,
      isPublished: isPub,
      publicationNotes: pub ? pub.notes : '',
      publishedAt: pub ? pub.published_at : null,
      publishedBy: pub ? pub.published_by : '',
    };
  });

  // Hanya ambil nilai untuk periode yang SUDAH DITERBITKAN
  const publishedPeriodIds = periodList.filter((p) => p.isPublished).map((p) => p.id);
  let reportGrades = [];
  let reportAspects = [];
  let reportExtras = [];

  if (publishedPeriodIds.length > 0) {
    const placeholders = publishedPeriodIds.map(() => '?').join(',');

    const [gradesRes, aspectsRes, extrasRes] = await db.batch([
      db.prepare(`SELECT * FROM report_grades WHERE report_period_id IN (${placeholders}) ORDER BY rowid ASC`).bind(...publishedPeriodIds),
      db.prepare(`SELECT * FROM report_aspects WHERE report_period_id IN (${placeholders}) ORDER BY rowid ASC`).bind(...publishedPeriodIds),
      db.prepare(`SELECT * FROM report_extras WHERE report_period_id IN (${placeholders}) ORDER BY rowid ASC`).bind(...publishedPeriodIds),
    ]);

    reportGrades = gradesRes.results || [];
    reportAspects = aspectsRes.results || [];
    reportExtras = extrasRes.results || [];
  }

  return {
    student,
    exams: exams.results || [],
    publications,
    reportPeriods: periodList,
    reportGrades,
    reportAspects,
    reportExtras,
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env?.DB;

  if (!db) {
    return json({
      success: false,
      message: 'Database D1 (env.DB) belum terhubung di environment ini.',
    }, { status: 500 });
  }

  const url = new URL(request.url);

  const action = url.searchParams.get('action'); // 'list_class' | 'profile' | 'raport' | default lookup
  const kelas = url.searchParams.get('kelas');
  const studentId = url.searchParams.get('studentId');
  const authCode = String(url.searchParams.get('authCode') || '').trim(); // NISN atau NIS untuk verifikasi
  const q = String(url.searchParams.get('q') || '').trim();

  try {
    // 1. Ambil daftar ringkas siswa per kelas (untuk tampilan awal setelah pilih kelas)
    if (action === 'list_class' && kelas) {
      const rows = await db.prepare(`
        SELECT id, nama_siswa, jenis_kelamin, kelas, nisn, nis
        FROM students
        WHERE kelas = ? AND (status IS NULL OR LOWER(status) != 'alumni')
        ORDER BY nama_siswa ASC
      `).bind(kelas).all();

      return json({
        success: true,
        students: (rows.results || []).map((s) => ({
          id: s.id,
          nama_siswa: s.nama_siswa,
          jenis_kelamin: s.jenis_kelamin,
          kelas: s.kelas,
          hasNisn: !!s.nisn,
          hasNis: !!s.nis,
        })),
      });
    }

    // 2. Ambil Profil Data Siswa (bebas buka tanpa NISN, field sensitif disensor)
    if (action === 'profile' && studentId) {
      const profile = await getStudentProfile(db, studentId);
      if (!profile) {
        return json({ success: false, message: 'Data ananda tidak ditemukan' }, { status: 404 });
      }
      return json({ success: true, profile });
    }

    // 3. Akses Nilai Rapor (Memerlukan verifikasi NISN atau NIS untuk SD, atau langsung jika TK)
    if (action === 'raport' && studentId) {
      // Periksa data siswa
      const stu = await db.prepare(`SELECT id, kelas, nisn, nis FROM students WHERE id = ?`).bind(studentId).first();
      if (!stu) {
        return json({ success: false, message: 'Data ananda tidak ditemukan' }, { status: 404 });
      }

      const isTK = String(stu.kelas || '').toUpperCase() === 'TK';

      // Jika bukan TK, lakukan verifikasi NISN / NIS
      if (!isTK) {
        if (!authCode) {
          return json({ success: false, message: 'Silakan masukkan nomor NISN atau NIS ananda untuk melihat rapor.' }, { status: 400 });
        }

        const cleanAuth = authCode.replace(/\s+/g, '');
        const cleanNisn = String(stu.nisn || '').replace(/\s+/g, '');
        const cleanNis = String(stu.nis || '').replace(/\s+/g, '');

        const matchNisn = cleanNisn && cleanNisn === cleanAuth;
        const matchNis = cleanNis && cleanNis === cleanAuth;

        if (!matchNisn && !matchNis) {
          return json({
            success: false,
            message: 'NISN atau NIS yang Anda masukkan tidak sesuai dengan data ananda. Mohon periksa kembali.',
          }, { status: 403 });
        }
      }

      // Berhasil verifikasi -> ambil data lengkap rapor
      const data = await getStudentFullData(db, studentId);
      return json({ success: true, ...data });
    }

    // 4. Fallback: Akses langsung via studentId lama
    if (studentId) {
      const data = await getStudentFullData(db, studentId);
      if (!data) {
        return json({ success: false, message: 'Data ananda tidak ditemukan' }, { status: 404 });
      }
      return json({ success: true, single: true, ...data });
    }

    // 5. Fallback: Pencarian teks via query q (pencarian nama)
    if (q && q.length >= 2) {
      const normalized = q.toLowerCase();
      const wild = `%${normalized}%`;

      const matches = await db.prepare(`
        SELECT id, nama_siswa, jenis_kelamin, kelas, nisn, nis
        FROM students
        WHERE LOWER(nama_siswa) LIKE ?
           OR REPLACE(REPLACE(LOWER(nama_siswa), '.', ''), ' ', '') LIKE ?
        ORDER BY nama_siswa ASC
        LIMIT 20
      `).bind(wild, `%${normalized.replace(/[\s.]/g, '')}%`).all();

      return json({
        success: true,
        students: matches.results || [],
      });
    }

    return json({ success: false, message: 'Parameter tidak valid' }, { status: 400 });
  } catch (err) {
    return json({ success: false, message: err.message }, { status: 500 });
  }
}
