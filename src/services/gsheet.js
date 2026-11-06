/**
 * Service API ke backend Cloudflare Pages Functions -> D1/R2 (bekas: Apps Script + Google Sheets).
 * Semua endpoint di bawah relatif (/api/*) karena Functions berjalan di domain yang sama
 * dengan situs ini -- lihat d1/README.md untuk arsitektur & cara migrasi.
 */

// Google Sheets serializes date cells as ISO (e.g. 2026-07-05T17:00:00.000Z).
// Format to plain YYYY-MM-DD in Jakarta time so the day matches what's typed in the sheet.
// (Kolom tanggal di D1 dipertahankan format yang sama supaya fungsi ini tetap berlaku apa adanya.)
export const formatSheetDate = (d) => {
  if (typeof d !== 'string' || !d.includes('T')) return d;
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};

// Sama seperti formatSheetDate, tapi tampil DD/MM/YYYY (dipakai Data Siswa untuk tanggal_lahir).
export const formatSheetDateDMY = (d) => {
  const iso = formatSheetDate(d);
  const m = typeof iso === 'string' && iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
};

// Terima link YouTube dalam format apapun (watch?v=, youtu.be/, embed/, shorts/) atau ID mentah -> ID 11 karakter.
export const extractYoutubeId = (input) => {
  const s = (input || '').trim();
  if (!s) return '';
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{11}$/.test(s) ? s : '';
};

// Snapshot seluruh data situs (publik, tanpa login) -- pengganti doGet Apps Script.
// Beberapa komponen yang memanggil bersamaan cukup berbagi 1 request (tidak dobel).
// Server mengirim ETag per versi data -> kalau belum ada perubahan, browser dapat 304
// dan memakai salinannya sendiri (cepat & hemat kuota), tapi SELALU dicek ulang ke
// server sehingga perubahan guru lain langsung terlihat.
let inflight = null;
export const fetchSchoolData = () => {
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const response = await fetch('/api/data', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json();
    } catch (error) {
      console.error('Error fetching school data:', error);
      return null;
    } finally {
      if (inflight === p) inflight = null;
    }
  })();
  inflight = p;
  return p;
};

// Pesan standar untuk hasil mutateRow yang gagal (bentrok dgn guru lain, sudah dihapus, dst).
export const describeMutationError = (res) => {
  if (!res) return 'Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.';
  if (res.error) return res.error;
  if (res.conflict) return 'Data ini baru saja diubah oleh guru lain. Muat ulang lalu ulangi.';
  return 'Tidak diketahui — periksa koneksi lalu coba lagi.';
};

// Form PPDB publik (halaman utama) -- tanpa login.
export const submitPPDBForm = async (formData) => {
  try {
    const res = await fetch('/api/ppdb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    return await res.json();
  } catch (error) {
    console.error('Error submitting form:', error);
    return { success: false, error: String(error) };
  }
};

// Admin: tambah/edit/hapus/reorder baris (Gallery/Teachers/News/Videos/Students/
// QuestionFolders/Questions/ReportPeriods/ReportGrades/ReportAspects/ReportExtras).
// Wajib login (sesi lewat cookie HttpOnly) -- lihat functions/api/row.js.
// `expectedUpdatedAt` = versi baris yang sedang dilihat guru. Kalau guru lain sudah
// menyimpan lebih dulu, server menolak ({ conflict: true }) alih-alih menimpa diam-diam.
export const mutateRow = async ({ action, sheetName, row, id, direction, ids, expectedUpdatedAt, ops }) => {
  try {
    const res = await fetch('/api/row', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, sheetName, row, id, direction, ids, expectedUpdatedAt, ops }),
    });
    inflight = null; // data sudah berubah -> muat-ulang berikutnya wajib request baru, bukan nebeng yang lama
    if (res.status === 401) {
      sessionStorage.removeItem('isTeacherAuthenticated');
      return { success: false, error: 'Sesi login habis. Silakan login ulang lalu ulangi.' };
    }
    return await res.json();
  } catch (error) {
    console.error('mutateRow error:', error);
    return { success: false, error: String(error) };
  }
};

// Admin: simpan banyak perubahan sekaligus dalam SATU transaksi (semua tersimpan, atau
// kalau ada yang bentrok dgn guru lain -> tidak ada yang tersimpan sama sekali).
// ops: [{ action: 'add'|'update'|'delete', sheetName, id?, row?, expectedUpdatedAt? }]
// -> { success, results: [{ id, updatedAt }] }  |  { success:false, conflict, conflicts, error }
export const mutateBatch = (ops) => mutateRow({ action: 'batch', ops });

// Admin: upload foto -> Cloudflare R2 -> { success, url }. Wajib login.
export const uploadImage = async (file) => {
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    const res = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: dataUrl, filename: file.name }),
    });
    return await res.json();
  } catch (error) {
    console.error('uploadImage error:', error);
    return { success: false, error: String(error) };
  }
};

// Admin: pindahkan file foto KK ke folder jenjang lain di Drive (dipakai saat siswa naik kelas).
// Foto KK masih ditempel manual sebagai link Drive oleh TU (bukan lewat upload aplikasi),
// jadi di luar cakupan migrasi D1/R2 -- tetap lewat Apps Script lama.
const LEGACY_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxZeLyTT-hteg2Rv9VXI2RwC0QTcjX_PSyiDepd5s-cozdrW2V19m9OFaADc7PXrCZGPg/exec';
export const moveKKFile = async ({ fotoKkUrl, targetKelas }) => {
  try {
    const res = await fetch(LEGACY_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'MOVE_KK_FILE', fotoKkUrl, targetKelas }),
    });
    return await res.json();
  } catch (error) {
    console.error('moveKKFile error:', error);
    return { success: false, error: String(error) };
  }
};

// ==================== Ujian Berkala & Portal Orang Tua ====================

// Guru: Ambil daftar sesi ujian berdasarkan kelas
export const fetchExamSessions = async (grade) => {
  try {
    const res = await fetch(`/api/exam?grade=${encodeURIComponent(grade || '')}`, { credentials: 'same-origin' });
    return await res.json();
  } catch (err) {
    console.error('fetchExamSessions error:', err);
    return { success: false, message: String(err) };
  }
};

// Guru: Ambil detail 1 sesi ujian + daftar siswa & nilai
export const fetchExamSessionDetail = async (sessionId) => {
  try {
    const res = await fetch(`/api/exam?sessionId=${encodeURIComponent(sessionId)}`, { credentials: 'same-origin' });
    return await res.json();
  } catch (err) {
    console.error('fetchExamSessionDetail error:', err);
    return { success: false, message: String(err) };
  }
};

// Guru: Simpan sesi ujian + nilai
export const saveExamSession = async (sessionData, grades) => {
  try {
    const res = await fetch('/api/exam', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_session', session: sessionData, grades }),
    });
    return await res.json();
  } catch (err) {
    console.error('saveExamSession error:', err);
    return { success: false, message: String(err) };
  }
};

// Guru: Ubah status publikasi
export const toggleExamPublish = async (sessionId, isPublished) => {
  try {
    const res = await fetch('/api/exam', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_publish', sessionId, isPublished }),
    });
    return await res.json();
  } catch (err) {
    console.error('toggleExamPublish error:', err);
    return { success: false, message: String(err) };
  }
};

// Guru: Hapus sesi ujian
export const deleteExamSession = async (sessionId) => {
  try {
    const res = await fetch('/api/exam', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_session', sessionId }),
    });
    return await res.json();
  } catch (err) {
    console.error('deleteExamSession error:', err);
    return { success: false, message: String(err) };
  }
};

// Orang Tua: Layanan Portal Wali Murid
export const lookupParentStudent = async ({ q, studentId, action, kelas, authCode }) => {
  try {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (kelas) params.set('kelas', kelas);
    if (studentId) params.set('studentId', studentId);
    if (authCode) params.set('authCode', authCode);
    if (q) params.set('q', q);
    const res = await fetch(`/api/parent/lookup?${params.toString()}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.warn('lookupParentStudent non-JSON response:', text.slice(0, 100));
      return {
        success: false,
        message: 'Endpoint API lokal belum terhubung. Pastikan dev server telah di-restart agar proxy Vite aktif.',
      };
    }
    return await res.json();
  } catch (err) {
    console.error('lookupParentStudent error:', err);
    return { success: false, message: String(err) };
  }
};

// ==================== Presensi / Absensi Guru ====================

export const getAttendanceToday = async (teacherId) => {
  try {
    const p = teacherId ? `?action=today&teacherId=${encodeURIComponent(teacherId)}` : '?action=today';
    const res = await fetch(`/api/attendance${p}`);
    return await res.json();
  } catch (err) {
    console.error('getAttendanceToday error:', err);
    return { success: false, error: err.message };
  }
};

export const getAttendanceRecap = async ({ month, teacherId, startDate, endDate } = {}) => {
  try {
    const params = new URLSearchParams({ action: 'recap' });
    if (startDate && endDate) {
      params.set('startDate', startDate);
      params.set('endDate', endDate);
    } else if (month) {
      params.set('month', month);
    }
    if (teacherId && teacherId !== 'ALL') {
      params.set('teacherId', teacherId);
    }
    const res = await fetch(`/api/attendance?${params.toString()}`);
    return await res.json();
  } catch (err) {
    console.error('getAttendanceRecap error:', err);
    return { success: false, error: err.message, attendances: [] };
  }
};

export const getAttendanceSettings = async () => {
  try {
    const res = await fetch('/api/attendance?action=settings');
    return await res.json();
  } catch (err) {
    console.error('getAttendanceSettings error:', err);
    return { success: false, error: err.message };
  }
};

export const getAttendanceTeachers = async () => {
  try {
    const res = await fetch('/api/attendance?action=teachers');
    return await res.json();
  } catch (err) {
    console.error('getAttendanceTeachers error:', err);
    return { success: false, error: err.message };
  }
};

export const submitAttendance = async (data) => {
  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err) {
    console.error('submitAttendance error:', err);
    return { success: false, error: err.message };
  }
};

export const updateAttendanceSettings = async (settings) => {
  try {
    const res = await fetch('/api/attendance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return await res.json();
  } catch (err) {
    console.error('updateAttendanceSettings error:', err);
    return { success: false, error: err.message };
  }
};

// ==================== MASTER GURU ABSENSI ====================
export const getAttendanceMembers = async () => {
  try {
    const res = await fetch('/api/attendance?action=members');
    return await res.json();
  } catch (err) {
    console.error('getAttendanceMembers error:', err);
    return { success: false, error: err.message, members: [] };
  }
};

export const addAttendanceMember = async (data) => {
  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_member', ...data }),
    });
    return await res.json();
  } catch (err) {
    console.error('addAttendanceMember error:', err);
    return { success: false, error: err.message };
  }
};

export const updateAttendanceMember = async (data) => {
  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_member', ...data }),
    });
    return await res.json();
  } catch (err) {
    console.error('updateAttendanceMember error:', err);
    return { success: false, error: err.message };
  }
};

export const deleteAttendanceMember = async (id) => {
  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_member', id }),
    });
    return await res.json();
  } catch (err) {
    console.error('deleteAttendanceMember error:', err);
    return { success: false, error: err.message };
  }
};

// ==================== ADMIN KOREKSI, RESET & INPUT MANUAL PRESENSI ====================
export const adminAddAttendanceRecord = async (data) => {
  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_add_record', ...data }),
    });
    return await res.json();
  } catch (err) {
    console.error('adminAddAttendanceRecord error:', err);
    return { success: false, error: err.message };
  }
};

export const adminUpdateAttendanceRecord = async (data) => {
  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_update_record', ...data }),
    });
    return await res.json();
  } catch (err) {
    console.error('adminUpdateAttendanceRecord error:', err);
    return { success: false, error: err.message };
  }
};

export const adminResetAttendanceRecord = async (item) => {
  try {
    const payload = typeof item === 'string' ? { id: item } : { id: item.id, item };
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_reset_record', ...payload }),
    });
    return await res.json();
  } catch (err) {
    console.error('adminResetAttendanceRecord error:', err);
    return { success: false, error: err.message };
  }
};

export const adminDeleteAttendanceRecords = async (items) => {
  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'admin_delete_records', items }),
    });
    return await res.json();
  } catch (err) {
    console.error('adminDeleteAttendanceRecords error:', err);
    return { success: false, error: err.message };
  }
};

// ==================== MANAJEMEN USER & RBAC ====================

const safeJsonParse = async (res) => {
  try {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: 'Respons server tidak berformat JSON valid.' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getAuthUsers = async () => {
  try {
    const res = await fetch('/api/auth/users');
    const data = await safeJsonParse(res);
    if (!data.users) data.users = [];
    return data;
  } catch (err) {
    console.error('getAuthUsers error:', err);
    return { success: false, error: err.message, users: [] };
  }
};

export const addAuthUser = async (data) => {
  try {
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_user', ...data }),
    });
    return await safeJsonParse(res);
  } catch (err) {
    console.error('addAuthUser error:', err);
    return { success: false, error: err.message };
  }
};

export const updateAuthUser = async (data) => {
  try {
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_user', ...data }),
    });
    return await safeJsonParse(res);
  } catch (err) {
    console.error('updateAuthUser error:', err);
    return { success: false, error: err.message };
  }
};

export const deleteAuthUser = async (id) => {
  try {
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_user', id }),
    });
    return await safeJsonParse(res);
  } catch (err) {
    console.error('deleteAuthUser error:', err);
    return { success: false, error: err.message };
  }
};




