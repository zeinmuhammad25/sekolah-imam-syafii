// Endpoint Presensi / Absensi Guru Cloudflare D1
// Mendukung Jam Masuk Individual per Guru & Koreksi/Reset oleh Admin

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

function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'today';
  const teacherId = url.searchParams.get('teacherId');
  const month = url.searchParams.get('month'); // YYYY-MM
  const dateParam = url.searchParams.get('date');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  try {
    // 1. Ambil Pengaturan Presensi
    const settings = await db.prepare("SELECT * FROM attendance_settings WHERE id = 'default'").first();
    const defaultSettings = {
      work_start_time: '07:15',
      late_threshold_time: '07:30',
      work_end_time: '15:00',
      school_latitude: 3.662972,
      school_longitude: 98.719222,
      max_distance_meters: 100,
      is_geofence_enabled: 1,
      ...settings,
    };

    if (action === 'settings') {
      return Response.json({ success: true, settings: defaultSettings });
    }

    // 2. Ambil Semua Anggota Guru Absensi (Untuk Pengelolaan Admin)
    if (action === 'members') {
      const members = await db.prepare(
        "SELECT * FROM teacher_attendance_members ORDER BY is_active DESC, name ASC"
      ).all();
      return Response.json({ success: true, members: members.results || [] });
    }

    // 3. Ambil Guru List Aktif untuk Dropdown Absensi
    if (action === 'teachers') {
      let teachers = await db.prepare(
        "SELECT id, name, role, work_start_time, late_threshold_time, work_end_time, work_days, is_active FROM teacher_attendance_members WHERE is_active = 1 ORDER BY name ASC"
      ).all();

      // Fallback jika belum ada data di teacher_attendance_members
      if (!teachers.results || teachers.results.length === 0) {
        teachers = await db.prepare("SELECT id, name, role FROM teachers ORDER BY position, rowid").all();
      }

      return Response.json({ success: true, teachers: teachers.results || [] });
    }

    // 4. Ambil data presensi hari ini
    const today = dateParam || getWibDate().date;
    if (action === 'today') {
      let query = "SELECT * FROM teacher_attendances WHERE date = ?";
      const params = [today];
      if (teacherId) {
        query += " AND teacher_id = ?";
        params.push(teacherId);
      }
      query += " ORDER BY check_in_time DESC";
      const records = await db.prepare(query).bind(...params).all();

      return Response.json({
        success: true,
        today,
        serverTime: getWibDate(),
        settings: defaultSettings,
        attendances: records.results || [],
      });
    }

    // 5. Ambil Rekap Presensi (Mendukung Rentang Hari startDate s/d endDate atau Bulanan)
    if (action === 'recap') {
      let query = "SELECT * FROM teacher_attendances WHERE ";
      const params = [];

      if (startDate && endDate) {
        query += "date >= ? AND date <= ?";
        params.push(startDate, endDate);
      } else {
        const targetMonth = month || today.slice(0, 7); // 'YYYY-MM'
        query += "date LIKE ?";
        params.push(`${targetMonth}%`);
      }

      if (teacherId && teacherId !== 'ALL') {
        query += " AND teacher_id = ?";
        params.push(teacherId);
      }
      query += " ORDER BY date DESC, check_in_time DESC";
      const records = await db.prepare(query).bind(...params).all();

      return Response.json({
        success: true,
        startDate: startDate || null,
        endDate: endDate || null,
        month: month || today.slice(0, 7),
        settings: defaultSettings,
        attendances: records.results || [],
      });
    }

    return Response.json({ success: false, error: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err) {
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

    // ==================== A. CRUD MASTER GURU ABSENSI ====================
    if (action === 'add_member') {
      const {
        name,
        nip = '',
        role = '',
        work_start_time = '07:15',
        late_threshold_time = '07:30',
        work_end_time = '15:00',
        work_days = '["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]',
        is_active = 1,
      } = body;
      if (!name || !name.trim()) {
        return Response.json({ success: false, error: 'Nama guru wajib diisi.' }, { status: 400 });
      }

      const daysStr = typeof work_days === 'string' ? work_days : JSON.stringify(work_days || []);
      const id = 'guru-' + epoch + '-' + Math.random().toString(36).slice(2, 6);
      await db.prepare(`
        INSERT INTO teacher_attendance_members (
          id, name, nip, role, work_start_time, late_threshold_time, work_end_time, work_days, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, name.trim(), nip.trim(), role.trim(),
        work_start_time, late_threshold_time, work_end_time, daysStr, Number(is_active) ? 1 : 0,
        epoch, epoch
      ).run();

      return Response.json({ success: true, message: 'Guru berhasil ditambahkan ke master absensi.', id });
    }

    if (action === 'update_member') {
      const {
        id,
        name,
        nip = '',
        role = '',
        work_start_time = '07:15',
        late_threshold_time = '07:30',
        work_end_time = '15:00',
        work_days = '["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]',
        is_active = 1,
      } = body;
      if (!id || !name || !name.trim()) {
        return Response.json({ success: false, error: 'ID dan nama guru wajib diisi.' }, { status: 400 });
      }

      const daysStr = typeof work_days === 'string' ? work_days : JSON.stringify(work_days || []);
      await db.prepare(`
        UPDATE teacher_attendance_members SET
          name = ?, nip = ?, role = ?, work_start_time = ?, late_threshold_time = ?, work_end_time = ?, work_days = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        name.trim(), nip.trim(), role.trim(),
        work_start_time, late_threshold_time, work_end_time, daysStr, Number(is_active) ? 1 : 0,
        epoch, id
      ).run();

      return Response.json({ success: true, message: 'Data guru & jam kerja berhasil diperbarui.' });
    }

    if (action === 'delete_member') {
      const { id } = body;
      if (!id) return Response.json({ success: false, error: 'ID guru wajib disertakan.' }, { status: 400 });

      await db.prepare("DELETE FROM teacher_attendance_members WHERE id = ?").bind(id).run();
      return Response.json({ success: true, message: 'Guru berhasil dihapus dari master absensi.' });
    }

    // ==================== B. KOREKSI & RESET OLEH ADMIN ====================
    if (action === 'admin_add_record') {
      const {
        teacherId, teacherName, date,
        status = 'hadir',
        check_in_time, check_in_status = 'tepat_waktu', late_minutes = 0,
        check_out_time, check_out_status = 'tepat_waktu', early_minutes = 0,
        notes = 'Diinput manual oleh Admin',
      } = body;

      if (!teacherId || !teacherName || !date) {
        return Response.json({ success: false, error: 'Guru dan tanggal presensi wajib diisi.' }, { status: 400 });
      }

      // Cek apakah guru sudah memiliki presensi pada tanggal tersebut
      const existing = await db.prepare(
        "SELECT * FROM teacher_attendances WHERE teacher_id = ? AND date = ?"
      ).bind(teacherId, date).first();

      if (existing && existing.status !== 'dikecualikan') {
        return Response.json({
          success: false,
          error: `Guru "${teacherName}" sudah memiliki presensi pada tanggal ${date}. Silakan gunakan fitur Edit untuk mengoreksi data.`,
        }, { status: 400 });
      }

      if (existing && existing.status === 'dikecualikan') {
        await db.prepare(`
          UPDATE teacher_attendances SET
            teacher_name = ?,
            status = ?,
            check_in_time = ?,
            check_in_status = ?,
            late_minutes = ?,
            check_out_time = ?,
            check_out_status = ?,
            early_minutes = ?,
            notes = ?,
            updated_at = ?
          WHERE id = ?
        `).bind(
          teacherName, status,
          check_in_time ? (check_in_time.length === 5 ? `${check_in_time}:00` : check_in_time) : null,
          status === 'hadir' ? (check_in_status || 'tepat_waktu') : null,
          status === 'hadir' && check_in_status === 'terlambat' ? Number(late_minutes) : 0,
          check_out_time ? (check_out_time.length === 5 ? `${check_out_time}:00` : check_out_time) : null,
          status === 'hadir' ? (check_out_status || 'tepat_waktu') : null,
          status === 'hadir' && check_out_status === 'pulang_cepat' ? Number(early_minutes) : 0,
          notes || '', epoch, existing.id
        ).run();

        return Response.json({
          success: true,
          message: `Presensi ${teacherName} tanggal ${date} berhasil ditambahkan secara manual.`,
        });
      }

      const id = `att-${date}-${teacherId}`;
      await db.prepare(`
        INSERT INTO teacher_attendances (
          id, teacher_id, teacher_name, date, status,
          check_in_time, check_in_status, late_minutes,
          check_out_time, check_out_status, early_minutes,
          notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, teacherId, teacherName, date, status,
        check_in_time ? (check_in_time.length === 5 ? `${check_in_time}:00` : check_in_time) : null,
        status === 'hadir' ? (check_in_status || 'tepat_waktu') : null,
        status === 'hadir' && check_in_status === 'terlambat' ? Number(late_minutes) : 0,
        check_out_time ? (check_out_time.length === 5 ? `${check_out_time}:00` : check_out_time) : null,
        status === 'hadir' ? (check_out_status || 'tepat_waktu') : null,
        status === 'hadir' && check_out_status === 'pulang_cepat' ? Number(early_minutes) : 0,
        notes || '', epoch
      ).run();

      return Response.json({
        success: true,
        message: `Presensi ${teacherName} tanggal ${date} berhasil ditambahkan secara manual.`,
      });
    }

    if (action === 'admin_update_record') {
      const { id, check_in_time, check_in_status, late_minutes, check_out_time, check_out_status, early_minutes, status, notes } = body;
      if (!id) return Response.json({ success: false, error: 'ID record presensi tidak ditemukan.' }, { status: 400 });

      await db.prepare(`
        UPDATE teacher_attendances SET
          check_in_time = ?,
          check_in_status = ?,
          late_minutes = ?,
          check_out_time = ?,
          check_out_status = ?,
          early_minutes = ?,
          status = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        check_in_time || null,
        check_in_status || 'tepat_waktu',
        Number(late_minutes) || 0,
        check_out_time || null,
        check_out_status || null,
        Number(early_minutes) || 0,
        status || 'hadir',
        notes || '',
        epoch,
        id
      ).run();

      return Response.json({ success: true, message: 'Data presensi berhasil dikoreksi oleh Admin.' });
    }

    // Hapus Satuan / Reset
    if (action === 'admin_reset_record') {
      const { id, item } = body;
      const targetItem = item || { id };
      const isVirtual = targetItem.isVirtual || (targetItem.id && String(targetItem.id).startsWith('virtual-'));
      const date = targetItem.date;
      const teacherId = targetItem.teacher_id || targetItem.teacherId;
      const teacherName = targetItem.teacher_name || targetItem.teacherName || '';

      if (isVirtual && date && teacherId) {
        const exemptId = `att-exempt-${date}-${teacherId}`;
        await db.prepare(`
          INSERT INTO teacher_attendances (
            id, teacher_id, teacher_name, date, status, notes, updated_at
          ) VALUES (?, ?, ?, ?, 'dikecualikan', 'Dihapus/Dikecualikan oleh Admin', ?)
          ON CONFLICT(id) DO UPDATE SET
            status = 'dikecualikan',
            notes = 'Dihapus/Dikecualikan oleh Admin',
            updated_at = excluded.updated_at
        `).bind(exemptId, teacherId, teacherName, date, epoch).run();
      } else if (targetItem.id) {
        await db.prepare(`
          UPDATE teacher_attendances SET
            status = 'dikecualikan',
            check_in_time = NULL,
            check_in_status = NULL,
            late_minutes = 0,
            check_out_time = NULL,
            check_out_status = NULL,
            early_minutes = 0,
            notes = 'Dihapus/Dikecualikan oleh Admin',
            updated_at = ?
          WHERE id = ?
        `).bind(epoch, targetItem.id).run();
      }

      return Response.json({
        success: true,
        message: 'Data presensi berhasil dihapus dari rekap.',
      });
    }

    // Hapus Massal (Bulk Delete)
    if (action === 'admin_delete_records') {
      const { items = [] } = body;
      if (!Array.isArray(items) || items.length === 0) {
        return Response.json({ success: false, error: 'Tidak ada data presensi yang dipilih untuk dihapus.' }, { status: 400 });
      }

      for (const item of items) {
        const isVirtual = item.isVirtual || (item.id && String(item.id).startsWith('virtual-'));
        const date = item.date;
        const teacherId = item.teacher_id || item.teacherId;
        const teacherName = item.teacher_name || item.teacherName || '';

        if (isVirtual && date && teacherId) {
          const exemptId = `att-exempt-${date}-${teacherId}`;
          await db.prepare(`
            INSERT INTO teacher_attendances (
              id, teacher_id, teacher_name, date, status, notes, updated_at
            ) VALUES (?, ?, ?, ?, 'dikecualikan', 'Dihapus/Dikecualikan oleh Admin', ?)
            ON CONFLICT(id) DO UPDATE SET
              status = 'dikecualikan',
              notes = 'Dihapus/Dikecualikan oleh Admin',
              updated_at = excluded.updated_at
          `).bind(exemptId, teacherId, teacherName, date, epoch).run();
        } else if (item.id) {
          await db.prepare(`
            UPDATE teacher_attendances SET
              status = 'dikecualikan',
              check_in_time = NULL,
              check_in_status = NULL,
              late_minutes = 0,
              check_out_time = NULL,
              check_out_status = NULL,
              early_minutes = 0,
              notes = 'Dihapus/Dikecualikan oleh Admin',
              updated_at = ?
            WHERE id = ?
          `).bind(epoch, item.id).run();
        }
      }

      return Response.json({
        success: true,
        message: `${items.length} data presensi berhasil dihapus.`,
      });
    }

    // ==================== C. PRESENSI MANDIRI OLEH GURU (CHECK IN / OUT / LEAVE) ====================
    const {
      teacherId,
      teacherName,
      type = 'check_in', // 'check_in' | 'check_out' | 'leave'
      userLat,
      userLng,
      status = 'hadir', // 'hadir' | 'izin' | 'sakit' | 'dinas'
      notes = '',
    } = body;

    if (!teacherId || !teacherName) {
      return Response.json({ success: false, error: 'Identitas guru wajib disertakan.' }, { status: 400 });
    }

    // Ambil Pengaturan Umum Sekolah
    const settings = await db.prepare("SELECT * FROM attendance_settings WHERE id = 'default'").first() || {
      late_threshold_time: '07:30',
      work_end_time: '15:00',
      school_latitude: 3.662972,
      school_longitude: 98.719222,
      max_distance_meters: 100,
      is_geofence_enabled: 1,
    };

    // Ambil Jam Kerja Khusus Guru Ini (Jika Ada)
    const member = await db.prepare("SELECT * FROM teacher_attendance_members WHERE id = ?").bind(teacherId).first();
    const effectiveLateThreshold = member?.late_threshold_time || settings.late_threshold_time || '07:30';
    const effectiveWorkEnd = member?.work_end_time || settings.work_end_time || '15:00';

    const wib = getWibDate();
    const distance = (userLat != null && userLng != null)
      ? calculateDistanceInMeters(userLat, userLng, settings.school_latitude, settings.school_longitude)
      : null;

    // Validasi Geofencing jika tipe kehadiran (bukan izin/sakit)
    if (type !== 'leave' && settings.is_geofence_enabled) {
      if (distance == null) {
        return Response.json({
          success: false,
          error: 'Lokasi GPS tidak terdeteksi. Pastikan GPS HP aktif dan izin lokasi diizinkan.',
        }, { status: 400 });
      }

      if (distance > settings.max_distance_meters) {
        return Response.json({
          success: false,
          distance,
          maxDistance: settings.max_distance_meters,
          error: `Anda berada di luar jangkauan sekolah (${distance} meter). Maksimal radius yang diizinkan adalah ${settings.max_distance_meters} meter.`,
        }, { status: 403 });
      }
    }

    // Cek apakah sudah ada record presensi hari ini
    const existing = await db.prepare(
      "SELECT * FROM teacher_attendances WHERE teacher_id = ? AND date = ?"
    ).bind(teacherId, wib.date).first();

    const recordId = existing ? existing.id : `att-${wib.date}-${teacherId}`;

    if (type === 'check_in') {
      if (existing && existing.check_in_time) {
        return Response.json({
          success: false,
          error: `Anda sudah melakukan absen masuk hari ini pukul ${existing.check_in_time} WIB.`,
          existing,
        }, { status: 400 });
      }

      const nowMinutes = parseTimeToMinutes(wib.timeShort);
      const thresholdMinutes = parseTimeToMinutes(effectiveLateThreshold);
      const isLate = nowMinutes > thresholdMinutes;
      const lateMinutes = isLate ? (nowMinutes - thresholdMinutes) : 0;
      const checkInStatus = isLate ? 'terlambat' : 'tepat_waktu';

      if (existing) {
        await db.prepare(`
          UPDATE teacher_attendances SET
            check_in_time = ?,
            check_in_status = ?,
            late_minutes = ?,
            check_in_distance = ?,
            check_in_lat = ?,
            check_in_lng = ?,
            status = 'hadir',
            notes = ?,
            updated_at = ?
          WHERE id = ?
        `).bind(
          wib.time, checkInStatus, lateMinutes, distance, userLat || null, userLng || null,
          notes, wib.epoch, recordId
        ).run();
      } else {
        await db.prepare(`
          INSERT INTO teacher_attendances (
            id, teacher_id, teacher_name, date, check_in_time, check_in_status,
            late_minutes, check_in_distance, check_in_lat, check_in_lng, status, notes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hadir', ?, ?)
        `).bind(
          recordId, teacherId, teacherName, wib.date, wib.time, checkInStatus,
          lateMinutes, distance, userLat || null, userLng || null, notes, wib.epoch
        ).run();
      }

      return Response.json({
        success: true,
        action: 'check_in',
        checkInStatus,
        lateMinutes,
        time: wib.time,
        date: wib.date,
        distance,
        message: isLate
          ? `Presensi masuk berhasil! Anda terlambat ${lateMinutes} menit (Batas: ${effectiveLateThreshold} WIB).`
          : 'Presensi masuk berhasil! Anda hadir tepat waktu. Barakallahu fiik.',
      });
    }

    if (type === 'check_out') {
      if (!existing || !existing.check_in_time) {
        return Response.json({
          success: false,
          error: 'Anda belum melakukan absen masuk hari ini. Silakan absen masuk terlebih dahulu.',
        }, { status: 400 });
      }

      if (existing.check_out_time) {
        return Response.json({
          success: false,
          error: `Anda sudah melakukan absen pulang hari ini pukul ${existing.check_out_time} WIB.`,
          existing,
        }, { status: 400 });
      }

      const nowMinutes = parseTimeToMinutes(wib.timeShort);
      const endMinutes = parseTimeToMinutes(effectiveWorkEnd);
      const isEarly = nowMinutes < endMinutes;
      const earlyMinutes = isEarly ? (endMinutes - nowMinutes) : 0;
      const checkOutStatus = isEarly ? 'pulang_cepat' : 'tepat_waktu';

      await db.prepare(`
        UPDATE teacher_attendances SET
          check_out_time = ?,
          check_out_status = ?,
          early_minutes = ?,
          check_out_distance = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(wib.time, checkOutStatus, earlyMinutes, distance, wib.epoch, recordId).run();

      return Response.json({
        success: true,
        action: 'check_out',
        checkOutStatus,
        earlyMinutes,
        time: wib.time,
        date: wib.date,
        distance,
        message: isEarly
          ? `Presensi pulang tercatat pukul ${wib.timeShort} WIB (${earlyMinutes} menit lebih awal dari jadwal ${effectiveWorkEnd} WIB).`
          : `Presensi pulang berhasil tercatat tepat waktu pukul ${wib.timeShort} WIB. Selamat beristirahat!`,
      });
    }

    if (type === 'leave') {
      if (existing) {
        await db.prepare(`
          UPDATE teacher_attendances SET
            status = ?,
            notes = ?,
            updated_at = ?
          WHERE id = ?
        `).bind(status, notes, wib.epoch, recordId).run();
      } else {
        await db.prepare(`
          INSERT INTO teacher_attendances (
            id, teacher_id, teacher_name, date, status, notes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(recordId, teacherId, teacherName, wib.date, status, notes, wib.epoch).run();
      }

      return Response.json({
        success: true,
        action: 'leave',
        status,
        date: wib.date,
        message: `Keterangan ${status.toUpperCase()} berhasil disimpan.`,
      });
    }

    return Response.json({ success: false, error: 'Tipe absensi tidak valid' }, { status: 400 });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const {
      work_start_time = '07:15',
      late_threshold_time = '07:30',
      work_end_time = '15:00',
      school_latitude = 3.662972,
      school_longitude = 98.719222,
      max_distance_meters = 100,
      is_geofence_enabled = 1,
    } = body;

    const epoch = Date.now();

    await db.prepare(`
      INSERT INTO attendance_settings (
        id, work_start_time, late_threshold_time, work_end_time,
        school_latitude, school_longitude, max_distance_meters, is_geofence_enabled, updated_at
      ) VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        work_start_time = excluded.work_start_time,
        late_threshold_time = excluded.late_threshold_time,
        work_end_time = excluded.work_end_time,
        school_latitude = excluded.school_latitude,
        school_longitude = excluded.school_longitude,
        max_distance_meters = excluded.max_distance_meters,
        is_geofence_enabled = excluded.is_geofence_enabled,
        updated_at = excluded.updated_at
    `).bind(
      work_start_time, late_threshold_time, work_end_time,
      Number(school_latitude), Number(school_longitude),
      Number(max_distance_meters), Number(is_geofence_enabled) ? 1 : 0, epoch
    ).run();

    return Response.json({
      success: true,
      message: 'Pengaturan presensi berhasil disimpan.',
      settings: {
        work_start_time, late_threshold_time, work_end_time,
        school_latitude, school_longitude, max_distance_meters, is_geofence_enabled,
      },
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
