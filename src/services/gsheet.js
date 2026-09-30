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
