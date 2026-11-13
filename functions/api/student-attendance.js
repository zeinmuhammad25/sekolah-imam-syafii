// Endpoint Presensi / Absensi Siswa Cloudflare D1
// Mendukung Scan QR di HP Wali Kelas & Guru Piket, Batch Submit, dan Integrasi Portal Ortu

import { bumpVersion } from '../_lib/writes.js';

function getWibDate() {
  const now = new Date();
  // Tambah offset UTC+7 (420 menit)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000));
  
  const yyyy = wib.getFullYear();
  const mm = String(wib.getMonth() + 1).padStart(2, '0');
  const dd = String(wib.getDate()).padStart(2, '0');
  const hh = String(wib.getHours()).padStart(2, '0');
  const ii = String(wib.getMinutes()).padStart(2, '0');
  const ss = String(wib.getSeconds()).padStart(2, '0');

  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${ii}:${ss}`,
    timeShort: `${hh}:${ii}`,
    hours: wib.getHours(),
    minutes: wib.getMinutes(),
    epoch: now.getTime(),
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'today_class';
  const kelas = url.searchParams.get('kelas') || (action === 'recap' ? 'ALL' : 'SD 1');
  const studentId = url.searchParams.get('studentId');
  const dateParam = url.searchParams.get('date');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  const wib = getWibDate();
  const targetDate = dateParam || wib.date;

  try {
    // 1. Data Presensi Kelas Hari Ini untuk Layar Scan Guru
    if (action === 'today_class') {
      // Ambil daftar siswa aktif kelas tersebut
      const studentsQuery = `
        SELECT id, nama_siswa, nisn, nis, jenis_kelamin, kelas, foto_siswa, status
        FROM students
        WHERE LOWER(TRIM(kelas)) = LOWER(TRIM(?))
          AND (status IS NULL OR LOWER(TRIM(status)) != 'alumni')
        ORDER BY nama_siswa ASC
      `;
      const studentsRes = await db.prepare(studentsQuery).bind(kelas).all();
      const students = studentsRes.results || [];

      // Ambil presensi yang sudah tercatat pada tanggal & kelas tersebut
      const attQuery = `
        SELECT *
        FROM student_attendances
        WHERE date = ? AND LOWER(TRIM(kelas)) = LOWER(TRIM(?))
        ORDER BY student_name ASC
      `;
      const attRes = await db.prepare(attQuery).bind(targetDate, kelas).all();
      const attendances = attRes.results || [];

      return Response.json({
        success: true,
        date: targetDate,
        kelas,
        serverTime: wib,
        students,
        attendances,
        isSubmitted: attendances.length > 0,
      });
    }

    // 2. Lookup Kehadiran Hari Ini untuk Portal Orang Tua (/portal-ortu)
    if (action === 'parent_today') {
      if (!studentId) {
        return Response.json({ success: false, error: 'ID Siswa wajib disertakan.' }, { status: 400 });
      }

      const row = await db.prepare(`
        SELECT id, date, kelas, student_id, student_name, status, method, scan_time, notes, updated_at
        FROM student_attendances
        WHERE student_id = ? AND date = ?
      `).bind(studentId, targetDate).first();

      return Response.json({
        success: true,
        date: targetDate,
        studentId,
        serverTime: wib,
        attendance: row || null,
      });
    }

    // 3. Rekapitulasi Presensi Siswa (Rentang Tanggal & Kelas)
    if (action === 'recap') {
      let query = 'SELECT * FROM student_attendances WHERE ';
      const params = [];

      if (startDate && endDate) {
        query += 'date >= ? AND date <= ?';
        params.push(startDate, endDate);
      } else {
        query += 'date = ?';
        params.push(targetDate);
      }

      if (kelas && kelas !== 'ALL') {
        query += ' AND LOWER(TRIM(kelas)) = LOWER(TRIM(?))';
        params.push(kelas);
      }

      if (studentId && studentId !== 'ALL') {
        query += ' AND student_id = ?';
        params.push(studentId);
      }

      query += ' ORDER BY date DESC, kelas ASC, student_name ASC';
      const records = await db.prepare(query).bind(...params).all();

      // Ambil daftar seluruh siswa aktif (Semua kelas atau kelas spesifik)
      let studentsQuery = `
        SELECT id, nama_siswa, nisn, nis, jenis_kelamin, kelas
        FROM students
        WHERE (status IS NULL OR LOWER(TRIM(status)) != 'alumni')
      `;
      const studentsParams = [];
      if (kelas && kelas !== 'ALL') {
        studentsQuery += ' AND LOWER(TRIM(kelas)) = LOWER(TRIM(?))';
        studentsParams.push(kelas);
      }
      studentsQuery += ' ORDER BY kelas ASC, nama_siswa ASC';
      const studentsRes = await db.prepare(studentsQuery).bind(...studentsParams).all();

      return Response.json({
        success: true,
        startDate: startDate || targetDate,
        endDate: endDate || targetDate,
        kelas: kelas || 'ALL',
        attendances: records.results || [],
        students: studentsRes.results || [],
      });
    }

    return Response.json({ success: false, error: 'Aksi GET tidak dikenali.' }, { status: 400 });
  } catch (err) {
    console.error('student-attendance GET error:', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const { action } = body;
    const epoch = Date.now();
    const wib = getWibDate();

    // ==================== BATCH SUBMIT DARI WALI KELAS ====================
    if (action === 'submit_batch') {
      const {
        date,
        kelas,
        submitted_by = 'Guru Wali Kelas',
        items = [],
      } = body;

      const targetDate = date || wib.date;

      if (!kelas || !Array.isArray(items) || items.length === 0) {
        return Response.json({
          success: false,
          error: 'Kelas dan daftar presensi siswa wajib disertakan.',
        }, { status: 400 });
      }

      // Bangun statement batch atomik (SQLite transaction)
      const stmts = items.map((item) => {
        const studentId = String(item.student_id || item.id || '').trim();
        const studentName = String(item.student_name || item.name || '').trim();
        const status = ['hadir', 'sakit', 'izin', 'alpha'].includes(item.status) ? item.status : 'hadir';
        const method = item.method || (item.status === 'hadir' ? 'qr_scan' : 'manual_wali_kelas');
        const scanTime = item.scan_time || (status === 'hadir' ? wib.time : null);
        const notes = item.notes || '';
        const recId = `att-${targetDate}-${studentId}`;

        return db.prepare(`
          INSERT INTO student_attendances (
            id, date, kelas, student_id, student_name, status, method, scan_time, notes, submitted_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            method = excluded.method,
            scan_time = excluded.scan_time,
            notes = excluded.notes,
            submitted_by = excluded.submitted_by,
            updated_at = excluded.updated_at
        `).bind(
          recId, targetDate, kelas, studentId, studentName,
          status, method, scanTime, notes, submitted_by,
          epoch, epoch
        );
      });

      // Tambahkan bumpVersion agar cache data sekolah ikut segar
      stmts.push(bumpVersion(db));

      // Eksekusi atomik seluruh kelas dalam 1 transaksi
      await db.batch(stmts);

      return Response.json({
        success: true,
        message: `Presensi ${items.length} siswa kelas ${kelas} tanggal ${targetDate} berhasil disimpan.`,
        date: targetDate,
        kelas,
        count: items.length,
      });
    }

    // ==================== KOREKSI SATUAN SISWA ====================
    if (action === 'update_single') {
      const {
        student_id,
        date,
        kelas,
        student_name,
        status = 'hadir',
        method = 'manual_wali_kelas',
        scan_time,
        notes = '',
        submitted_by = 'Koreksi Guru',
      } = body;

      const targetDate = date || wib.date;
      if (!student_id || !kelas) {
        return Response.json({ success: false, error: 'Student ID dan Kelas wajib disertakan.' }, { status: 400 });
      }

      const recId = `att-${targetDate}-${student_id}`;
      await db.prepare(`
        INSERT INTO student_attendances (
          id, date, kelas, student_id, student_name, status, method, scan_time, notes, submitted_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          method = excluded.method,
          scan_time = excluded.scan_time,
          notes = excluded.notes,
          submitted_by = excluded.submitted_by,
          updated_at = excluded.updated_at
      `).bind(
        recId, targetDate, kelas, student_name || '',
        status, method, scan_time || (status === 'hadir' ? wib.time : null), notes, submitted_by,
        epoch, epoch
      ).run();

      await bumpVersion(db).run();

      return Response.json({
        success: true,
        message: `Presensi siswa berhasil diperbarui.`,
      });
    }

    return Response.json({ success: false, error: 'Aksi POST tidak dikenali.' }, { status: 400 });
  } catch (err) {
    console.error('student-attendance POST error:', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
