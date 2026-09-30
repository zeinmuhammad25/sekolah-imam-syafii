// Konfigurasi tabel D1 — satu sumber kebenaran dipakai oleh:
//   - functions/api/data.js  (baca)
//   - functions/api/row.js   (tulis: add/update/delete/reorder/dst)
//   - scripts/migrate/*.mjs  (migrasi data dari Google Sheets)
//
// `fields`: pasangan [namaField_JSON, kolom_D1]. Nama JSON dipertahankan SAMA
// PERSIS dengan header sheet asli (termasuk camelCase seperti `studentId`,
// `folderId`) supaya frontend (src/services/gsheet.js dst) tidak perlu diubah.
//
// `orderCol`: kolom dipakai untuk ORDER BY saat membaca daftar. 'rowid' berarti
// urutan alami SQLite (= urutan insert, setara urutan baris di Sheets). Baris baru
// otomatis ditaruh paling akhir (MAX+1), dalam lingkup `orderScope` kalau ada
// (mis. soal: urutan dihitung per folder, bukan global).
//
// `unique`: penjagaan duplikat saat TAMBAH yang dicek atomik di database (bukan
// cuma di browser) -- supaya 2 guru yang menambah data sama di detik yang sama
// tidak menghasilkan 2 baris kembar. Perbandingan tanpa beda huruf besar/kecil & spasi tepi.

const S = (json, col) => [json, col];

export const TABLES = {
  Gallery: {
    table: 'gallery', orderCol: 'position',
    fields: [S('id', 'id'), S('title', 'title'), S('category', 'category'), S('image_url', 'image_url'), S('updatedAt', 'updated_at')],
  },
  Teachers: {
    table: 'teachers', orderCol: 'position',
    fields: [S('id', 'id'), S('name', 'name'), S('role', 'role'), S('photo_url', 'photo_url'), S('gender', 'gender'), S('updatedAt', 'updated_at')],
  },
  News: {
    table: 'news', orderCol: 'position', idSuffix: '-News',
    fields: [S('id', 'id'), S('title', 'title'), S('summary', 'summary'), S('image_url', 'image_url'), S('date', 'date'), S('description', 'description'), S('updatedAt', 'updated_at')],
  },
  Videos: {
    table: 'videos', orderCol: 'order_num',
    fields: [S('id', 'id'), S('title', 'title'), S('youtube_url', 'youtube_url'), S('order', 'order_num'), S('updatedAt', 'updated_at')],
  },
  Students: {
    table: 'students', orderCol: 'rowid',
    unique: { cols: ['nama_siswa'], message: 'Nama siswa sudah terdaftar (mungkin baru saja ditambahkan guru lain).' },
    fields: [
      S('id', 'id'), S('nama_siswa', 'nama_siswa'), S('nik_siswa', 'nik_siswa'), S('nisn', 'nisn'),
      S('jenis_kelamin', 'jenis_kelamin'), S('tempat_lahir', 'tempat_lahir'), S('tanggal_lahir', 'tanggal_lahir'),
      S('agama', 'agama'), S('anak_ke', 'anak_ke'), S('no_kk', 'no_kk'), S('alamat', 'alamat'),
      S('kelurahan', 'kelurahan'), S('kecamatan', 'kecamatan'), S('kabupaten', 'kabupaten'), S('provinsi', 'provinsi'),
      S('kode_pos', 'kode_pos'), S('nama_ayah', 'nama_ayah'), S('nik_ayah', 'nik_ayah'), S('pekerjaan_ayah', 'pekerjaan_ayah'),
      S('pendidikan_ayah', 'pendidikan_ayah'), S('nama_ibu', 'nama_ibu'), S('nik_ibu', 'nik_ibu'), S('pekerjaan_ibu', 'pekerjaan_ibu'),
      S('pendidikan_ibu', 'pendidikan_ibu'), S('nama_wali', 'nama_wali'), S('pekerjaan_wali', 'pekerjaan_wali'),
      S('alamat_wali', 'alamat_wali'), S('pendidikan_sebelumnya', 'pendidikan_sebelumnya'), S('no_hp_ortu', 'no_hp_ortu'),
      S('kelas', 'kelas'), S('tahun_ajaran_masuk', 'tahun_ajaran_masuk'), S('status', 'status'), S('foto_kk', 'foto_kk'),
      S('updatedAt', 'updated_at'),
    ],
  },
  QuestionFolders: {
    table: 'question_folders', orderCol: 'rowid',
    unique: { cols: ['grade', 'name'], message: 'Folder dengan nama yang sama sudah ada di kelas ini (mungkin baru saja dibuat guru lain).' },
    fields: [S('id', 'id'), S('grade', 'grade'), S('name', 'name'), S('updatedAt', 'updated_at')],
  },
  Questions: {
    table: 'questions', orderCol: 'order_num', orderScope: 'folder_id',
    fields: [
      S('id', 'id'), S('folderId', 'folder_id'), S('text', 'text'),
      S('optionA', 'option_a'), S('optionB', 'option_b'), S('optionC', 'option_c'), S('optionD', 'option_d'),
      S('correctAnswer', 'correct_answer'), S('type', 'type'), S('order', 'order_num'), S('updatedAt', 'updated_at'),
    ],
  },
  ReportPeriods: {
    table: 'report_periods', orderCol: 'rowid',
    unique: { cols: ['studentId', 'tahunAjaran', 'semester'], message: 'Data semester ini untuk siswa tersebut sudah ada (mungkin baru saja dibuat guru lain).' },
    fields: [
      S('id', 'id'), S('studentId', 'student_id'), S('kelas', 'kelas'), S('tahunAjaran', 'tahun_ajaran'), S('semester', 'semester'),
      S('kehadiranSakit', 'kehadiran_sakit'), S('kehadiranIzin', 'kehadiran_izin'), S('kehadiranAlpa', 'kehadiran_alpa'),
      S('tempatRapor', 'tempat_rapor'), S('tanggalRapor', 'tanggal_rapor'), S('tanggalIdentitas', 'tanggal_identitas'),
      S('namaWaliKelas', 'nama_wali_kelas'), S('peringkat', 'peringkat'), S('catatanWaliKelas', 'catatan_wali_kelas'),
      S('updatedAt', 'updated_at'),
    ],
  },
  ReportGrades: {
    table: 'report_grades', orderCol: 'rowid',
    fields: [
      S('id', 'id'), S('reportPeriodId', 'report_period_id'), S('kelompok', 'kelompok'), S('induk', 'induk'),
      S('mataPelajaran', 'mata_pelajaran'), S('nilaiAngka', 'nilai_angka'), S('deskripsiCapaian', 'deskripsi_capaian'),
      S('capaianBimbingan', 'capaian_bimbingan'), S('updatedAt', 'updated_at'),
    ],
  },
  ReportAspects: {
    table: 'report_aspects', orderCol: 'rowid',
    fields: [S('id', 'id'), S('reportPeriodId', 'report_period_id'), S('kelompok', 'kelompok'), S('aspek', 'aspek'), S('deskripsi', 'deskripsi'), S('updatedAt', 'updated_at')],
  },
  ReportExtras: {
    table: 'report_extras', orderCol: 'rowid',
    fields: [S('id', 'id'), S('reportPeriodId', 'report_period_id'), S('nama', 'nama'), S('predikat', 'predikat'), S('keterangan', 'keterangan'), S('updatedAt', 'updated_at')],
  },
};

// Tabel yang cuma dibaca (tidak lewat generic ROW CRUD) — sama seperti di Code.gs,
// Settings/Announcements/PPDB tidak ada di `allowed` map handleRow.
export const READONLY_TABLES = {
  Settings: { table: 'settings', fields: [S('key', 'key'), S('value', 'value')], orderCol: 'rowid' },
  Announcements: { table: 'announcements', fields: [S('id', 'id'), S('text', 'text'), S('active', 'active'), S('updatedAt', 'updated_at')], orderCol: 'position' },
};

export const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];

export const rowToJson = (cfg, row) => {
  const o = {};
  cfg.fields.forEach(([json, col]) => { o[json] = row[col]; });
  return o;
};

export const jsonToRow = (cfg, obj) => {
  const o = {};
  cfg.fields.forEach(([json, col]) => { if (json in obj) o[col] = obj[json]; });
  return o;
};
