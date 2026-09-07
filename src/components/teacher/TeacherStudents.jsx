import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  Plus, Pencil, Trash2, Eye, ArrowUpCircle, LogOut, Search, Download, Loader2, AlertTriangle, FolderOpen,
  FileSpreadsheet, UploadCloud, CheckCircle2, XCircle, FileDown,
} from 'lucide-react';
import { fetchSchoolData, mutateRow, moveKKFile, formatSheetDate, formatSheetDateDMY } from '../../services/gsheet';
import { Modal, ModalFooter, ConfirmDialog, Thumb, Field } from './ModalKit';

// Taksonomi kelas — "Tamat" mengikuti SD 6, dipakai sebagai tab tersendiri untuk siswa yang sudah lulus.
const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6', 'Tamat'];
const STATUS_OPTIONS = ['Aktif', 'Lulus', 'Pindah', 'Keluar'];
const PENDIDIKAN_OPTIONS = ['SD', 'SMP', 'SMA/SMK', 'D3', 'S1', 'S2', 'S3'];

// Folder Drive arsip foto/scan KK per jenjang — TU upload manual di sini, lalu tempel link filenya ke field foto_kk.
const KK_FOLDER_LINKS = {
  'TK': 'https://drive.google.com/drive/u/3/folders/1DvDAdzVu_z_po-nnRJ0KD0UXZxTJ6m07',
  'SD 1': 'https://drive.google.com/drive/u/3/folders/1-zv7JDHkppTKZZs0DCMiTD71-hgos7vf',
  'SD 2': 'https://drive.google.com/drive/u/3/folders/1aigpGFKtmXSQavmE2dnbvqDDIqmAIsXN',
  'SD 3': 'https://drive.google.com/drive/u/3/folders/1h6bIr52Flx2PoB9GzxYOaU644SgOj8tc',
  'SD 4': 'https://drive.google.com/drive/u/3/folders/1vLfNDjEpTyDwwYeQS0jucrVyY00xweVW',
  'SD 5': 'https://drive.google.com/drive/u/3/folders/1n2SL9wvBUvKjvb0KOiO71_Z-dfE6TQEz',
  'SD 6': 'https://drive.google.com/drive/u/3/folders/1Ckcd77L37gOKUthGez0On1yEihCZMCii',
  'Tamat': 'https://drive.google.com/drive/u/3/folders/1b_n7DGfxnO_nHfIY0elJjk8HL7m9g37r',
};
const kkFolderLinkFor = (kelas) => KK_FOLDER_LINKS[kelas] || null;

// Kelas berikutnya dalam urutan TK→SD1→...→SD6→Tamat. null kalau sudah di tahap akhir / kelas tak dikenal.
const nextGradeOf = (kelas) => {
  const idx = GRADES.indexOf(kelas);
  if (idx === -1 || idx >= GRADES.length - 1) return null;
  return GRADES[idx + 1];
};

// Terima link "share" Drive biasa (.../file/d/FILEID/view) atau lh3.googleusercontent.com -> URL yang bisa dipakai <img>.
const driveThumbUrl = (url) => {
  const s = (url || '').trim();
  if (!s) return '';
  if (s.includes('googleusercontent.com')) return s.includes('=s') ? s.replace(/=s\d+/, '=s200') : s + '=s200';
  if (s.includes('drive.google.com')) {
    const id = s.match(/[-\w]{25,}/);
    if (id) return `https://lh3.googleusercontent.com/u/0/d/${id[0]}=s200`;
  }
  return s;
};

// ---------- Import dari Excel/CSV ----------

// Excel (cellDates:true) kasih objek Date UTC-midnight; teks lain dicoba format YYYY-MM-DD / DD/MM/YYYY / DD-MM-YYYY.
const excelDateToISO = (value) => {
  if (value instanceof Date && !isNaN(value)) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null; // gagal dikenali
};

const normalizeGender = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '';
  if (['l', 'laki-laki', 'laki laki', 'lakilaki', 'pria'].includes(s)) return 'Laki-laki';
  if (['p', 'perempuan', 'wanita'].includes(s)) return 'Perempuan';
  return null;
};

const normalizeEnum = (v, options) => {
  const s = String(v || '').trim();
  if (!s) return '';
  const found = options.find((o) => o.toLowerCase() === s.toLowerCase());
  return found || null;
};

// ---------- CSV aman untuk Excel (cegah notasi ilmiah pada angka panjang & auto-parse tanggal) ----------

// Kolom "angka panjang" yang harus tetap teks di Excel (NIK/NISN/No.KK jadi 1.27E+15 & hilang digit kalau tidak dipaksa).
const CSV_FORCE_TEXT_FIELDS = new Set([
  'nik_siswa', 'nisn', 'no_kk', 'nik_ayah', 'nik_ibu', 'no_hp_ortu', 'kode_pos', 'tahun_ajaran_masuk',
]);

const csvEscapePlain = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
// ="..." memaksa Excel membaca sel sebagai teks literal, bukan angka/tanggal yang diformat ulang sendiri.
const csvEscapeAsText = (v) => `="${String(v ?? '').replace(/"/g, '""')}"`;

const csvCell = (fieldName, value) => (
  (CSV_FORCE_TEXT_FIELDS.has(fieldName) || fieldName === 'tanggal_lahir') ? csvEscapeAsText(value) : csvEscapePlain(value)
);

// Field data siswa, dikelompokkan per section sesuai isi Kartu Keluarga + kebutuhan sekolah.
const SECTIONS = [
  {
    title: 'Identitas Siswa',
    fields: [
      { name: 'nama_siswa', label: 'Nama Lengkap Siswa', type: 'text', required: true },
      { name: 'nik_siswa', label: 'NIK Siswa', type: 'text', required: true, numeric: true, maxLength: 16, placeholder: '16 digit angka' },
      { name: 'nisn', label: 'NISN', type: 'text', required: true, numeric: true, maxLength: 10, placeholder: '10 digit angka' },
      { name: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', required: true, options: ['Laki-laki', 'Perempuan'] },
      { name: 'tempat_lahir', label: 'Tempat Lahir', type: 'text', required: true },
      { name: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date', required: true },
      { name: 'agama', label: 'Agama', type: 'text', locked: true, lockedValue: 'Islam' },
      { name: 'anak_ke', label: 'Anak ke-', type: 'text' },
    ],
  },
  {
    title: 'Alamat (sesuai KK)',
    fields: [
      { name: 'no_kk', label: 'No. Kartu Keluarga', type: 'text', required: true, numeric: true, maxLength: 16, placeholder: '16 digit angka' },
      { name: 'alamat', label: 'Alamat / Dusun', type: 'text' },
      { name: 'kelurahan', label: 'Desa/Kelurahan', type: 'text' },
      { name: 'kecamatan', label: 'Kecamatan', type: 'text' },
      { name: 'kabupaten', label: 'Kabupaten/Kota', type: 'text' },
      { name: 'provinsi', label: 'Provinsi', type: 'text' },
      { name: 'kode_pos', label: 'Kode Pos', type: 'text' },
    ],
  },
  {
    title: 'Data Orang Tua / Wali',
    fields: [
      { name: 'nama_ayah', label: 'Nama Ayah', type: 'text' },
      { name: 'nik_ayah', label: 'NIK Ayah', type: 'text' },
      { name: 'pekerjaan_ayah', label: 'Pekerjaan Ayah', type: 'text' },
      { name: 'pendidikan_ayah', label: 'Pendidikan Ayah', type: 'select', allowCustom: true, options: PENDIDIKAN_OPTIONS },
      { name: 'nama_ibu', label: 'Nama Ibu', type: 'text' },
      { name: 'nik_ibu', label: 'NIK Ibu', type: 'text' },
      { name: 'pekerjaan_ibu', label: 'Pekerjaan Ibu', type: 'text' },
      { name: 'pendidikan_ibu', label: 'Pendidikan Ibu', type: 'select', allowCustom: true, options: PENDIDIKAN_OPTIONS },
      { name: 'no_hp_ortu', label: 'No. HP/WA Orang Tua', type: 'text', required: true },
    ],
  },
  {
    title: 'Data Sekolah',
    fields: [
      { name: 'kelas', label: 'Kelas/Jenjang', type: 'select', required: true, allowCustom: true, options: GRADES },
      { name: 'tahun_ajaran_masuk', label: 'Tahun Ajaran Masuk', type: 'text', placeholder: 'mis. 2026/2027' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTIONS },
    ],
  },
  {
    title: 'Dokumen',
    fields: [
      { name: 'foto_kk', label: 'Link File Foto/Scan KK (opsional)', type: 'text', placeholder: 'Link file-nya, bukan link folder — ambil dari dalam folder di bawah' },
    ],
  },
];
const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
const emptyForm = () => ({ ...Object.fromEntries(ALL_FIELDS.map((f) => [f.name, ''])), agama: 'Islam' });

// Validasi format nomor identitas: NIK/No. KK 16 digit, NISN 10 digit, cuma angka.
const FORMAT_RULES = {
  nik_siswa: { regex: /^\d{16}$/, message: 'NIK harus tepat 16 angka' },
  nisn: { regex: /^\d{10}$/, message: 'NISN harus tepat 10 angka' },
  no_kk: { regex: /^\d{16}$/, message: 'No. Kartu Keluarga harus tepat 16 angka' },
};
const validateStudentForm = (form) => {
  for (const f of ALL_FIELDS) {
    if (f.required && !String(form[f.name] || '').trim()) return `"${f.label}" wajib diisi`;
  }
  for (const [name, rule] of Object.entries(FORMAT_RULES)) {
    const v = String(form[name] || '').trim();
    if (v && !rule.regex.test(v)) return rule.message;
  }
  return null;
};

// Kolom yang dipakai untuk import massal — semua field kecuali foto_kk (upload) & agama (dikunci ke Islam, bukan dari file).
const IMPORT_FIELDS = ALL_FIELDS.filter((f) => f.name !== 'foto_kk' && f.name !== 'agama');
const IMPORT_REQUIRED = IMPORT_FIELDS.filter((f) => f.required);

// Baris contoh di template — nama sengaja ditandai jelas biar tidak ke-import diam-diam kalau lupa dihapus/diganti.
const IMPORT_SAMPLE = {
  nama_siswa: 'Ahmad Fauzi (CONTOH - HAPUS BARIS INI)',
  nik_siswa: '1271051705180001',
  nisn: '0123456789',
  jenis_kelamin: 'Laki-laki',
  tempat_lahir: 'Medan',
  tanggal_lahir: '2018-05-17',
  agama: 'Islam',
  anak_ke: '1',
  no_kk: '1271050101200001',
  alamat: 'Jl. Contoh No. 12',
  kelurahan: 'Tanjung Rejo',
  kecamatan: 'Percut Sei Tuan',
  kabupaten: 'Deli Serdang',
  provinsi: 'Sumatera Utara',
  kode_pos: '20371',
  nama_ayah: 'Budi Santoso',
  nik_ayah: '1271050101198001',
  pekerjaan_ayah: 'Wiraswasta',
  pendidikan_ayah: 'SMA/SMK',
  nama_ibu: 'Siti Aminah',
  nik_ibu: '1271050101198501',
  pekerjaan_ibu: 'Ibu Rumah Tangga',
  pendidikan_ibu: 'SMA/SMK',
  no_hp_ortu: '081234567890',
  kelas: 'SD 1',
  tahun_ajaran_masuk: '2026/2027',
  status: 'Aktif',
};

export default function TeacherStudents() {
  const [items, setItems] = useState(null); // null = loading
  const [query, setQuery] = useState('');
  const [activeGrade, setActiveGrade] = useState('TK');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [editing, setEditing] = useState(null); // {form, id|null}
  const [previewing, setPreviewing] = useState(null); // item yang di-preview (read-only)
  const [expanded, setExpanded] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingPromote, setConfirmingPromote] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ---- Mode edit di halaman list: Edit-field & Hapus ditahan sampai Simpan; Naik Kelas & Pindah langsung jalan ----
  const [listEditMode, setListEditMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState([]); // dicentang, kandidat Naik Kelas / Pindah
  const [stagedEdits, setStagedEdits] = useState({}); // { [id]: {...field yang diubah} }
  const [stagedDeleteIds, setStagedDeleteIds] = useState([]);
  const [confirmingListSave, setConfirmingListSave] = useState(false);
  const [confirmingListCancel, setConfirmingListCancel] = useState(false);
  const [listSaving, setListSaving] = useState(false);
  const [confirmingBulkPromote, setConfirmingBulkPromote] = useState(false);
  const [confirmingBulkPindah, setConfirmingBulkPindah] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // ---- Import Excel/CSV ----
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState('upload'); // upload | preview | result
  const [importFileError, setImportFileError] = useState('');
  const [importRows, setImportRows] = useState([]); // {_key, rowNum, mapped, errors[]}
  const [importDragOver, setImportDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState([]); // {nama, success, error}

  // ---- Export CSV: filter kelas/status/kolom sebelum download ----
  const [exportOpen, setExportOpen] = useState(false);
  const [exportExpanded, setExportExpanded] = useState(false);
  const [exportGrades, setExportGrades] = useState(() => [...GRADES]);
  const [exportStatuses, setExportStatuses] = useState(() => [...STATUS_OPTIONS]);
  const [exportFields, setExportFields] = useState(() => ALL_FIELDS.map((f) => f.name));

  const load = () => fetchSchoolData().then((d) => setItems((d && d.Students) || []));
  useEffect(() => { load(); }, []);

  // Update state lokal langsung dari hasil mutateRow, tanpa reload seluruh spreadsheet (jauh lebih cepat).
  const patchItemLocal = (id, fields) => setItems((prev) => (prev || []).map((s) => (String(s.id) === String(id) ? { ...s, ...fields } : s)));
  const removeItemLocal = (id) => setItems((prev) => (prev || []).filter((s) => String(s.id) !== String(id)));
  const addItemLocal = (item) => setItems((prev) => [...(prev || []), item]);

  const hasStagedChanges = Object.keys(stagedEdits).length > 0 || stagedDeleteIds.length > 0;

  // Peringatan browser kalau tab ditutup/refresh saat masih ada perubahan yang belum diklik "Simpan".
  useEffect(() => {
    if (!listEditMode || !hasStagedChanges) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [listEditMode, hasStagedChanges]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((s) => {
      if (s.kelas !== activeGrade) return false;
      if (filterStatus !== 'Semua' && (s.status || 'Aktif') !== filterStatus) return false;
      if (!q) return true;
      return [s.nama_siswa, s.nik_siswa, s.nisn, s.no_kk, s.nama_ayah, s.nama_ibu]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [items, query, activeGrade, filterStatus]);

  const exportMatchedItems = useMemo(() => {
    if (!items) return [];
    return items.filter((s) => exportGrades.includes(s.kelas) && exportStatuses.includes(s.status || 'Aktif'));
  }, [items, exportGrades, exportStatuses]);

  const toggleValue = (setter, value) => setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const openAdd = () =>{ setError(''); setExpanded(false); setEditing({ id: null, form: { ...emptyForm(), kelas: activeGrade } }); };
  const openEdit = (item) => {
    setError('');
    setExpanded(false);
    const merged = stagedEdits[item.id] ? { ...item, ...stagedEdits[item.id] } : item;
    const form = {};
    ALL_FIELDS.forEach((f) => {
      let v = merged[f.name];
      if (f.name === 'tanggal_lahir' && v) v = formatSheetDate(v); // ISO datetime -> YYYY-MM-DD supaya <input type="date"> terisi benar
      form[f.name] = v != null ? String(v) : '';
    });
    form.agama = 'Islam'; // dikunci, tidak ikut nilai lama seandainya pernah beda
    setEditing({ id: item.id, form });
  };
  const closeEditing = () => { setConfirmingCancel(false); setEditing(null); };

  const handlePromote = async () => {
    const next = nextGradeOf(editing.form.kelas);
    if (!next) return;
    setPromoting(true);
    setError('');
    const row = { kelas: next };
    if (next === 'Tamat') row.status = 'Lulus';
    const res = await mutateRow({ action: 'update', sheetName: 'Students', id: editing.id, row });
    if (!res.success) {
      setPromoting(false);
      setConfirmingPromote(false);
      setError('Gagal memindahkan tahap: ' + (res.error || 'tidak diketahui'));
      return;
    }
    const fotoUrl = (editing.form.foto_kk || '').trim();
    let photoWarning = '';
    if (fotoUrl) {
      const moveRes = await moveKKFile({ fotoKkUrl: fotoUrl, targetKelas: next });
      if (!moveRes.success) {
        photoWarning = `Kelas berhasil diubah ke ${next}, tapi foto KK gagal dipindah otomatis (${moveRes.error || 'tidak diketahui'}). Silakan pindahkan manual di Drive.`;
      }
    }
    patchItemLocal(editing.id, row);
    setPromoting(false);
    setConfirmingPromote(false);
    setEditing(null);
    if (photoWarning) window.alert(photoWarning);
  };

  const handleSave = async () => {
    setError('');
    const err = validateStudentForm(editing.form);
    if (err) { setError(err); return; }
    const formToSave = { ...editing.form, agama: 'Islam' }; // dikunci, apa pun yang terjadi di form
    // Tambah siswa baru: tetap langsung tersimpan (di luar sesi mode edit list).
    if (!editing.id) {
      setSaving(true);
      const res = await mutateRow({ action: 'add', sheetName: 'Students', row: formToSave });
      setSaving(false);
      if (!res.success) { setError('Gagal menyimpan: ' + (res.error || 'tidak diketahui')); return; }
      addItemLocal({ ...formToSave, id: res.id, updatedAt: res.updatedAt });
      setEditing(null);
      return;
    }
    // Edit siswa lama: ditahan dulu (staged) — baru benar-benar tersimpan saat klik "Simpan" di mode edit list.
    setStagedEdits((prev) => ({ ...prev, [editing.id]: { ...(prev[editing.id] || {}), ...formToSave } }));
    setEditing(null);
  };

  // ---- Checkbox + aksi massal (langsung jalan, tidak nunggu Simpan) ----
  const toggleChecked = (id) => setCheckedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  // Jalankan 1 perubahan kelas/status per id terpilih + pindahkan foto KK kalau ada. Dipakai Naik Kelas & Pindah.
  const runBulkKelasChange = async (computeRow, labelSuffix) => {
    setBulkProcessing(true);
    const results = [];
    for (const id of checkedIds) {
      const item = items.find((s) => s.id === id);
      if (!item) continue;
      const row = computeRow(item);
      if (!row) continue;
      const res = await mutateRow({ action: 'update', sheetName: 'Students', id, row });
      results.push({ label: `${item.nama_siswa || id} ${labelSuffix(row)}`, success: res.success, error: res.error });
      if (res.success) {
        patchItemLocal(id, row);
        const fotoUrl = (item.foto_kk || '').trim();
        if (fotoUrl) {
          const moveRes = await moveKKFile({ fotoKkUrl: fotoUrl, targetKelas: row.kelas });
          if (!moveRes.success) results.push({ label: `Pindah foto KK: ${item.nama_siswa || id}`, success: false, error: moveRes.error });
        }
      }
    }
    setBulkProcessing(false);
    setCheckedIds([]);
    const failed = results.filter((r) => !r.success);
    if (failed.length) {
      window.alert(`${results.length - failed.length} berhasil, ${failed.length} gagal:\n` + failed.map((f) => `- ${f.label}: ${f.error || 'tidak diketahui'}`).join('\n'));
    }
  };

  const handleBulkPromote = async () => {
    setConfirmingBulkPromote(false);
    await runBulkKelasChange(
      (item) => { const next = nextGradeOf(item.kelas); if (!next) return null; return next === 'Tamat' ? { kelas: next, status: 'Lulus' } : { kelas: next }; },
      (row) => `→ ${row.kelas}`
    );
  };

  const handleBulkPindah = async () => {
    setConfirmingBulkPindah(false);
    await runBulkKelasChange(() => ({ kelas: 'Tamat', status: 'Pindah' }), () => '→ Tamat (Pindah)');
  };

  const stageDelete = (item) => setStagedDeleteIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
  const undoStagedDelete = (id) => setStagedDeleteIds((prev) => prev.filter((v) => v !== id));

  const enterListEditMode = () => { setListEditMode(true); setCheckedIds([]); };

  const handleListCancelClick = () => {
    if (hasStagedChanges) setConfirmingListCancel(true);
    else setListEditMode(false);
  };
  const confirmListCancel = () => {
    setStagedEdits({}); setStagedDeleteIds([]); setCheckedIds([]);
    setListEditMode(false); setConfirmingListCancel(false);
  };

  const handleListSaveClick = () => {
    if (hasStagedChanges) setConfirmingListSave(true);
    else setListEditMode(false);
  };

  const commitListChanges = async () => {
    setConfirmingListSave(false);
    setListSaving(true);
    const results = [];

    for (const id of stagedDeleteIds) {
      const item = items.find((s) => String(s.id) === String(id));
      const res = await mutateRow({ action: 'delete', sheetName: 'Students', id });
      results.push({ label: `Hapus: ${item?.nama_siswa || id}`, success: res.success, error: res.error });
      if (res.success) removeItemLocal(id);
    }

    for (const [id, fields] of Object.entries(stagedEdits)) {
      if (stagedDeleteIds.some((d) => String(d) === String(id))) continue; // sudah dihapus, lewati edit-nya
      const item = items.find((s) => String(s.id) === String(id));
      const res = await mutateRow({ action: 'update', sheetName: 'Students', id, row: fields });
      results.push({ label: `Edit: ${fields.nama_siswa || item?.nama_siswa || id}`, success: res.success, error: res.error });
      if (res.success) patchItemLocal(id, fields);
    }

    setListSaving(false);
    setStagedEdits({}); setStagedDeleteIds([]);
    setListEditMode(false);

    const failed = results.filter((r) => !r.success);
    if (failed.length) {
      window.alert(`${results.length - failed.length} berhasil, ${failed.length} gagal:\n` + failed.map((f) => `- ${f.label}: ${f.error || 'tidak diketahui'}`).join('\n'));
    }
  };

  const handleExportConfirm = () => {
    const cols = ALL_FIELDS.filter((f) => exportFields.includes(f.name));
    const cellValue = (row, f) => (f.name === 'tanggal_lahir' ? formatSheetDateDMY(row[f.name]) : row[f.name]);
    const lines = [
      cols.map((f) => csvEscapePlain(f.label)).join(','),
      ...exportMatchedItems.map((row) => cols.map((f) => csvCell(f.name, cellValue(row, f))).join(',')),
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-siswa-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const downloadImportTemplate = () => {
    const headerRow = IMPORT_FIELDS.map((f) => csvEscapePlain(f.name)).join(',');
    const sampleRow = IMPORT_FIELDS.map((f) => csvCell(f.name, IMPORT_SAMPLE[f.name] || '')).join(',');
    const csv = '﻿' + headerRow + '\r\n' + sampleRow + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-import-siswa.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportStep('upload');
    setImportFileError('');
    setImportRows([]);
    setImportResults([]);
  };

  const processImportRow = (rawRow, index, existingNiks, seenNiksInFile) => {
    const errors = [];
    const mapped = {};
    IMPORT_FIELDS.forEach((f) => {
      let val = rawRow[f.name];
      if (val == null) val = '';
      if (f.name === 'tanggal_lahir') {
        if (String(val).trim() === '') { val = ''; }
        else {
          const iso = excelDateToISO(val);
          if (iso === null) { errors.push(`Format tanggal_lahir tidak dikenali: "${val}"`); val = String(val); }
          else val = iso;
        }
      } else if (f.name === 'jenis_kelamin') {
        if (String(val).trim() === '') { val = ''; }
        else {
          const norm = normalizeGender(val);
          if (norm === null) { errors.push(`jenis_kelamin tidak dikenali: "${val}" (harus Laki-laki/Perempuan)`); val = String(val); }
          else val = norm;
        }
      } else if (f.name === 'kelas') {
        if (String(val).trim() === '') { val = ''; }
        else {
          const norm = normalizeEnum(val, GRADES);
          if (norm === null) { errors.push(`kelas tidak dikenali: "${val}" (harus salah satu: ${GRADES.join(', ')})`); val = String(val); }
          else val = norm;
        }
      } else if (f.name === 'status') {
        if (String(val).trim() === '') { val = ''; }
        else {
          const norm = normalizeEnum(val, STATUS_OPTIONS);
          if (norm === null) { errors.push(`status tidak dikenali: "${val}" (harus salah satu: ${STATUS_OPTIONS.join(', ')})`); val = String(val); }
          else val = norm;
        }
      } else {
        val = String(val).trim();
      }
      mapped[f.name] = val;
    });

    IMPORT_REQUIRED.forEach((f) => {
      if (!String(mapped[f.name] || '').trim()) errors.push(`"${f.label}" wajib diisi`);
    });

    Object.entries(FORMAT_RULES).forEach(([name, rule]) => {
      const v = String(mapped[name] || '').trim();
      if (v && !rule.regex.test(v)) errors.push(rule.message);
    });

    mapped.agama = 'Islam'; // dikunci, tidak dibaca dari file

    const nik = String(mapped.nik_siswa || '').trim();
    if (nik) {
      if (existingNiks.has(nik)) errors.push('NIK sudah terdaftar di data siswa (kemungkinan duplikat)');
      if (seenNiksInFile.has(nik)) errors.push('NIK duplikat di dalam file ini');
      seenNiksInFile.add(nik);
    }

    return { _key: `row-${index}`, rowNum: index + 2, mapped, errors };
  };

  const handleImportFile = (file) => {
    if (!file) return;
    setImportFileError('');
    setImportRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (json.length === 0) { setImportFileError('File kosong atau tidak terbaca.'); return; }

        const headerKeys = Object.keys(json[0]);
        const missingCols = IMPORT_REQUIRED.filter((f) => !headerKeys.includes(f.name));
        if (missingCols.length) {
          setImportFileError(`Kolom wajib tidak ditemukan di file: ${missingCols.map((f) => f.name).join(', ')}`);
          return;
        }

        const existingNiks = new Set((items || []).map((s) => String(s.nik_siswa || '').trim()).filter(Boolean));
        const seenNiksInFile = new Set();
        const processed = json.map((row, i) => processImportRow(row, i, existingNiks, seenNiksInFile));
        setImportRows(processed);
        setImportStep('preview');
      } catch (err) {
        setImportFileError('Gagal membaca file: ' + String((err && err.message) || err));
      }
    };
    reader.onerror = () => setImportFileError('Gagal membaca file.');
    reader.readAsArrayBuffer(file);
  };

  const handleImportConfirm = async () => {
    const validRows = importRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;
    setImporting(true);
    const results = [];
    const added = [];
    for (const r of validRows) {
      const res = await mutateRow({ action: 'add', sheetName: 'Students', row: r.mapped });
      results.push({ nama: r.mapped.nama_siswa, success: res.success, error: res.error });
      if (res.success) added.push({ ...r.mapped, id: res.id, updatedAt: res.updatedAt });
    }
    setImporting(false);
    setImportResults(results);
    setImportStep('result');
    if (added.length) setItems((prev) => [...(prev || []), ...added]);
  };

  return (
    <div>
      {/* Header + aksi */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">Data Siswa (KK)</h2>
          <p className="text-slate-400 font-bold text-sm mt-1">
            {items === null ? 'Memuat…' : `${filtered.length} siswa • Kelas ${activeGrade}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!listEditMode && (
            <button
              onClick={enterListEditMode}
              disabled={!items || !items.length}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-900 hover:text-slate-900 active:scale-95 transition-all disabled:opacity-40"
            >
              <Pencil size={16} /> Edit
            </button>
          )}
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-900 hover:text-slate-900 active:scale-95 transition-all"
          >
            <FileSpreadsheet size={16} /> Import
          </button>
          <button
            onClick={() => setExportOpen(true)}
            disabled={!items || !items.length}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-900 hover:text-slate-900 active:scale-95 transition-all disabled:opacity-40"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-secondary text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:brightness-95 active:scale-95 transition-all shadow-lg shadow-secondary/20"
          >
            <Plus size={18} /> Tambah
          </button>
        </div>
      </div>

      {/* Tab kelas — TK s.d. SD 6 */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto hide-scrollbar mb-4 w-fit max-w-full">
        {GRADES.map((grade) => (
          <button
            key={grade}
            onClick={() => setActiveGrade(grade)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
              activeGrade === grade ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {grade}
          </button>
        ))}
      </div>

      {/* Cari & filter status */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-grow">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, NIK, NISN, No. KK, nama ortu…"
            className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-11 pr-4 py-3.5 font-bold text-slate-800 outline-none focus:border-secondary transition-all"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-3.5 font-bold text-slate-600 outline-none focus:border-secondary transition-all">
          <option value="Semua">Semua Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Daftar */}
      {items === null ? (
        <div className="flex justify-center py-20 text-slate-300"><Loader2 className="animate-spin" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold">
          {items.length === 0 ? 'Belum ada data. Klik "Tambah".' : `Tidak ada siswa di kelas ${activeGrade} yang cocok dengan pencarian/filter.`}
        </div>
      ) : (
        <div className={`grid gap-3 ${listEditMode ? 'pb-24' : ''}`}>
          {filtered.map((item) => {
            const isDeleted = stagedDeleteIds.some((d) => String(d) === String(item.id));
            const display = stagedEdits[item.id] ? { ...item, ...stagedEdits[item.id] } : item;
            const hasPendingEdit = !!stagedEdits[item.id];
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 bg-white rounded-2xl p-3 border shadow-sm transition-colors ${isDeleted ? 'border-rose-200 opacity-60' : 'border-slate-100'}`}
              >
                {listEditMode && !isDeleted && display.kelas !== 'Tamat' && (
                  <input
                    type="checkbox"
                    checked={checkedIds.includes(item.id)}
                    onChange={() => toggleChecked(item.id)}
                    className="w-5 h-5 accent-secondary shrink-0"
                  />
                )}
                <Thumb src={driveThumbUrl(display.foto_kk)} />
                <div className="min-w-0 flex-grow">
                  <p className={`font-black text-slate-900 truncate flex items-center gap-1.5 ${isDeleted ? 'line-through text-slate-400' : ''}`}>
                    {display.nama_siswa || '(tanpa nama)'}
                    {hasPendingEdit && !isDeleted && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Ada perubahan belum disimpan" />}
                  </p>
                  <p className="text-slate-400 font-bold text-xs truncate">
                    {[display.kelas, display.no_kk && `KK ${display.no_kk}`].filter(Boolean).join(' • ') || '—'}
                    {isDeleted && <span className="text-rose-500 font-black"> (akan dihapus)</span>}
                  </p>
                </div>
                {!isDeleted && (
                  <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    (display.status || 'Aktif') === 'Aktif' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {display.status || 'Aktif'}
                  </span>
                )}
                <div className="flex gap-2 shrink-0">
                  {!listEditMode && (
                    <button onClick={() => setPreviewing(item)} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-primary hover:text-white transition-all" title="Preview"><Eye size={16} /></button>
                  )}
                  {listEditMode && isDeleted && (
                    <button onClick={() => undoStagedDelete(item.id)} className="text-xs font-black text-secondary hover:underline px-2">Urungkan</button>
                  )}
                  {listEditMode && !isDeleted && (
                    <>
                      <button onClick={() => openEdit(item)} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-secondary hover:text-white transition-all" title="Edit"><Pencil size={16} /></button>
                      <button onClick={() => stageDelete(item)} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-500 hover:text-white transition-all" title="Hapus"><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bar mode edit (mengambang bawah) */}
      <AnimatePresence>
        {listEditMode && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 bg-slate-900 text-white pl-4 pr-2 py-2 rounded-full shadow-2xl flex-wrap justify-center max-w-[95vw]"
          >
            <span className="text-xs font-bold text-slate-300 px-1 hidden sm:inline">
              {checkedIds.length > 0 ? `${checkedIds.length} dipilih` : 'Mode edit'}
            </span>
            <button
              onClick={() => setConfirmingBulkPromote(true)}
              disabled={checkedIds.length === 0 || bulkProcessing}
              className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2.5 rounded-full font-black text-xs uppercase tracking-wider hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowUpCircle size={14} /> Naik Kelas
            </button>
            <button
              onClick={() => setConfirmingBulkPindah(true)}
              disabled={checkedIds.length === 0 || bulkProcessing}
              className="inline-flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2.5 rounded-full font-black text-xs uppercase tracking-wider hover:bg-amber-500 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <LogOut size={14} /> Pindah
            </button>
            <button onClick={handleListCancelClick} disabled={listSaving} className="bg-white/10 text-white px-4 py-2.5 rounded-full font-black text-xs uppercase tracking-wider hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50">
              Batal
            </button>
            <button
              onClick={handleListSaveClick}
              disabled={listSaving}
              className="bg-white text-slate-900 px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-wider hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {listSaving ? <><Loader2 className="animate-spin" size={14} /> Menyimpan…</> : 'Simpan'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form modal (tambah / edit) — tidak bisa ditutup klik area luar, cuma via X / Simpan / Batal */}
      <AnimatePresence>
        {editing && (
          <Modal
            onClose={() => !saving && !promoting && setEditing(null)}
            title={`${editing.id ? 'Edit' : 'Tambah'} Data Siswa`}
            maxWidthClass="max-w-2xl"
            expandedWidthClass="max-w-6xl"
            expanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)}
            closeOnBackdrop={false}
          >
            <div className="px-6 md:px-8 py-5 space-y-5">
              {SECTIONS.map((section) => (
                <div key={section.title}>
                  <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em] mb-2">{section.title}</h4>
                  {section.title === 'Data Sekolah' && editing.id && editing.form.kelas === 'SD 6' && (
                    <button
                      type="button"
                      onClick={() => setConfirmingPromote(true)}
                      disabled={promoting}
                      className="mb-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-black text-xs uppercase tracking-wider hover:bg-emerald-100 transition-all disabled:opacity-50"
                    >
                      <ArrowUpCircle size={16} /> Pindahkan ke Alumni
                    </button>
                  )}
                  {section.title === 'Dokumen' && kkFolderLinkFor(editing.form.kelas) && (
                    <div className="mb-3 bg-secondary/5 border border-secondary/20 rounded-xl p-3">
                      <p className="text-xs font-bold text-slate-600 mb-2">
                        1) Buka folder → upload/cari file KK siswa ini → salin link file-nya (bukan link folder) → tempel di kolom bawah.
                      </p>
                      <a
                        href={kkFolderLinkFor(editing.form.kelas)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-black text-secondary hover:underline"
                      >
                        <FolderOpen size={14} /> Buka Folder KK {editing.form.kelas}
                      </a>
                    </div>
                  )}
                  <div className={`grid sm:grid-cols-2 ${expanded ? 'lg:grid-cols-3' : ''} gap-3`}>
                    {section.fields.map((f) => (
                      <div key={f.name}>
                        <Field
                          field={f}
                          value={editing.form[f.name]}
                          dense
                          onChange={(v) => setEditing((e) => ({ ...e, form: { ...e.form, [f.name]: v } }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {error && <div className="flex items-center gap-2 text-rose-500 font-bold text-sm bg-rose-50 rounded-xl p-3"><AlertTriangle size={16} /> {error}</div>}
            </div>
            <ModalFooter>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingCancel(true)}
                  disabled={saving}
                  className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black text-sm hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <><Loader2 className="animate-spin" size={18} /> Menyimpan…</> : 'Simpan'}
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Konfirmasi batal — "Tidak" kembali ke popup, "Ya" kembali ke halaman list */}
      <AnimatePresence>
        {confirmingCancel && (
          <ConfirmDialog
            title="Batalkan pengisian?"
            message="Data yang sudah diisi belum tersimpan dan akan hilang. Yakin mau kembali ke daftar siswa?"
            confirmLabel="Ya, Batalkan"
            loading={false}
            onCancel={() => setConfirmingCancel(false)}
            onConfirm={closeEditing}
          />
        )}
      </AnimatePresence>

      {/* Konfirmasi pindah tahap */}
      <AnimatePresence>
        {confirmingPromote && editing && (
          <ConfirmDialog
            title="Luluskan siswa ini?"
            message={
              <>
                Pindahkan <b className="text-slate-800">{editing.form.nama_siswa || 'siswa ini'}</b> dari{' '}
                <b className="text-slate-800">SD 6</b> ke <b className="text-slate-800">Alumni (Tamat)</b>, status jadi{' '}
                <b className="text-slate-800">Lulus</b>?
                {editing.form.foto_kk && <> Foto KK juga akan dipindah otomatis ke folder <b className="text-slate-800">Tamat</b>.</>}
              </>
            }
            confirmLabel="Ya, Luluskan"
            loading={promoting}
            onCancel={() => !promoting && setConfirmingPromote(false)}
            onConfirm={handlePromote}
          />
        )}
      </AnimatePresence>

      {/* Konfirmasi Simpan mode edit list */}
      <AnimatePresence>
        {confirmingListSave && (
          <ConfirmDialog
            title="Simpan semua perubahan?"
            message={
              <>
                <b className="text-slate-800">{Object.keys(stagedEdits).length}</b> diedit, <b className="text-slate-800">{stagedDeleteIds.length}</b> dihapus. Lanjutkan simpan ke server?
              </>
            }
            confirmLabel="Ya, Simpan"
            loading={listSaving}
            onCancel={() => !listSaving && setConfirmingListSave(false)}
            onConfirm={commitListChanges}
          />
        )}
      </AnimatePresence>

      {/* Konfirmasi Batal mode edit list */}
      <AnimatePresence>
        {confirmingListCancel && (
          <ConfirmDialog
            title="Batalkan semua perubahan?"
            message="Semua edit/hapus yang belum disimpan akan hilang."
            confirmLabel="Ya, Batalkan"
            loading={false}
            onCancel={() => setConfirmingListCancel(false)}
            onConfirm={confirmListCancel}
          />
        )}
      </AnimatePresence>

      {/* Konfirmasi Naik Kelas massal (langsung jalan) */}
      <AnimatePresence>
        {confirmingBulkPromote && (
          <ConfirmDialog
            title="Naikkan kelas siswa terpilih?"
            message={<><b className="text-slate-800">{checkedIds.length}</b> siswa akan langsung naik ke kelas berikutnya. Foto KK yang terisi ikut dipindah ke folder jenjang baru.</>}
            confirmLabel="Ya, Naikkan"
            loading={bulkProcessing}
            onCancel={() => !bulkProcessing && setConfirmingBulkPromote(false)}
            onConfirm={handleBulkPromote}
          />
        )}
      </AnimatePresence>

      {/* Konfirmasi Pindah massal ke Tamat (langsung jalan) */}
      <AnimatePresence>
        {confirmingBulkPindah && (
          <ConfirmDialog
            title="Pindahkan siswa terpilih ke Tamat?"
            message={<><b className="text-slate-800">{checkedIds.length}</b> siswa akan langsung dipindah ke kelas <b className="text-slate-800">Tamat</b> dengan status <b className="text-slate-800">Pindah</b> (tanpa lewat kelas antara). Foto KK yang terisi ikut dipindah ke folder Tamat.</>}
            confirmLabel="Ya, Pindahkan"
            loading={bulkProcessing}
            onCancel={() => !bulkProcessing && setConfirmingBulkPindah(false)}
            onConfirm={handleBulkPindah}
          />
        )}
      </AnimatePresence>

      {/* Preview read-only */}
      <AnimatePresence>
        {previewing && (
          <Modal onClose={() => setPreviewing(null)} title={previewing.nama_siswa || '(tanpa nama)'} maxWidthClass="max-w-2xl">
            <div className="px-6 md:px-8 py-5 space-y-5">
              {SECTIONS.map((section) => (
                <div key={section.title}>
                  <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em] mb-2">{section.title}</h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {section.fields.map((f) => (
                      <div key={f.name} className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{f.label}</p>
                        <p className="text-sm font-bold text-slate-800 break-words">
                          {f.name === 'foto_kk' && previewing.foto_kk ? (
                            <a href={previewing.foto_kk} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">Buka file KK</a>
                          ) : f.name === 'tanggal_lahir' ? (
                            formatSheetDateDMY(previewing.tanggal_lahir) || '—'
                          ) : (previewing[f.name] || '—')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <ModalFooter>
              <div className="flex gap-3">
                <button onClick={() => setPreviewing(null)} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all">Tutup</button>
                <button
                  onClick={() => { const item = previewing; setPreviewing(null); if (!listEditMode) enterListEditMode(); openEdit(item); }}
                  className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black text-sm hover:bg-black transition-all"
                >
                  Edit
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Import Excel/CSV */}
      <AnimatePresence>
        {importOpen && (
          <Modal
            onClose={() => !importing && closeImport()}
            title="Import Data Siswa dari Excel"
            maxWidthClass="max-w-lg"
            expandedWidthClass="max-w-4xl"
            expanded={importStep === 'preview'}
            closeOnBackdrop={false}
          >
            <div className="px-6 md:px-8 py-6">
              {/* Step breadcrumb */}
              <div className="flex items-center gap-3 mb-6">
                {[{ n: 1, label: 'Upload File' }, { n: 2, label: 'Preview & Validasi' }].map((s, i) => (
                  <React.Fragment key={s.n}>
                    {i > 0 && <div className="flex-1 h-px bg-slate-200" />}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        (importStep === 'preview' || importStep === 'result') || s.n === 1 ? 'bg-secondary text-white' : 'bg-slate-100 text-slate-400'
                      }`}>{s.n}</span>
                      <span className={`text-xs font-black ${s.n === 1 ? 'text-slate-900' : (importStep !== 'upload' ? 'text-slate-900' : 'text-slate-400')}`}>{s.label}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {importStep === 'upload' && (
                <div>
                  <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 mb-5">
                    <p className="text-xs font-black text-secondary uppercase tracking-wider mb-1.5">Format file yang didukung</p>
                    <p className="text-xs font-bold text-slate-600 leading-relaxed">
                      Kolom wajib: {IMPORT_REQUIRED.map((f) => f.name).join(', ')}.
                      <br />Kolom lain opsional: {IMPORT_FIELDS.filter((f) => !f.required).map((f) => f.name).join(', ')}.
                      <br />Agama otomatis "Islam" untuk semua siswa, tidak perlu kolom terpisah.
                    </p>
                    <p className="text-xs font-bold text-amber-700 bg-amber-50 rounded-lg p-2 mt-2 leading-relaxed">
                      Penting: di Excel, format dulu kolom <b>nik_siswa</b>, <b>nisn</b>, <b>no_kk</b> sebagai <b>Text</b> sebelum mengetik angkanya — kalau tidak, Excel bisa menghilangkan angka nol di depan atau mengubahnya jadi notasi ilmiah sebelum sempat diimpor.
                    </p>
                    <button onClick={downloadImportTemplate} className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-secondary hover:underline">
                      <FileDown size={14} /> Unduh contoh template
                    </button>
                  </div>

                  <label
                    onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                    onDragLeave={() => setImportDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setImportDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImportFile(f); }}
                    className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-14 cursor-pointer transition-all ${
                      importDragOver ? 'border-secondary bg-secondary/5' : 'border-slate-200 hover:border-secondary'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                      <UploadCloud size={28} />
                    </div>
                    <span className="text-sm font-black text-slate-700">Drag & drop file CSV/Excel</span>
                    <span className="text-xs font-bold text-slate-400">atau klik untuk memilih file</span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">.csv · .xlsx · .xls</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => e.target.files[0] && handleImportFile(e.target.files[0])}
                    />
                  </label>

                  {importFileError && (
                    <div className="mt-4 flex items-center gap-2 text-rose-500 font-bold text-sm bg-rose-50 rounded-xl p-3"><AlertTriangle size={16} /> {importFileError}</div>
                  )}
                </div>
              )}

              {importStep === 'preview' && (
                <div>
                  <div className="flex items-center gap-4 mb-4 text-sm font-black">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={16} /> {importRows.filter((r) => r.errors.length === 0).length} valid</span>
                    <span className="inline-flex items-center gap-1.5 text-rose-500"><XCircle size={16} /> {importRows.filter((r) => r.errors.length > 0).length} bermasalah</span>
                  </div>
                  <div className="overflow-auto max-h-[50vh] border border-slate-100 rounded-xl">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="p-2.5 text-left font-black text-slate-400 uppercase tracking-wider">Baris</th>
                          <th className="p-2.5 text-left font-black text-slate-400 uppercase tracking-wider">Nama</th>
                          <th className="p-2.5 text-left font-black text-slate-400 uppercase tracking-wider">NIK</th>
                          <th className="p-2.5 text-left font-black text-slate-400 uppercase tracking-wider">Kelas</th>
                          <th className="p-2.5 text-left font-black text-slate-400 uppercase tracking-wider">Status Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {importRows.map((r) => (
                          <tr key={r._key} className={r.errors.length ? 'bg-rose-50/50' : ''}>
                            <td className="p-2.5 text-slate-400 font-bold">{r.rowNum}</td>
                            <td className="p-2.5 font-bold text-slate-800">{r.mapped.nama_siswa || '—'}</td>
                            <td className="p-2.5 text-slate-500">{r.mapped.nik_siswa || '—'}</td>
                            <td className="p-2.5 text-slate-500">{r.mapped.kelas || '—'}</td>
                            <td className="p-2.5">
                              {r.errors.length === 0 ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold"><CheckCircle2 size={13} /> Valid</span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-rose-500 font-bold" title={r.errors.join('; ')}>
                                  <XCircle size={13} className="shrink-0" /> {r.errors[0]}{r.errors.length > 1 ? ` (+${r.errors.length - 1} lagi)` : ''}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importStep === 'result' && (
                <div>
                  <div className="flex items-center gap-4 mb-4 text-sm font-black">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={16} /> {importResults.filter((r) => r.success).length} berhasil</span>
                    <span className="inline-flex items-center gap-1.5 text-rose-500"><XCircle size={16} /> {importResults.filter((r) => !r.success).length} gagal</span>
                  </div>
                  {importResults.filter((r) => !r.success).length > 0 && (
                    <div className="grid gap-1.5 max-h-[40vh] overflow-y-auto">
                      {importResults.filter((r) => !r.success).map((r, i) => (
                        <div key={i} className="text-xs bg-rose-50 text-rose-600 rounded-lg p-2.5 font-bold">{r.nama || '(tanpa nama)'}: {r.error || 'tidak diketahui'}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <ModalFooter>
              {importStep === 'upload' && (
                <button onClick={closeImport} className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all">Tutup</button>
              )}
              {importStep === 'preview' && (
                <div className="flex gap-3">
                  <button onClick={closeImport} disabled={importing} className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all disabled:opacity-50">Batal</button>
                  <button
                    onClick={handleImportConfirm}
                    disabled={importing || importRows.filter((r) => r.errors.length === 0).length === 0}
                    className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl font-black text-sm hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {importing ? <><Loader2 className="animate-spin" size={18} /> Mengimpor…</> : `Import ${importRows.filter((r) => r.errors.length === 0).length} Siswa`}
                  </button>
                </div>
              )}
              {importStep === 'result' && (
                <button onClick={closeImport} className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-black transition-all">Selesai</button>
              )}
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Export CSV: filter kelas/status/kolom dulu sebelum download */}
      <AnimatePresence>
        {exportOpen && (
          <Modal
            onClose={() => setExportOpen(false)}
            title="Export Data Siswa"
            maxWidthClass="max-w-lg"
            expandedWidthClass="max-w-3xl"
            expanded={exportExpanded}
            onToggleExpand={() => setExportExpanded((v) => !v)}
            closeOnBackdrop={false}
          >
            <div className="px-6 md:px-8 py-5 space-y-6">
              {/* Filter kelas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em]">Filter Kelas</h4>
                  <button
                    onClick={() => setExportGrades(exportGrades.length === GRADES.length ? [] : [...GRADES])}
                    className="text-xs font-black text-secondary hover:underline"
                  >
                    {exportGrades.length === GRADES.length ? 'Kosongkan' : 'Pilih Semua'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GRADES.map((g) => (
                    <label
                      key={g}
                      className={`px-3 py-2 rounded-xl border-2 text-xs font-black cursor-pointer transition-all ${
                        exportGrades.includes(g) ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-slate-50 border-slate-100 text-slate-400'
                      }`}
                    >
                      <input type="checkbox" className="hidden" checked={exportGrades.includes(g)} onChange={() => toggleValue(setExportGrades, g)} />
                      {g}
                    </label>
                  ))}
                </div>
              </div>

              {/* Filter status */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em]">Filter Status</h4>
                  <button
                    onClick={() => setExportStatuses(exportStatuses.length === STATUS_OPTIONS.length ? [] : [...STATUS_OPTIONS])}
                    className="text-xs font-black text-secondary hover:underline"
                  >
                    {exportStatuses.length === STATUS_OPTIONS.length ? 'Kosongkan' : 'Pilih Semua'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <label
                      key={s}
                      className={`px-3 py-2 rounded-xl border-2 text-xs font-black cursor-pointer transition-all ${
                        exportStatuses.includes(s) ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-slate-50 border-slate-100 text-slate-400'
                      }`}
                    >
                      <input type="checkbox" className="hidden" checked={exportStatuses.includes(s)} onChange={() => toggleValue(setExportStatuses, s)} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              {/* Pilih kolom */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em]">Pilih Kolom</h4>
                  <button
                    onClick={() => setExportFields(exportFields.length === ALL_FIELDS.length ? [] : ALL_FIELDS.map((f) => f.name))}
                    className="text-xs font-black text-secondary hover:underline"
                  >
                    {exportFields.length === ALL_FIELDS.length ? 'Kosongkan' : 'Pilih Semua'}
                  </button>
                </div>
                <div className={`grid ${exportExpanded ? 'sm:grid-cols-2' : ''} gap-3`}>
                  {SECTIONS.map((section) => {
                    const namesInSection = section.fields.map((f) => f.name);
                    const allChecked = namesInSection.every((n) => exportFields.includes(n));
                    return (
                      <div key={section.title} className="bg-slate-50 rounded-xl p-3">
                        <label className="flex items-center gap-2 mb-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={() =>
                              setExportFields((prev) =>
                                allChecked ? prev.filter((n) => !namesInSection.includes(n)) : [...new Set([...prev, ...namesInSection])]
                              )
                            }
                          />
                          <span className="text-xs font-black text-slate-600 uppercase tracking-wider">{section.title}</span>
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 pl-6">
                          {section.fields.map((f) => (
                            <label key={f.name} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                              <input type="checkbox" checked={exportFields.includes(f.name)} onChange={() => toggleValue(setExportFields, f.name)} />
                              {f.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-3 text-xs font-bold text-slate-600">
                {exportMatchedItems.length} siswa • {exportFields.length} kolom akan diexport
              </div>
            </div>
            <ModalFooter>
              <div className="flex gap-3">
                <button onClick={() => setExportOpen(false)} className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all">Batal</button>
                <button
                  onClick={handleExportConfirm}
                  disabled={exportMatchedItems.length === 0 || exportFields.length === 0}
                  className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl font-black text-sm hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download size={16} /> Export {exportMatchedItems.length} Siswa
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
