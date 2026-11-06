import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Pencil, Trash2, ArrowLeft, Loader2, AlertTriangle,
  FileBarChart2, FileDown, RefreshCw, Sparkles, ChevronRight, ChevronLeft,
  Users, CheckCircle2, Copy, Check, Grid, List, Table, Award, BookOpen, HeartHandshake,
  ChevronDown, FileText
} from 'lucide-react';
import { fetchSchoolData, mutateRow, mutateBatch, formatSheetDate } from '../../services/gsheet';
import { Modal, ModalFooter, ConfirmDialog, ToastNotification, Field } from './ModalKit';

// Taksonomi kelas — sama dengan Data Siswa.
const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6', 'Tamat'];
const SEMESTER_OPTIONS = ['1', '2'];
const SEMESTER_LABEL = { 1: 'Ganjil', 2: 'Genap' };

// Kelas & fase sesuai format rapor sekolah ("II (Dua)", Fase A). Kurikulum Merdeka: 1-2 = A, 3-4 = B, 5-6 = C.
const KELAS_ROMAWI = { 'SD 1': 'I (Satu)', 'SD 2': 'II (Dua)', 'SD 3': 'III (Tiga)', 'SD 4': 'IV (Empat)', 'SD 5': 'V (Lima)', 'SD 6': 'VI (Enam)' };
const FASE = { 'SD 1': 'A', 'SD 2': 'A', 'SD 3': 'B', 'SD 4': 'B', 'SD 5': 'C', 'SD 6': 'C' };

// Field milik 1 semester (ReportPeriods). Nilai/aspek/ekskul ada di tabel terpisah (relasional).
const PERIOD_FIELDS = [
  { name: 'tahunAjaran', label: 'Tahun Ajaran', type: 'text', required: true, placeholder: 'mis. 2025/2026' },
  { name: 'semester', label: 'Semester', type: 'select', required: true, options: SEMESTER_OPTIONS },
  { name: 'kehadiranSakit', label: 'Sakit (hari)', type: 'text' },
  { name: 'kehadiranIzin', label: 'Izin (hari)', type: 'text' },
  { name: 'kehadiranAlpa', label: 'Tanpa Keterangan (hari)', type: 'text' },
  { name: 'tempatRapor', label: 'Diberikan di', type: 'text' },
  { name: 'tanggalRapor', label: 'Tanggal Rapor', type: 'date' },
  { name: 'tanggalIdentitas', label: 'Tanggal Halaman Identitas (TTD Kepala Sekolah)', type: 'date' },
  { name: 'namaWaliKelas', label: 'Nama Wali Kelas', type: 'text' },
  { name: 'peringkat', label: 'Peringkat (opsional)', type: 'text', sdOnly: true },
  { name: 'catatanWaliKelas', label: 'Catatan Guru', type: 'textarea', rows: 4 },
];
// TK: tanpa peringkat; "Catatan Guru" pindah ke bawah tabel aspek; wali kelas = guru kelas.
const periodFieldsFor = (kelas) => (kelas === 'TK'
  ? PERIOD_FIELDS.filter((f) => !f.sdOnly && f.name !== 'catatanWaliKelas').map((f) => (f.name === 'namaWaliKelas' ? { ...f, label: 'Nama Guru Kelas' } : f))
  : PERIOD_FIELDS);
const emptyPeriodForm = (kelas) => ({
  ...Object.fromEntries(PERIOD_FIELDS.map((f) => [f.name, ''])),
  semester: '1',
  tempatRapor: 'Tanjung Rejo',
  kelas,
});

// ---------- Tabel nilai per semester (SD: mapel umum + muatan lokal sekolah + ekskul; TK: aspek) ----------
const PREDIKAT_OPTIONS = ['A', 'B', 'C', 'D'];
const PREDIKAT_KET = { A: 'Sangat Baik', B: 'Baik', C: 'Cukup', D: 'Kurang' };

const TABLES = {
  umum: {
    key: 'umum', title: 'Muatan Pelajaran', sheet: 'ReportGrades', kelompok: 'umum',
    fields: [
      { name: 'induk', label: 'Induk (opsional)', type: 'text', placeholder: 'mis. Seni (Pilihan)', w: 'min-w-[110px]' },
      { name: 'mataPelajaran', label: 'Muatan Pelajaran', type: 'text', required: true, w: 'min-w-[150px]' },
      { name: 'nilaiAngka', label: 'Nilai Akhir', type: 'text', score: true, w: 'min-w-[70px]' },
      { name: 'deskripsiCapaian', label: 'Capaian Kompetensi (yang dikuasai)', type: 'textarea', rows: 3, w: 'min-w-[240px]' },
      { name: 'capaianBimbingan', label: 'Perlu Bimbingan / Harapan', type: 'textarea', rows: 3, w: 'min-w-[240px]' },
    ],
  },
  mulok: {
    key: 'mulok', title: 'Muatan Lokal Sekolah', sheet: 'ReportGrades', kelompok: 'mulok',
    fields: [
      { name: 'mataPelajaran', label: 'Bidang Ilmu', type: 'text', required: true, placeholder: 'mis. Tahfidz', w: 'min-w-[180px]' },
      { name: 'nilaiAngka', label: 'Nilai (Angka)', type: 'text', score: true, w: 'min-w-[90px]' },
    ],
  },
  ekskul: {
    key: 'ekskul', title: 'Ekstrakurikuler', sheet: 'ReportExtras',
    fields: [
      { name: 'nama', label: 'Ekstrakurikuler', type: 'text', required: true, placeholder: 'mis. Baca Tulis Al-Quran', w: 'min-w-[180px]' },
      { name: 'predikat', label: 'Predikat', type: 'select', options: PREDIKAT_OPTIONS, w: 'min-w-[80px]' },
      { name: 'keterangan', label: 'Keterangan', type: 'text', placeholder: 'kosong = otomatis dari predikat', w: 'min-w-[150px]' },
    ],
    // keterangan otomatis dari predikat bila dikosongkan (A = Sangat Baik, dst).
    finalize: (row) => ({ ...row, keterangan: String(row.keterangan || '').trim() || PREDIKAT_KET[row.predikat] || '' }),
  },
  aspekAgama: {
    key: 'aspekAgama', title: 'Nilai Agama dan Budi Pekerti', sheet: 'ReportAspects', kelompok: 'agama', blankAs: 'agama',
    fields: [
      { name: 'aspek', label: 'Aspek', type: 'text', required: true, placeholder: 'mis. Mengenal Allah', w: 'min-w-[160px]' },
      { name: 'deskripsi', label: 'Deskripsi Perkembangan', type: 'textarea', rows: 3, w: 'min-w-[260px]' },
    ],
  },
  aspekJatiDiri: {
    key: 'aspekJatiDiri', title: 'Jati Diri', sheet: 'ReportAspects', kelompok: 'jatidiri',
    fields: [
      { name: 'aspek', label: 'Aspek', type: 'text', required: true, placeholder: 'mis. Mengenal Allah', w: 'min-w-[160px]' },
      { name: 'deskripsi', label: 'Deskripsi Perkembangan', type: 'textarea', rows: 3, w: 'min-w-[260px]' },
    ],
  },
  aspekLiterasi: {
    key: 'aspekLiterasi', title: 'Dasar-dasar Literasi, Matematika, Sains, Teknologi, Rekayasa, dan Seni', sheet: 'ReportAspects', kelompok: 'literasi',
    fields: [
      { name: 'aspek', label: 'Aspek', type: 'text', required: true, placeholder: 'mis. Mengenal Allah', w: 'min-w-[160px]' },
      { name: 'deskripsi', label: 'Deskripsi Perkembangan', type: 'textarea', rows: 3, w: 'min-w-[260px]' },
    ],
  },
};
const tablesFor = (kelas) => (kelas === 'TK' ? [TABLES.aspekAgama, TABLES.aspekJatiDiri, TABLES.aspekLiterasi] : [TABLES.umum, TABLES.mulok, TABLES.ekskul]);
const EMPTY_SUBDATA = { ReportGrades: [], ReportAspects: [], ReportExtras: [] };

// Baris tersimpan untuk 1 tabel di 1 periode. Baris lama tanpa kolom `kelompok` dianggap "umum" (aspek TK: "agama").
const rowsOf = (data, table, periodId) =>
  (data[table.sheet] || []).filter((r) =>
    String(r.reportPeriodId) === String(periodId) && (!table.kelompok || (r.kelompok || table.blankAs || 'umum') === table.kelompok));

// Satu baris draf dari baris tersimpan. `_base` = nilai saat mulai diedit -> dipakai untuk tahu
// baris mana yang BENAR-BENAR diubah guru ini (bukan sekadar beda dgn data terbaru dari guru lain).
const draftRow = (t, item) => {
  const vals = Object.fromEntries(t.fields.map((f) => [f.name, item[f.name] != null ? String(item[f.name]) : '']));
  return { _key: String(item.id), id: item.id, updatedAt: item.updatedAt ?? null, ...vals, _base: vals };
};

// Buat template baris default otomatis dari Master Mata Pelajaran (dengan nilai kosong)
export const templateDraftsFor = (kelas, masterSubjects = []) => {
  const isTK = kelas === 'TK';
  if (isTK) {
    const activeTK = (masterSubjects || [])
      .filter((s) => s.level === 'TK' && s.isActive !== 0)
      .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));

    const makeAspectRows = (kelompok) =>
      activeTK
        .filter((s) => s.kelompok === kelompok)
        .map((s, idx) => {
          const vals = { aspek: s.nama, deskripsi: '' };
          return { _key: `tpl-tk-${kelompok}-${s.id || idx}`, id: null, updatedAt: null, ...vals, _base: null };
        });

    return {
      aspekAgama: makeAspectRows('agama'),
      aspekJatiDiri: makeAspectRows('jatidiri'),
      aspekLiterasi: makeAspectRows('literasi'),
    };
  }

  // Cari mata pelajaran spesifik kelas ini (mis. 'SD 1', 'SD 2'), dengan fallback ke 'SD'
  const matchingSD = (masterSubjects || [])
    .filter((s) => (s.level === kelas || s.level === 'SD') && s.isActive !== 0)
    .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));

  const hasSpecific = matchingSD.some((s) => s.level === kelas);
  const activeSD = hasSpecific ? matchingSD.filter((s) => s.level === kelas) : matchingSD;

  return {
    umum: activeSD
      .filter((s) => s.kelompok === 'umum')
      .map((s, idx) => {
        const vals = {
          induk: s.induk || '',
          mataPelajaran: s.nama,
          nilaiAngka: '',
          deskripsiCapaian: '',
          capaianBimbingan: '',
        };
        return { _key: `tpl-${kelas}-umum-${s.id || idx}`, id: null, updatedAt: null, ...vals, _base: null };
      }),
    mulok: activeSD
      .filter((s) => s.kelompok === 'mulok')
      .map((s, idx) => {
        const vals = {
          mataPelajaran: s.nama,
          nilaiAngka: '',
        };
        return { _key: `tpl-${kelas}-mulok-${s.id || idx}`, id: null, updatedAt: null, ...vals, _base: null };
      }),
    ekskul: [],
  };
};

const draftsFrom = (kelas, periodId, data, masterSubjects = []) => {
  const tpl = templateDraftsFor(kelas, masterSubjects);
  return Object.fromEntries(
    tablesFor(kelas).map((t) => {
      const saved = rowsOf(data, t, periodId);
      if (saved.length > 0) {
        return [t.key, saved.map((item) => draftRow(t, item))];
      }
      return [t.key, tpl[t.key] || []];
    })
  );
};
const touched = (t, r) => !r.id || !r._base || t.fields.some((f) => String(r[f.name] ?? '').trim() !== String(r._base[f.name] ?? '').trim());

// ---------- Nilai: validasi, jumlah, rata-rata, terbilang ----------
const parseScore = (v) => Number(String(v).trim().replace(',', '.'));
const isValidScore = (v) => /^\d{1,3}([.,]\d{1,2})?$/.test(String(v).trim()) && parseScore(v) <= 100;

const SATUAN = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
const terbilangLower = (n) => {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} puluh${n % 10 ? ` ${SATUAN[n % 10]}` : ''}`;
  if (n < 200) return `seratus${n % 100 ? ` ${terbilangLower(n % 100)}` : ''}`;
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} ratus${n % 100 ? ` ${terbilangLower(n % 100)}` : ''}`;
  return String(n);
};
const terbilang = (v) => {
  const n = parseScore(v);
  if (!isFinite(n)) return '';
  return terbilangLower(Math.round(n)).replace(/\b\w/g, (c) => c.toUpperCase()); // "Sembilan Puluh Satu"
};
const summarize = (rows) => {
  const scores = rows.map((r) => r.nilaiAngka).filter((v) => String(v ?? '').trim() !== '' && isFinite(parseScore(v))).map(parseScore);
  if (!scores.length) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return { jumlah: sum, rata: sum / scores.length };
};
const fmtNum = (n) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

const describeError = (res) => {
  if (res && res.error) return res.error;
  if (res && res.conflict) return 'Data ini baru saja diubah dari perangkat/guru lain. Silakan buka lagi dan ulangi.';
  return 'Tidak diketahui — periksa koneksi lalu coba lagi.';
};


const cellBase = 'w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-secondary transition-all';

export default function TeacherEraport() {
  const [students, setStudents] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [subData, setSubData] = useState(EMPTY_SUBDATA); // { ReportGrades, ReportAspects, ReportExtras }
  const [masterSubjects, setMasterSubjects] = useState([]); // Master daftar mapel & aspek
  const [activeGrade, setActiveGrade] = useState('TK');
  const [query, setQuery] = useState('');

  const [selectedStudent, setSelectedStudent] = useState(null); // siswa yang dibuka riwayat raport-nya
  const [activePeriod, setActivePeriod] = useState(null); // {id, updatedAt, form} — null = lihat daftar semester
  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState({}); // { [tableKey]: baris yang sedang diedit } — semua tabel disimpan sekali klik
  const [removed, setRemoved] = useState({}); // { [tableKey]: [id baris tersimpan yang dihapus] }, efektif saat Simpan
  const [subEditMode, setSubEditMode] = useState(false); // false = tampilan ringkas (cuma tombol Edit), true = tabel input
  const [confirmingDeletePeriod, setConfirmingDeletePeriod] = useState(null);
  const [catatanDraft, setCatatanDraft] = useState(''); // TK: Catatan Guru, disimpan bersama tabel aspek

  const [saving, setSaving] = useState(false);
  const [savingSub, setSavingSub] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const rowKeyRef = useRef(0);

  // Filter status progres: 'ALL' | 'DONE' | 'PROGRESS' | 'EMPTY'
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal Setup Semester Massal Se-Kelas (Batch Setup)
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({
    tahunAjaran: '2025/2026',
    semester: '1',
    tanggalRapor: '',
    tanggalIdentitas: '',
    tempatRapor: 'Tanjung Rejo',
    namaWaliKelas: '',
  });
  const [savingBatch, setSavingBatch] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [confirmingDeleteBatchSemester, setConfirmingDeleteBatchSemester] = useState(false);

  // Modal Multi-Export Rapor Kelas
  const [showMultiExportModal, setShowMultiExportModal] = useState(false);
  const [exportYear, setExportYear] = useState('2025/2026');
  const [exportSemester, setExportSemester] = useState('1');
  const [selectedExportStudentIds, setSelectedExportStudentIds] = useState([]);
  const [exportFormat, setExportFormat] = useState('bundle'); // 'bundle' | 'separate'
  const [exportPageRange, setExportPageRange] = useState('rapor_only'); // 'rapor_only' | 'full'
  const [openPdfMenuId, setOpenPdfMenuId] = useState(null);
  const [exportingMulti, setExportingMulti] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error'|'warning', title }
  const [confirmingMultiExportSkip, setConfirmingMultiExportSkip] = useState(null);

  const showToast = (message, type = 'success', title = '') => {
    setToast({ message, type, title });
  };

  const load = async () => {
    const d = await fetchSchoolData();
    const sub = {
      ReportGrades: (d && d.ReportGrades) || [],
      ReportAspects: (d && d.ReportAspects) || [],
      ReportExtras: (d && d.ReportExtras) || [],
    };
    const ms = (d && d.MasterSubjects) || [];
    setStudents((d && d.Students) || []);
    setPeriods((d && d.ReportPeriods) || []);
    setSubData(sub);
    setMasterSubjects(ms);
    return { sub, periods: (d && d.ReportPeriods) || [], masterSubjects: ms };
  };
  useEffect(() => { load(); }, []);

  // Peta progres nilai untuk setiap siswa di kelas ini
  const studentStatsMap = useMemo(() => {
    const map = new Map();
    if (!students) return map;

    const isTK = activeGrade === 'TK';
    const classStudents = students.filter((s) => s.kelas === activeGrade);

    classStudents.forEach((stu) => {
      const stuPeriods = periods.filter((p) => String(p.studentId) === String(stu.id));
      if (stuPeriods.length === 0) {
        map.set(String(stu.id), { status: 'EMPTY', label: 'Belum Ada Semester', count: 0, latestPeriod: null });
        return;
      }
      // Ambil periode terbaru
      const latest = [...stuPeriods].sort((a, b) =>
        String(b.tahunAjaran || '').localeCompare(String(a.tahunAjaran || '')) || (Number(b.semester) || 0) - (Number(a.semester) || 0)
      )[0];

      let filledCount = 0;
      if (isTK) {
        const aspects = (subData.ReportAspects || []).filter(
          (a) => String(a.reportPeriodId) === String(latest.id) && String(a.deskripsi || '').trim() !== ''
        );
        filledCount = aspects.length;
      } else {
        const grades = (subData.ReportGrades || []).filter(
          (g) => String(g.reportPeriodId) === String(latest.id) && String(g.nilaiAngka || '').trim() !== ''
        );
        filledCount = grades.length;
      }

      if (filledCount >= (isTK ? 3 : 8)) {
        map.set(String(stu.id), { status: 'DONE', label: `Lengkap (${filledCount} ${isTK ? 'aspek' : 'mapel'})`, count: filledCount, latestPeriod: latest });
      } else if (filledCount > 0) {
        map.set(String(stu.id), { status: 'PROGRESS', label: `Sebagian (${filledCount} ${isTK ? 'aspek' : 'mapel'})`, count: filledCount, latestPeriod: latest });
      } else {
        map.set(String(stu.id), { status: 'EMPTY', label: 'Belum Ada Nilai', count: 0, latestPeriod: latest });
      }
    });

    return map;
  }, [students, periods, subData, activeGrade]);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (s.kelas !== activeGrade) return false;
      if (statusFilter !== 'ALL') {
        const stats = studentStatsMap.get(String(s.id));
        if (!stats || stats.status !== statusFilter) return false;
      }
      if (!q) return true;
      return String(s.nama_siswa || '').toLowerCase().includes(q);
    });
  }, [students, activeGrade, query, statusFilter, studentStatsMap]);

  const studentPeriods = useMemo(() => {
    if (!selectedStudent) return [];
    return periods
      .filter((p) => String(p.studentId) === String(selectedStudent.id))
      .sort((a, b) => String(b.tahunAjaran || '').localeCompare(String(a.tahunAjaran || '')) || (Number(b.semester) || 0) - (Number(a.semester) || 0));
  }, [periods, selectedStudent]);

  const resetSub = () => { setDrafts({}); setRemoved({}); setSubEditMode(false); };
  const openStudent = (student) => { setSelectedStudent(student); setActivePeriod(null); setExpanded(false); setError(''); };
  const closeStudent = () => { setSelectedStudent(null); setActivePeriod(null); resetSub(); };

  const openAddPeriod = () => {
    setError('');
    setActivePeriod({ id: null, updatedAt: null, form: emptyPeriodForm(selectedStudent.kelas) });
    resetSub();
  };
  const openEditPeriod = (p) => {
    setError('');
    const form = { kelas: p.kelas };
    PERIOD_FIELDS.forEach((f) => {
      let v = p[f.name];
      if ((f.name === 'tanggalRapor' || f.name === 'tanggalIdentitas') && v) v = formatSheetDate(v); // ISO datetime -> YYYY-MM-DD utk <input type="date">
      form[f.name] = v != null ? String(v) : '';
    });
    setActivePeriod({ id: p.id, updatedAt: p.updatedAt, form });
    setDrafts(draftsFrom(p.kelas, p.id, subData, masterSubjects));
    setRemoved({}); setSubEditMode(false);
  };
  const backToPeriodList = () => { setActivePeriod(null); resetSub(); };

  const handleSavePeriod = async () => {
    setError('');
    for (const f of PERIOD_FIELDS) {
      if (f.required && !String(activePeriod.form[f.name] || '').trim()) { setError(`"${f.label}" wajib diisi`); return; }
    }
    setSaving(true);
    const row = { ...activePeriod.form };
    if (!activePeriod.id) row.studentId = selectedStudent.id;
    const res = activePeriod.id
      ? await mutateRow({ action: 'update', sheetName: 'ReportPeriods', id: activePeriod.id, expectedUpdatedAt: activePeriod.updatedAt ?? null, row })
      : await mutateRow({ action: 'add', sheetName: 'ReportPeriods', row });
    setSaving(false);
    if (res.conflict && res.current) {
      setActivePeriod((p) => ({ ...p, updatedAt: res.current.updatedAt }));
      setPeriods((prev) => prev.map((p) => (String(p.id) === String(activePeriod.id) ? { ...p, ...res.current } : p)));
      setError('Data semester ini baru saja diubah guru lain. Isian Anda masih ada di form — klik "Simpan Data Semester" lagi untuk tetap memakai isian Anda, atau kembali ke daftar untuk melihat versi guru lain.');
      return;
    }
    if (!res.success) { setError('Gagal menyimpan: ' + describeError(res)); return; }
    const newId = activePeriod.id || res.id;
    setActivePeriod((p) => ({ ...p, id: newId, updatedAt: res.updatedAt }));
    setPeriods((prev) => {
      const merged = { ...row, id: newId, updatedAt: res.updatedAt };
      return activePeriod.id ? prev.map((p) => (String(p.id) === String(newId) ? { ...p, ...merged } : p)) : [...prev, merged];
    });
  };

  const confirmDeletePeriod = async () => {
    setDeleting(true);
    const res = await mutateRow({ action: 'delete', sheetName: 'ReportPeriods', id: confirmingDeletePeriod.id, expectedUpdatedAt: confirmingDeletePeriod.updatedAt ?? null });
    setDeleting(false);
    if (!res.success) {
      setConfirmingDeletePeriod(null);
      if (res.conflict) await load();
      setError('Gagal menghapus: ' + describeError(res));
      return;
    }
    setPeriods((prev) => prev.filter((p) => String(p.id) !== String(confirmingDeletePeriod.id)));
    setConfirmingDeletePeriod(null);
    if (activePeriod && activePeriod.id === confirmingDeletePeriod.id) setActivePeriod(null);
  };

  // ---- Tabel nilai / aspek / ekskul — banyak baris, sekali Simpan ----
  const isTK = !!activePeriod && activePeriod.form.kelas === 'TK';
  const tables = activePeriod ? tablesFor(activePeriod.form.kelas) : [];

  const enterSubEditMode = () => {
    setDrafts(draftsFrom(activePeriod.form.kelas, activePeriod.id, subData, masterSubjects));
    setRemoved({});
    setCatatanDraft(activePeriod.form.catatanWaliKelas || '');
    setError('');
    if (!isTK) setExpanded(true); // tabel SD lebar (capaian 2 kolom) — lega di mode diperbesar
    setSubEditMode(true);
  };

  const addDraftRow = (t) => {
    rowKeyRef.current += 1;
    const blank = { _key: `new-${rowKeyRef.current}`, id: null, updatedAt: null, ...Object.fromEntries(t.fields.map((f) => [f.name, ''])) };
    if (t.key === 'ekskul') blank.predikat = 'A';
    setDrafts((d) => ({ ...d, [t.key]: [...(d[t.key] || []), blank] }));
  };

  // Terapkan / sinkronkan ulang susunan dari Master Mata Pelajaran (mempertahankan nilai yang sudah diketik)
  const applyMasterTemplate = (tableKey) => {
    if (!activePeriod) return;
    const tpl = templateDraftsFor(activePeriod.form.kelas, masterSubjects);
    const tplRows = tpl[tableKey] || [];
    if (!tplRows.length) return;

    const currentDraft = drafts[tableKey] || [];
    const existingMap = new Map();
    currentDraft.forEach((r) => {
      const k = (r.mataPelajaran || r.aspek || '').trim().toLowerCase();
      if (k) existingMap.set(k, r);
    });

    const merged = tplRows.map((tr) => {
      const k = (tr.mataPelajaran || tr.aspek || '').trim().toLowerCase();
      const ex = existingMap.get(k);
      if (ex) {
        return {
          ...tr,
          id: ex.id,
          updatedAt: ex.updatedAt,
          _key: ex._key,
          nilaiAngka: ex.nilaiAngka != null ? ex.nilaiAngka : '',
          deskripsiCapaian: ex.deskripsiCapaian != null ? ex.deskripsiCapaian : '',
          capaianBimbingan: ex.capaianBimbingan != null ? ex.capaianBimbingan : '',
          deskripsi: ex.deskripsi != null ? ex.deskripsi : '',
        };
      }
      return tr;
    });

    // Pertahankan juga baris kustom di luar master jika ada
    currentDraft.forEach((r) => {
      const k = (r.mataPelajaran || r.aspek || '').trim().toLowerCase();
      const isFromMaster = tplRows.some((tr) => (tr.mataPelajaran || tr.aspek || '').trim().toLowerCase() === k);
      if (!isFromMaster && (r.mataPelajaran || r.aspek || '').trim()) {
        merged.push(r);
      }
    });

    setDrafts((prev) => ({ ...prev, [tableKey]: merged }));
  };

  const updateDraftCell = (tk, key, name, value) =>
    setDrafts((d) => ({ ...d, [tk]: (d[tk] || []).map((r) => (r._key === key ? { ...r, [name]: value } : r)) }));
  const removeDraftRow = (tk, key) => {
    const row = (drafts[tk] || []).find((r) => r._key === key);
    if (row && row.id) setRemoved((rm) => ({ ...rm, [tk]: [...(rm[tk] || []), { id: row.id, updatedAt: row.updatedAt ?? null }] }));
    setDrafts((d) => ({ ...d, [tk]: (d[tk] || []).filter((r) => r._key !== key) }));
  };
  const cancelDraftSub = () => {
    setDrafts(draftsFrom(activePeriod.form.kelas, activePeriod.id, subData, masterSubjects));
    setRemoved({}); setCatatanDraft(activePeriod.form.catatanWaliKelas || ''); setError(''); setSubEditMode(false);
  };

  const hasContent = (t, r) => t.fields.some((f) => f.name !== 'predikat' && String(r[f.name] || '').trim());

  const saveDraftSub = async () => {
    setError('');
    for (const t of tables) {
      const rows = (drafts[t.key] || []).filter((r) => hasContent(t, r));
      const req = t.fields.find((f) => f.required);
      if (req && rows.some((r) => !String(r[req.name] || '').trim())) { setError(`${t.title}: "${req.label}" wajib diisi di setiap baris`); return; }
      const sc = t.fields.find((f) => f.score);
      if (sc && rows.some((r) => String(r[sc.name] || '').trim() && !isValidScore(r[sc.name]))) { setError(`${t.title}: "${sc.label}" harus angka 0–100`); return; }
    }
    const ops = [];
    const plan = [];
    for (const t of tables) {
      for (const r of (drafts[t.key] || []).filter((x) => hasContent(t, x))) {
        if (!touched(t, r)) continue;
        let row = { reportPeriodId: activePeriod.id, ...Object.fromEntries(t.fields.map((f) => [f.name, String(r[f.name] ?? '').trim()])) };
        if (t.kelompok) row.kelompok = t.kelompok;
        if (t.finalize) row = t.finalize(row);
        plan.push({ type: 'row', t, key: r._key, id: r.id, row });
        ops.push(r.id
          ? { action: 'update', sheetName: t.sheet, id: r.id, expectedUpdatedAt: r.updatedAt ?? null, row }
          : { action: 'add', sheetName: t.sheet, row });
      }
      for (const rm of (removed[t.key] || [])) {
        plan.push({ type: 'remove', t, id: rm.id });
        ops.push({ action: 'delete', sheetName: t.sheet, id: rm.id, expectedUpdatedAt: rm.updatedAt });
      }
    }
    const catatanRow = isTK && catatanDraft.trim() !== String(activePeriod.form.catatanWaliKelas || '').trim()
      ? { catatanWaliKelas: catatanDraft.trim() } : null;
    if (catatanRow) {
      plan.push({ type: 'catatan' });
      ops.push({ action: 'update', sheetName: 'ReportPeriods', id: activePeriod.id, expectedUpdatedAt: activePeriod.updatedAt ?? null, row: catatanRow });
    }

    if (ops.length === 0) { setRemoved({}); setSubEditMode(false); return; }

    setSavingSub(true);
    const res = await mutateBatch(ops);
    setSavingSub(false);

    if (!res.success) {
      if (res.conflict && Array.isArray(res.conflicts) && res.conflicts.length) {
        const labels = [];
        const rebase = {};
        const removedRebase = {};
        let periodRebase = null;
        res.conflicts.forEach((c) => {
          const p = plan[c.index];
          if (!p) return;
          if (p.type === 'catatan') { periodRebase = c.current; labels.push('Catatan Guru'); return; }
          const name = (p.row && (p.row.mataPelajaran || p.row.aspek || p.row.nama)) || (c.current && (c.current.mataPelajaran || c.current.aspek || c.current.nama)) || `baris ${c.id}`;
          labels.push(`${p.t.title}: ${name}${c.notFound ? ' (sudah dihapus)' : ''}`);
          if (p.type === 'row') rebase[p.key] = c.notFound ? { gone: true } : { updatedAt: c.current.updatedAt };
          else if (c.current) removedRebase[`${p.t.key}:${c.id}`] = c.current.updatedAt;
        });
        const fresh = await load();
        const removedNow = removed;
        setDrafts((d) => {
          const next = {};
          for (const t of tables) {
            const freshRows = rowsOf(fresh.sub, t, activePeriod.id);
            const freshById = Object.fromEntries(freshRows.map((x) => [String(x.id), x]));
            next[t.key] = (d[t.key] || []).flatMap((r) => {
              const rb = rebase[r._key];
              if (rb) return [rb.gone ? { ...r, id: null, updatedAt: null } : { ...r, updatedAt: rb.updatedAt }];
              if (touched(t, r)) return [r];
              const cur = freshById[String(r.id)];
              return cur ? [draftRow(t, cur)] : [];
            });
            const known = new Set(next[t.key].filter((r) => r.id).map((r) => String(r.id)));
            (removedNow[t.key] || []).forEach((x) => known.add(String(x.id)));
            freshRows.forEach((cur) => { if (!known.has(String(cur.id))) next[t.key].push(draftRow(t, cur)); });
          }
          return next;
        });
        setRemoved((rm) => Object.fromEntries(Object.entries(rm).map(([tk, list]) => [tk, list.map((x) => {
          const v = removedRebase[`${tk}:${x.id}`];
          return v !== undefined ? { ...x, updatedAt: v } : x;
        })])));
        if (periodRebase) setActivePeriod((p) => ({ ...p, updatedAt: periodRebase.updatedAt }));
        setError(`Baru saja diubah guru lain, jadi BELUM ADA yang tersimpan: ${labels.join('; ')}. Isian Anda masih utuh — periksa lagi lalu klik Simpan untuk tetap memakai isian Anda, atau Batal untuk melihat versi guru lain.`);
        return;
      }
      setError('Belum ada yang tersimpan: ' + describeError(res));
      return;
    }

    const local = { ReportGrades: [...subData.ReportGrades], ReportAspects: [...subData.ReportAspects], ReportExtras: [...subData.ReportExtras] };
    plan.forEach((p, i) => {
      const out = res.results[i];
      if (p.type === 'row') {
        const merged = { ...p.row, id: out.id, updatedAt: out.updatedAt };
        local[p.t.sheet] = p.id
          ? local[p.t.sheet].map((x) => (String(x.id) === String(p.id) ? { ...x, ...merged } : x))
          : [...local[p.t.sheet], merged];
      } else if (p.type === 'remove') {
        local[p.t.sheet] = local[p.t.sheet].filter((x) => String(x.id) !== String(p.id));
      } else if (p.type === 'catatan') {
        setActivePeriod((ap) => ({ ...ap, updatedAt: out.updatedAt, form: { ...ap.form, ...catatanRow } }));
        setPeriods((prev) => prev.map((x) => (String(x.id) === String(activePeriod.id) ? { ...x, ...catatanRow, updatedAt: out.updatedAt } : x)));
      }
    });
    setSubData(local);
    setRemoved({});
    setDrafts(draftsFrom(activePeriod.form.kelas, activePeriod.id, local, masterSubjects));
    setSubEditMode(false);
    await load();
    return true;
  };

  // Navigasi cepat antar siswa se-kelas tanpa bolak-balik modal
  const currentStudentIndex = useMemo(() => {
    if (!selectedStudent) return -1;
    return filteredStudents.findIndex((s) => String(s.id) === String(selectedStudent.id));
  }, [selectedStudent, filteredStudents]);

  const hasNextStudent = currentStudentIndex >= 0 && currentStudentIndex < filteredStudents.length - 1;
  const hasPrevStudent = currentStudentIndex > 0;

  const navigateToStudent = async (direction) => {
    const nextIdx = direction === 'next' ? currentStudentIndex + 1 : currentStudentIndex - 1;
    if (nextIdx < 0 || nextIdx >= filteredStudents.length) return;

    // Jika sedang dalam subEditMode, tanyakan simpan dulu
    if (subEditMode) {
      const ok = await saveDraftSub();
      if (!ok) return;
    }

    const nextStudent = filteredStudents[nextIdx];
    setSelectedStudent(nextStudent);

    // Cari apakah siswa berikutnya ini punya periode untuk tahun ajaran & semester yang sama
    const matchPeriod = activePeriod
      ? periods.find(
          (p) =>
            String(p.studentId) === String(nextStudent.id) &&
            String(p.tahunAjaran) === String(activePeriod.form.tahunAjaran) &&
            String(p.semester) === String(activePeriod.form.semester)
        )
      : null;

    if (matchPeriod) {
      openEditPeriod(matchPeriod);
    } else {
      setActivePeriod(null);
      resetSub();
    }
  };

  // Eksekusi Pembuatan Periode Semester Massal Se-Kelas (Batch Setup)
  const handleApplyBatchSemester = async () => {
    const classStudents = (students || []).filter((s) => s.kelas === activeGrade);
    if (!classStudents.length) {
      showToast(`Tidak ada siswa di kelas ${activeGrade}.`, 'warning', 'Data Kosong');
      return;
    }

    setSavingBatch(true);
    setError('');

    try {
      const ops = [];

      classStudents.forEach((stu) => {
        // Cek apakah siswa ini sudah punya periode semester yang sama
        const existing = periods.find(
          (p) =>
            String(p.studentId) === String(stu.id) &&
            String(p.tahunAjaran) === String(batchForm.tahunAjaran) &&
            String(p.semester) === String(batchForm.semester)
        );

        if (existing) {
          // Update data semester yang ada (tanggal, wali kelas, tempat rapor)
          ops.push({
            action: 'update',
            sheetName: 'ReportPeriods',
            id: existing.id,
            expectedUpdatedAt: existing.updatedAt ?? null,
            row: {
              ...batchForm,
              kelas: activeGrade,
            },
          });
        } else {
          // Buat periode baru
          ops.push({
            action: 'add',
            sheetName: 'ReportPeriods',
            row: {
              studentId: stu.id,
              kelas: activeGrade,
              ...batchForm,
            },
          });
        }
      });

      if (!ops.length) {
        setSavingBatch(false);
        setShowBatchModal(false);
        return;
      }

      const res = await mutateBatch(ops);
      setSavingBatch(false);

      if (!res.success) {
        showToast('Gagal menerapkan semester massal: ' + describeError(res), 'error', 'Gagal Simpan');
        return;
      }

      setShowBatchModal(false);
      await load();
      showToast(`Berhasil menerapkan semester ${batchForm.semester === '1' ? 'Ganjil' : 'Genap'} TP ${batchForm.tahunAjaran} untuk ${classStudents.length} siswa kelas ${activeGrade}!`, 'success', 'Berhasil Diterapkan');
    } catch (err) {
      setSavingBatch(false);
      showToast('Terjadi kesalahan: ' + String(err), 'error', 'Error');
    }
  };

  // Periode yang cocok dengan form batch semester saat ini di kelas aktif
  const matchingBatchPeriods = useMemo(() => {
    const classStudentIds = new Set((students || []).filter((s) => s.kelas === activeGrade).map((s) => String(s.id)));
    return (periods || []).filter(
      (p) =>
        classStudentIds.has(String(p.studentId)) &&
        String(p.tahunAjaran) === String(batchForm.tahunAjaran) &&
        String(p.semester) === String(batchForm.semester)
    );
  }, [periods, students, activeGrade, batchForm.tahunAjaran, batchForm.semester]);

  // Eksekusi Hapus Seluruh Periode Semester Ini Se-Kelas (Bila salah input)
  const handleDeleteBatchSemester = async () => {
    if (!matchingBatchPeriods.length) return;
    setDeletingBatch(true);
    setError('');

    try {
      const periodIds = new Set(matchingBatchPeriods.map((p) => String(p.id)));
      const ops = [];

      // 1. Hapus ReportGrades
      (subData.ReportGrades || []).forEach((r) => {
        if (periodIds.has(String(r.reportPeriodId))) {
          ops.push({ action: 'delete', sheetName: 'ReportGrades', id: r.id, expectedUpdatedAt: r.updatedAt ?? null });
        }
      });

      // 2. Hapus ReportAspects
      (subData.ReportAspects || []).forEach((r) => {
        if (periodIds.has(String(r.reportPeriodId))) {
          ops.push({ action: 'delete', sheetName: 'ReportAspects', id: r.id, expectedUpdatedAt: r.updatedAt ?? null });
        }
      });

      // 3. Hapus ReportExtras
      (subData.ReportExtras || []).forEach((r) => {
        if (periodIds.has(String(r.reportPeriodId))) {
          ops.push({ action: 'delete', sheetName: 'ReportExtras', id: r.id, expectedUpdatedAt: r.updatedAt ?? null });
        }
      });

      // 4. Hapus ReportPeriods
      matchingBatchPeriods.forEach((p) => {
        ops.push({ action: 'delete', sheetName: 'ReportPeriods', id: p.id, expectedUpdatedAt: p.updatedAt ?? null });
      });

      const res = await mutateBatch(ops);
      setDeletingBatch(false);
      setConfirmingDeleteBatchSemester(false);

      if (!res.success) {
        showToast('Gagal menghapus semester massal: ' + describeError(res), 'error', 'Gagal Hapus');
        return;
      }

      setShowBatchModal(false);
      await load();
      showToast(`Berhasil menghapus seluruh periode semester ${batchForm.semester === '1' ? 'Ganjil' : 'Genap'} TP ${batchForm.tahunAjaran} untuk ${matchingBatchPeriods.length} siswa kelas ${activeGrade}!`, 'success', 'Berhasil Dihapus');
    } catch (err) {
      setDeletingBatch(false);
      setConfirmingDeleteBatchSemester(false);
      showToast('Terjadi kesalahan saat menghapus: ' + String(err), 'error', 'Error');
    }
  };

  // Daftar tahun ajaran yang tersedia di kelas ini
  const classAvailableYears = useMemo(() => {
    const classStudentIds = new Set((students || []).filter((s) => s.kelas === activeGrade).map((s) => String(s.id)));
    const years = new Set();
    (periods || []).forEach((p) => {
      if (classStudentIds.has(String(p.studentId)) && p.tahunAjaran) {
        years.add(String(p.tahunAjaran).trim());
      }
    });
    if (batchForm.tahunAjaran) years.add(batchForm.tahunAjaran.trim());
    years.add('2025/2026');
    years.add('2024/2025');
    return Array.from(years).sort().reverse();
  }, [periods, students, activeGrade, batchForm.tahunAjaran]);

  const openMultiExportModal = () => {
    const classStudents = (students || []).filter((s) => s.kelas === activeGrade);
    const classStudentIds = new Set(classStudents.map((s) => String(s.id)));
    const classPeriods = (periods || []).filter((p) => classStudentIds.has(String(p.studentId)));

    const latestP = [...classPeriods].sort((a, b) =>
      String(b.tahunAjaran || '').localeCompare(String(a.tahunAjaran || '')) || (Number(b.semester) || 0) - (Number(a.semester) || 0)
    )[0];

    const targetYear = latestP?.tahunAjaran || batchForm.tahunAjaran || '2025/2026';
    const targetSem = latestP?.semester || batchForm.semester || '1';
    setExportYear(targetYear);
    setExportSemester(targetSem);
    setSelectedExportStudentIds(classStudents.map((s) => String(s.id)));
    setExportFormat('bundle');
    setExportPageRange('rapor_only');
    setShowMultiExportModal(true);
  };

  const toggleExportStudent = (id) => {
    const sId = String(id);
    setSelectedExportStudentIds((prev) =>
      prev.includes(sId) ? prev.filter((x) => x !== sId) : [...prev, sId]
    );
  };

  const selectAllExportStudents = () => {
    const classStudents = (students || []).filter((s) => s.kelas === activeGrade);
    setSelectedExportStudentIds(classStudents.map((s) => String(s.id)));
  };

  const deselectAllExportStudents = () => {
    setSelectedExportStudentIds([]);
  };

  const startGeneratingMultiRapor = async (readyTargets) => {
    setExportingMulti(true);
    setExportProgress({ current: 0, total: readyTargets.length, currentName: 'Menyiapkan berkas…' });

    try {
      const { generateRaporPdf, raporFileName, multiRaporFileName } = await import('../../services/raporPdf');
      const wmBlob = await fetch(activeGrade === 'TK' ? '/avatars/logo-tk.png' : '/avatars/rapor-watermark.jpeg')
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null);
      const watermark = wmBlob
        ? await new Promise((res) => {
            const fr = new FileReader();
            fr.onloadend = () => res(fr.result);
            fr.readAsDataURL(wmBlob);
          })
        : null;

      const isFull = exportPageRange === 'full';

      if (exportFormat === 'bundle') {
        let bundleDoc = null;
        for (let i = 0; i < readyTargets.length; i++) {
          const target = readyTargets[i];
          setExportProgress({ current: i + 1, total: readyTargets.length, currentName: target.student.nama_siswa });
          await new Promise((r) => setTimeout(r, 80));

          bundleDoc = await generateRaporPdf({
            student: target.student,
            period: target.period,
            watermark,
            umum: rowsOf(subData, TABLES.umum, target.period.id),
            mulok: rowsOf(subData, TABLES.mulok, target.period.id),
            extras: rowsOf(subData, TABLES.ekskul, target.period.id),
            aspek: {
              agama: rowsOf(subData, TABLES.aspekAgama, target.period.id),
              jatidiri: rowsOf(subData, TABLES.aspekJatiDiri, target.period.id),
              literasi: rowsOf(subData, TABLES.aspekLiterasi, target.period.id),
            },
            existingDoc: bundleDoc,
            includeCover: isFull,
          });
        }

        if (bundleDoc) {
          bundleDoc.save(multiRaporFileName(activeGrade, exportSemester, exportYear, isFull));
        }
      } else {
        for (let i = 0; i < readyTargets.length; i++) {
          const target = readyTargets[i];
          setExportProgress({ current: i + 1, total: readyTargets.length, currentName: target.student.nama_siswa });

          const doc = await generateRaporPdf({
            student: target.student,
            period: target.period,
            watermark,
            umum: rowsOf(subData, TABLES.umum, target.period.id),
            mulok: rowsOf(subData, TABLES.mulok, target.period.id),
            extras: rowsOf(subData, TABLES.ekskul, target.period.id),
            aspek: {
              agama: rowsOf(subData, TABLES.aspekAgama, target.period.id),
              jatidiri: rowsOf(subData, TABLES.aspekJatiDiri, target.period.id),
              literasi: rowsOf(subData, TABLES.aspekLiterasi, target.period.id),
            },
            includeCover: isFull,
          });

          doc.save(raporFileName(target.student, target.period, isFull));
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      setExportingMulti(false);
      setShowMultiExportModal(false);
      showToast(`Berhasil mengekspor ${readyTargets.length} rapor siswa kelas ${activeGrade}!`, 'success', 'Unduhan Berhasil');
    } catch (err) {
      setExportingMulti(false);
      showToast('Gagal mengekspor rapor massal: ' + String((err && err.message) || err), 'error', 'Gagal Ekspor');
    }
  };

  const handleExecuteMultiExport = async () => {
    if (!selectedExportStudentIds.length) {
      showToast('Pilih minimal 1 murid untuk diunduh rapornya.', 'warning', 'Pilih Murid');
      return;
    }

    const classStudents = (students || []).filter((s) => s.kelas === activeGrade);
    const targetStudents = classStudents.filter((s) => selectedExportStudentIds.includes(String(s.id)));

    const readyTargets = [];
    const missingNames = [];

    targetStudents.forEach((stu) => {
      const p = (periods || []).find(
        (period) =>
          String(period.studentId) === String(stu.id) &&
          String(period.tahunAjaran) === String(exportYear) &&
          String(period.semester) === String(exportSemester)
      );
      if (p) {
        readyTargets.push({ student: stu, period: p });
      } else {
        missingNames.push(stu.nama_siswa);
      }
    });

    if (!readyTargets.length) {
      showToast(`Tidak ada siswa terpilih yang memiliki data rapor semester ${exportSemester === '1' ? 'Ganjil' : 'Genap'} TP ${exportYear}. Silakan pastikan data semester sudah di-setup.`, 'warning', 'Data Belum Ada');
      return;
    }

    if (missingNames.length > 0) {
      setConfirmingMultiExportSkip({ readyTargets, missingNames });
      return;
    }

    startGeneratingMultiRapor(readyTargets);
  };

  // Template Saran Cepat Capaian Kompetensi Kurikulum Merdeka
  const QUICK_TEMPLATES = {
    capaian: [
      { label: 'Sangat Baik (≥ 90)', text: 'Menunjukkan penguasaan materi yang sangat baik dalam memahami dan menerapkan seluruh tujuan pembelajaran.' },
      { label: 'Baik (75–89)', text: 'Menunjukkan pemahaman yang baik dan aktif dalam mencapai tujuan pembelajaran yang ditetapkan.' },
      { label: 'Cukup (65–74)', text: 'Mulai menunjukkan pemahaman materi dengan baik sesuai capaian pembelajaran.' },
      { label: 'Tahfidz Lancar', text: 'Mampu menghafal dengan mutqin, tajwid yang tepat, dan makhraj huruf yang fasih.' },
    ],
    bimbingan: [
      { label: 'Konsistensi', text: 'Perlu bimbingan dan pembiasaan agar lebih teliti dan konsisten dalam menyelesaikan tugas.' },
      { label: 'Pendampingan', text: 'Perlu pendampingan khusus dan bimbingan orang tua dalam mengulang materi di rumah.' },
      { label: 'Tahfidz Murajaah', text: 'Perlu meningkatkan murajaah rutin di rumah agar hafalan semakin mutqin.' },
      { label: 'Fokus', text: 'Perlu dimotivasi untuk lebih fokus dan aktif bertanya saat proses pembelajaran di kelas.' },
    ],
  };

  const renderEditCell = (t, row, f) => {
    const common = { value: row[f.name], onChange: (e) => updateDraftCell(t.key, row._key, f.name, e.target.value) };
    if (f.type === 'textarea') {
      const isCapaian = f.name === 'deskripsiCapaian';
      const isBimbingan = f.name === 'capaianBimbingan';

      return (
        <div className="space-y-1">
          <textarea rows={f.rows || 1} {...common} className={`${cellBase} ${f.w || ''}`} />
          {(isCapaian || isBimbingan) && (
            <div className="flex flex-wrap gap-1">
              {(isCapaian ? QUICK_TEMPLATES.capaian : QUICK_TEMPLATES.bimbingan).map((qt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => updateDraftCell(t.key, row._key, f.name, qt.text)}
                  className="text-[9px] font-semibold bg-slate-100 hover:bg-secondary/15 hover:text-secondary text-slate-500 px-1.5 py-0.5 rounded transition-all"
                  title={qt.text}
                >
                  + {qt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (f.type === 'select') {
      return (
        <select {...common} className={`${cellBase} ${f.w || ''}`}>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    const listAttr = f.name === 'mataPelajaran' ? 'eraport-subjects-list' : undefined;
    return <input {...common} list={listAttr} placeholder={f.placeholder} inputMode={f.score ? 'decimal' : undefined} className={`${cellBase} ${f.w || ''}`} />;
  };

  // Unduh rapor PDF — default: Halaman 4–6 saja (Nilai & Capaian). Jika includeCover: true -> Halaman 1–6 (Lengkap).
  const exportRaporPdf = async (periodId, includeCover = false) => {
    const saved = periods.find((x) => String(x.id) === String(periodId));
    const stu = (students || []).find((x) => String(x.id) === String(saved && saved.studentId)) || selectedStudent;
    if (!saved || !stu) return;
    setError(''); setExportingId(periodId);
    try {
      const { generateRaporPdf, raporFileName } = await import('../../services/raporPdf');
      const wmBlob = await fetch(saved.kelas === 'TK' ? '/avatars/logo-tk.png' : '/avatars/rapor-watermark.jpeg').then((r) => (r.ok ? r.blob() : null)).catch(() => null);
      const watermark = wmBlob ? await new Promise((res) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result); fr.readAsDataURL(wmBlob); }) : null;
      const doc = await generateRaporPdf({
        student: stu, period: saved, watermark,
        umum: rowsOf(subData, TABLES.umum, saved.id),
        mulok: rowsOf(subData, TABLES.mulok, saved.id),
        extras: rowsOf(subData, TABLES.ekskul, saved.id),
        aspek: { agama: rowsOf(subData, TABLES.aspekAgama, saved.id), jatidiri: rowsOf(subData, TABLES.aspekJatiDiri, saved.id), literasi: rowsOf(subData, TABLES.aspekLiterasi, saved.id) },
        includeCover,
      });
      doc.save(raporFileName(stu, saved, includeCover));
      showToast(
        includeCover
          ? `Rapor lengkap (${stu.nama_siswa}) dengan Sampul & Biodata berhasil diunduh.`
          : `Rapor nilai (${stu.nama_siswa}) berhasil diunduh (Halaman ${saved.kelas === 'TK' ? 'Capaian TK' : '4–6'}).`,
        'success',
        'Unduh PDF Berhasil'
      );
    } catch (e) {
      setError('Gagal membuat PDF: ' + String((e && e.message) || e));
      showToast('Gagal membuat PDF: ' + String((e && e.message) || e), 'error', 'Gagal Unduh');
    } finally {
      setExportingId(null);
    }
  };

  const periodTitle = (p) => `${KELAS_ROMAWI[p.kelas] ? `Kelas ${KELAS_ROMAWI[p.kelas]}` : p.kelas} • Semester ${SEMESTER_LABEL[p.semester] || p.semester}`;

  return (
    <div className="w-full">
      {/* Header — Ringkas & Fit Kanan-Kiri */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">E-Raport</h2>
          <p className="text-slate-400 font-bold text-xs sm:text-sm mt-0.5">
            {students === null ? 'Memuat…' : `${filteredStudents.length} siswa • Kelas ${activeGrade}`}
          </p>
        </div>

        {/* Tombol Aksi Massal: di mobile berdampingan 2 kolom proporsional */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={openMultiExportModal}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl sm:rounded-2xl bg-secondary text-white hover:brightness-95 font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all shadow-md shadow-secondary/20 active:scale-95 text-center"
          >
            <FileDown size={15} className="shrink-0" />
            <span className="truncate">Unduh Rapor</span>
          </button>
          <button
            onClick={() => setShowBatchModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl sm:rounded-2xl bg-slate-900 text-white hover:bg-black font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 text-center"
          >
            <Users size={15} className="shrink-0" />
            <span className="truncate">Setup Kelas</span>
          </button>
        </div>
      </div>

      {/* Tab kelas — Full width membentang pas kanan-kiri */}
      <div className="w-full bg-white p-1 sm:p-1.5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto hide-scrollbar mb-3 sm:mb-4 flex gap-1">
        {GRADES.map((grade) => (
          <button
            key={grade}
            onClick={() => setActiveGrade(grade)}
            className={`flex-1 min-w-[56px] sm:min-w-[62px] py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all text-center whitespace-nowrap active:scale-95 ${
              activeGrade === grade ? 'bg-secondary text-white shadow-md shadow-secondary/20' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {grade}
          </button>
        ))}
      </div>

      {/* Filter Status Progres & Pencarian Siswa */}
      <div className="space-y-2.5 mb-4 sm:mb-6">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama siswa…"
            className="w-full bg-white border-2 border-slate-100 rounded-xl sm:rounded-2xl pl-10 pr-4 py-2.5 sm:py-3 font-bold text-slate-800 text-xs outline-none focus:border-secondary transition-all"
          />
        </div>

        {/* Filter Pills — Full width grid 4 kolom pas di layar mobile */}
        <div className="w-full grid grid-cols-4 bg-white p-1 rounded-xl sm:rounded-2xl border border-slate-100 gap-1 text-center">
          {[
            { key: 'ALL', label: 'Semua' },
            { key: 'DONE', label: 'Lengkap' },
            { key: 'PROGRESS', label: 'Sebagian' },
            { key: 'EMPTY', label: 'Belum Ada' },
          ].map((flt) => (
            <button
              key={flt.key}
              onClick={() => setStatusFilter(flt.key)}
              className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all truncate ${
                statusFilter === flt.key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {flt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar siswa — Fit Kanan-Kiri & Bebas Terpotong */}
      {students === null ? (
        <div className="flex justify-center py-20 text-slate-300"><Loader2 className="animate-spin" size={32} /></div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold">Tidak ada siswa yang sesuai filter.</div>
      ) : (
        <div className="space-y-2 sm:space-y-2.5">
          {filteredStudents.map((s) => {
            const count = periods.filter((p) => String(p.studentId) === String(s.id)).length;
            const stats = studentStatsMap.get(String(s.id));

            return (
              <button
                key={s.id}
                onClick={() => openStudent(s)}
                className="w-full flex items-center justify-between gap-2.5 bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm hover:border-secondary/40 hover:shadow-md active:scale-[0.99] transition-all text-left group"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0 group-hover:bg-secondary group-hover:text-white transition-colors">
                    <FileBarChart2 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-900 text-xs sm:text-sm truncate leading-snug group-hover:text-secondary transition-colors">
                      {s.nama_siswa || '(tanpa nama)'}
                    </p>
                    <p className="text-slate-400 font-semibold text-[10px] sm:text-xs truncate mt-0.5">
                      NISN: {s.nisn || '-'} • {count} semester
                    </p>
                  </div>
                </div>

                {/* Badge Status Pengisian Nilai: proporsional di kanan, tidak tertekan */}
                {stats && (
                  <span
                    className={`shrink-0 px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-black border transition-all whitespace-nowrap text-center ${
                      stats.status === 'DONE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : stats.status === 'PROGRESS'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {stats.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Modal: riwayat semester siswa (+ detail 1 semester bila dibuka) */}
      <AnimatePresence>
        {selectedStudent && (
          <Modal
            onClose={() => !saving && !savingSub && closeStudent()}
            title={activePeriod ? `${selectedStudent.nama_siswa} — ${activePeriod.form.kelas}` : `Riwayat Raport: ${selectedStudent.nama_siswa}`}
            maxWidthClass="max-w-2xl"
            expandedWidthClass="max-w-6xl"
            expanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)}
            closeOnBackdrop={false}
          >
            {!activePeriod ? (
              <>
                <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5">
                  <button
                    onClick={openAddPeriod}
                    className="inline-flex items-center gap-2 bg-secondary text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:brightness-95 active:scale-95 transition-all shadow-lg shadow-secondary/20 mb-5"
                  >
                    <Plus size={18} /> Tambah Semester Baru
                  </button>
                  {studentPeriods.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 font-bold">Belum ada data semester. Klik "Tambah Semester Baru".</div>
                  ) : (
                    <div className="grid gap-3">
                      {studentPeriods.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3 sm:p-3.5 border border-slate-100">
                          <div className="min-w-0 flex-grow">
                            <p className="font-black text-slate-900 text-sm">{periodTitle(p)}</p>
                            <p className="text-slate-400 font-bold text-xs">Tahun Pelajaran {p.tahunAjaran}</p>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {/* Split Button: Unduh Rapor Saja (Hal 4–6) & Menu Opsi Lengkap (Hal 1–6) */}
                            <div className="relative">
                              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => exportRaporPdf(p.id, false)}
                                  disabled={exportingId === p.id}
                                  className="p-2 sm:p-2.5 text-slate-600 hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5"
                                  title="Unduh Rapor Saja (Hal 4–6 SD / Capaian TK)"
                                >
                                  {exportingId === p.id ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
                                  <span className="hidden sm:inline text-[11px] font-black">Rapor (4–6)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenPdfMenuId(openPdfMenuId === p.id ? null : p.id);
                                  }}
                                  disabled={exportingId === p.id}
                                  className="px-1.5 sm:px-2 py-2 sm:py-2.5 border-l border-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                                  title="Pilihan Versi Unduh Rapor"
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </div>

                              {openPdfMenuId === p.id && (
                                <>
                                  <div className="fixed inset-0 z-30" onClick={() => setOpenPdfMenuId(null)} />
                                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-40 text-left animate-in fade-in zoom-in-95 duration-150">
                                    <div className="px-2.5 py-1.5 mb-1 border-b border-slate-100">
                                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pilihan Cetak Dokumen</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenPdfMenuId(null);
                                        exportRaporPdf(p.id, false);
                                      }}
                                      className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 transition-colors group flex items-start gap-2.5"
                                    >
                                      <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                                        <FileText size={13} />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black text-slate-900 group-hover:text-emerald-700">Rapor Saja (Hal 4–6)</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Nilai & capaian (hemat kertas, tiap semester)</p>
                                      </div>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenPdfMenuId(null);
                                        exportRaporPdf(p.id, true);
                                      }}
                                      className="w-full text-left p-2.5 rounded-xl hover:bg-secondary/10 transition-colors group flex items-start gap-2.5 mt-0.5"
                                    >
                                      <div className="w-6 h-6 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                                        <BookOpen size={13} />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black text-slate-900 group-hover:text-secondary">Lengkap + Sampul (Hal 1–6)</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Dengan cover & identitas (siswa baru/arsip)</p>
                                      </div>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>

                            <button onClick={() => openEditPeriod(p)} className="p-2 sm:p-2.5 rounded-xl bg-white text-slate-500 hover:bg-secondary hover:text-white transition-all border border-slate-100" title="Buka"><Pencil size={16} /></button>
                            <button onClick={() => setConfirmingDeletePeriod(p)} className="p-2 sm:p-2.5 rounded-xl bg-white text-slate-500 hover:bg-rose-500 hover:text-white transition-all border border-slate-100" title="Hapus"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {error && <div className="mt-4 flex items-center gap-2 text-rose-500 font-bold text-sm bg-rose-50 rounded-xl p-3"><AlertTriangle size={16} /> {error}</div>}
                </div>
              </>
            ) : (
              <>
                <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 space-y-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button onClick={backToPeriodList} className="inline-flex items-center gap-2 text-xs font-black text-slate-400 hover:text-slate-700 transition-colors">
                      <ArrowLeft size={14} /> Kembali ke Daftar Semester
                    </button>

                    {activePeriod.id && (
                      <div className="relative">
                        <div className="inline-flex items-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm overflow-hidden">
                          <button
                            type="button"
                            onClick={() => exportRaporPdf(activePeriod.id, false)}
                            disabled={exportingId === activePeriod.id}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black hover:bg-emerald-100 transition-all disabled:opacity-50"
                            title="Unduh Rapor Saja (Hal 4–6 SD / Capaian TK)"
                          >
                            {exportingId === activePeriod.id ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />}
                            Unduh Rapor (Hal 4–6)
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenPdfMenuId(openPdfMenuId === 'activeHeader' ? null : 'activeHeader');
                            }}
                            disabled={exportingId === activePeriod.id}
                            className="px-2 py-2 border-l border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="Pilihan Versi Rapor"
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>

                        {openPdfMenuId === 'activeHeader' && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setOpenPdfMenuId(null)} />
                            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-40 text-left animate-in fade-in zoom-in-95 duration-150">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPdfMenuId(null);
                                  exportRaporPdf(activePeriod.id, false);
                                }}
                                className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 transition-colors group flex items-start gap-2.5"
                              >
                                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                                  <FileText size={13} />
                                </div>
                                <div>
                                  <p className="text-xs font-black text-slate-900 group-hover:text-emerald-700">Rapor Saja (Hal 4–6)</p>
                                  <p className="text-[10px] text-slate-400 font-medium">Hanya nilai & capaian (tiap semester)</p>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPdfMenuId(null);
                                  exportRaporPdf(activePeriod.id, true);
                                }}
                                className="w-full text-left p-2.5 rounded-xl hover:bg-secondary/10 transition-colors group flex items-start gap-2.5 mt-0.5"
                              >
                                <div className="w-6 h-6 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                                  <BookOpen size={13} />
                                </div>
                                <div>
                                  <p className="text-xs font-black text-slate-900 group-hover:text-secondary">Lengkap + Sampul (Hal 1–6)</p>
                                  <p className="text-[10px] text-slate-400 font-medium">Dengan cover & identitas peserta didik</p>
                                </div>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Profil ringkas sesuai kepala rapor: Kelas, Fase, Semester, Tahun Pelajaran */}
                  {!isTK && (
                    <div className="flex flex-wrap gap-2 text-[11px] font-black">
                      <span className="px-3 py-1.5 rounded-full bg-secondary/10 text-secondary">Kelas {KELAS_ROMAWI[activePeriod.form.kelas] || activePeriod.form.kelas}</span>
                      <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">Fase {FASE[activePeriod.form.kelas] || '-'}</span>
                      <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">Semester {SEMESTER_LABEL[activePeriod.form.semester] || '-'}</span>
                      {activePeriod.form.tahunAjaran && <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">TP {activePeriod.form.tahunAjaran}</span>}
                    </div>
                  )}

                  <div>
                    <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em] mb-2">Data Semester</h4>
                    <div className={`grid sm:grid-cols-2 ${expanded ? 'lg:grid-cols-3' : ''} gap-3`}>
                      {periodFieldsFor(activePeriod.form.kelas).map((f) => (
                        <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                          <Field field={f} value={activePeriod.form[f.name]} dense onChange={(v) => setActivePeriod((p) => ({ ...p, form: { ...p.form, [f.name]: v } }))} />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleSavePeriod}
                      disabled={saving}
                      className="mt-4 inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-black transition-all disabled:opacity-50"
                    >
                      {saving ? <><Loader2 className="animate-spin" size={16} /> Menyimpan…</> : 'Simpan Data Semester'}
                    </button>
                  </div>

                  {!activePeriod.id ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs font-bold text-amber-700">
                      Simpan data semester dulu sebelum menambah {isTK ? 'aspek perkembangan' : 'nilai mata pelajaran'}.
                    </div>
                  ) : (
                    <div className={subEditMode ? 'border-2 border-secondary/30 rounded-2xl p-4 space-y-6' : 'space-y-6'}>
                      {tables.map((t) => {
                        const saved = rowsOf(subData, t, activePeriod.id);
                        const draft = drafts[t.key] || [];
                        return (
                          <div key={t.key}>
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div>
                                {t.key === 'aspekAgama' && <h3 className="text-sm font-black text-slate-800 mb-1">Aspek Perkembangan</h3>}
                                <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em]">{t.title}</h4>
                              </div>
                              {subEditMode && (t.key === 'umum' || t.key === 'mulok' || t.key.startsWith('aspek')) && (
                                <button
                                  type="button"
                                  onClick={() => applyMasterTemplate(t.key)}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-secondary transition-colors"
                                  title={`Muat ulang susunan ${t.title} dari Master Mata Pelajaran ${activePeriod.form.kelas}`}
                                >
                                  <RefreshCw size={12} /> Muat Standar {activePeriod.form.kelas}
                                </button>
                              )}
                            </div>

                            {!subEditMode ? (
                              saved.length === 0 ? (
                                <div className="text-center py-6 px-4 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                                  <p className="font-bold text-slate-600 text-xs">Belum ada nilai tersimpan untuk {t.title.toLowerCase()}.</p>
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Klik tombol <b>Edit Nilai</b> di bawah — susunan mata pelajaran {activePeriod.form.kelas} otomatis terisi dan siap diberi nilai.
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <div className="overflow-x-auto -mx-1 px-1 mb-2 [touch-action:pan-x] [-webkit-overflow-scrolling:touch]">
                                    <table className="w-full min-w-[580px] border-separate border-spacing-x-2 border-spacing-y-1">
                                      <thead>
                                        <tr>
                                          <th className="text-left pb-1 font-black text-slate-400 text-[10px] uppercase tracking-wider">No</th>
                                          {t.fields.map((f) => (
                                            <th key={f.name} className="text-left pb-1 font-black text-slate-400 text-[10px] uppercase tracking-wider whitespace-nowrap">{f.label}</th>
                                          ))}
                                          {t.key === 'mulok' && <th className="text-left pb-1 font-black text-slate-400 text-[10px] uppercase tracking-wider whitespace-nowrap">Nilai (Huruf)</th>}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {saved.map((item, i) => (
                                          <tr key={item.id}>
                                            <td className="align-top pb-1 text-xs font-black text-slate-400 pr-1">{i + 1}</td>
                                            {t.fields.map((f) => (
                                              <td key={f.name} className="align-top pb-1">
                                                <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-2 text-xs font-semibold text-slate-800 min-h-[34px] whitespace-pre-wrap">
                                                  {item[f.name] || '—'}
                                                </div>
                                              </td>
                                            ))}
                                            {t.key === 'mulok' && (
                                              <td className="align-top pb-1">
                                                <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-2 text-xs font-semibold text-slate-800 min-h-[34px]">
                                                  {item.nilaiAngka ? terbilang(item.nilaiAngka) : '—'}
                                                </div>
                                              </td>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  {t.key === 'mulok' && (() => {
                                    const s = summarize(saved);
                                    return s && (
                                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
                                        <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">Jumlah Nilai: {fmtNum(s.jumlah)}</span>
                                        <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">Rata-Rata: {fmtNum(s.rata)}</span>
                                        <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">Peringkat: {activePeriod.form.peringkat || '—'}</span>
                                      </div>
                                    );
                                  })()}
                                </>
                              )
                            ) : (
                              <>
                                {draft.length > 0 && (
                                  <>
                                    <div className="sm:hidden flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mb-1 px-1">
                                      <span className="text-secondary font-black">↔</span> Geser tabel ke kanan untuk mengisi nilai
                                    </div>
                                    <div className="overflow-x-auto -mx-1 px-1 mb-2 [touch-action:pan-x] [-webkit-overflow-scrolling:touch]">
                                    <table className="w-full min-w-[580px] border-separate border-spacing-x-2 border-spacing-y-1">
                                      <thead>
                                        <tr>
                                          {t.fields.map((f) => (
                                            <th key={f.name} className="text-left pb-1 font-black text-slate-400 text-[10px] uppercase tracking-wider whitespace-nowrap">{f.label}</th>
                                          ))}
                                          <th className="w-8"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {draft.map((row) => (
                                          <tr key={row._key}>
                                            {t.fields.map((f) => (
                                              <td key={f.name} className="align-top pb-1">{renderEditCell(t, row, f)}</td>
                                            ))}
                                            <td className="align-top pb-1">
                                              <button onClick={() => removeDraftRow(t.key, row._key)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors" title="Hapus baris"><Trash2 size={14} /></button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </>
                              )}
                                <button onClick={() => addDraftRow(t)} className="inline-flex items-center gap-1.5 text-xs font-black text-secondary hover:underline">
                                  <Plus size={14} /> Tambah
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}

                      {isTK && (
                        <div>
                          <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em] mb-3">Catatan Guru</h4>
                          {subEditMode ? (
                            <textarea rows={5} value={catatanDraft} onChange={(e) => setCatatanDraft(e.target.value)} placeholder="Catatan perkembangan anak didik…" className={cellBase} />
                          ) : (
                            <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-3 text-xs font-semibold text-slate-800 min-h-[60px] whitespace-pre-wrap">{activePeriod.form.catatanWaliKelas || <span className="text-slate-400">Belum ada catatan.</span>}</div>
                          )}
                        </div>
                      )}

                      {!subEditMode ? (
                        <button
                          onClick={enterSubEditMode}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={cancelDraftSub} disabled={savingSub} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all disabled:opacity-50">Batal</button>
                          <button onClick={saveDraftSub} disabled={savingSub} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {savingSub ? <><Loader2 className="animate-spin" size={14} /> Menyimpan…</> : 'Simpan'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {error && <div className="flex items-center gap-2 text-rose-500 font-bold text-sm bg-rose-50 rounded-xl p-3"><AlertTriangle size={16} /> {error}</div>}
                  <datalist id="eraport-subjects-list">
                    {masterSubjects
                      .filter((s) => (activePeriod ? s.level === activePeriod.form.kelas || s.level === 'SD' : true) && s.isActive !== 0)
                      .map((s) => (
                        <option key={s.id || s.nama} value={s.nama} />
                      ))}
                  </datalist>
                </div>
                <ModalFooter>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Tombol Navigasi Siswa Sebelumnya & Berikutnya */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigateToStudent('prev')}
                        disabled={!hasPrevStudent || savingSub}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-all disabled:opacity-30 disabled:pointer-events-none"
                        title="Pindah ke siswa sebelumnya di kelas ini"
                      >
                        <ChevronLeft size={16} /> Siswa Sebelumnya
                      </button>

                      <button
                        type="button"
                        onClick={() => navigateToStudent('next')}
                        disabled={!hasNextStudent || savingSub}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-secondary text-white hover:brightness-95 font-black text-xs transition-all shadow-md shadow-secondary/20 disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                        title="Simpan & Lanjut ke siswa berikutnya di kelas ini"
                      >
                        Siswa Berikutnya <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={backToPeriodList} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all">
                        Kembali ke Daftar
                      </button>
                      {activePeriod.id && (
                        <div className="relative">
                          <div className="inline-flex items-center rounded-xl bg-emerald-600 text-white shadow-md overflow-hidden">
                            <button
                              type="button"
                              onClick={() => exportRaporPdf(activePeriod.id, false)}
                              disabled={exportingId === activePeriod.id || subEditMode}
                              title={subEditMode ? 'Simpan/Batal tabel nilai dulu' : 'Unduh Rapor Saja (Hal 4–6)'}
                              className="px-3.5 py-2.5 font-black text-xs hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              {exportingId === activePeriod.id ? <><Loader2 className="animate-spin" size={14} /> Membuat PDF…</> : <><FileDown size={14} /> Unduh Rapor (4–6)</>}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenPdfMenuId(openPdfMenuId === 'activeFooter' ? null : 'activeFooter');
                              }}
                              disabled={exportingId === activePeriod.id || subEditMode}
                              className="px-2 py-2.5 border-l border-emerald-500 text-white hover:bg-emerald-500 transition-colors"
                              title="Pilihan Versi Rapor"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>

                          {openPdfMenuId === 'activeFooter' && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setOpenPdfMenuId(null)} />
                              <div className="absolute right-0 bottom-full mb-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-40 text-left animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenPdfMenuId(null);
                                    exportRaporPdf(activePeriod.id, false);
                                  }}
                                  className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 transition-colors group flex items-start gap-2.5"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                                    <FileText size={13} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-slate-900 group-hover:text-emerald-700">Rapor Saja (Hal 4–6)</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Hanya nilai & capaian (tiap semester)</p>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenPdfMenuId(null);
                                    exportRaporPdf(activePeriod.id, true);
                                  }}
                                  className="w-full text-left p-2.5 rounded-xl hover:bg-secondary/10 transition-colors group flex items-start gap-2.5 mt-0.5"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                                    <BookOpen size={13} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-slate-900 group-hover:text-secondary">Lengkap + Sampul (Hal 1–6)</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Dengan cover & identitas peserta didik</p>
                                  </div>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </ModalFooter>
              </>
            )}
          </Modal>
        )}
      </AnimatePresence>

      {/* Konfirmasi hapus semester */}
      <AnimatePresence>
        {confirmingDeletePeriod && (
          <ConfirmDialog
            title="Hapus data semester ini?"
            message={<>Yakin mau menghapus <b className="text-slate-800">{periodTitle(confirmingDeletePeriod)} • {confirmingDeletePeriod.tahunAjaran}</b>? Semua nilai/aspek di dalamnya juga akan hilang dari tampilan. Tindakan ini permanen.</>}
            confirmLabel="Hapus"
            loading={deleting}
            onCancel={() => !deleting && setConfirmingDeletePeriod(null)}
            onConfirm={confirmDeletePeriod}
          />
        )}
      </AnimatePresence>

      {/* Modal Setup Semester Massal Se-Kelas (Batch Setup) */}
      <AnimatePresence>
        {showBatchModal && (
          <Modal
            title={`Setup Semester Massal — Kelas ${activeGrade}`}
            onClose={() => !savingBatch && setShowBatchModal(false)}
            maxWidthClass="max-w-lg"
          >
            <div className="p-6 md:p-8 space-y-4">
              <div className="p-3.5 rounded-2xl bg-secondary/10 border border-secondary/20 text-xs text-secondary-dark flex items-start gap-2.5">
                <Users size={16} className="text-secondary shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Fitur ini akan membuat atau memperbarui periode rapor semester untuk <b>seluruh siswa kelas {activeGrade}</b> sekaligus. Guru tidak perlu lagi mengetik Tahun Ajaran, Semester, Wali Kelas, dan Tanggal Rapor satu per satu ke setiap murid!
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Tahun Ajaran</label>
                    <input
                      type="text"
                      placeholder="mis. 2025/2026"
                      value={batchForm.tahunAjaran}
                      onChange={(e) => setBatchForm((f) => ({ ...f, tahunAjaran: e.target.value }))}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Semester</label>
                    <select
                      value={batchForm.semester}
                      onChange={(e) => setBatchForm((f) => ({ ...f, semester: e.target.value }))}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-secondary"
                    >
                      <option value="1">1 (Ganjil)</option>
                      <option value="2">2 (Genap)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Nama Wali Kelas / Guru Kelas</label>
                  <input
                    type="text"
                    placeholder="mis. Muhammad Khaidir, S.Pd."
                    value={batchForm.namaWaliKelas}
                    onChange={(e) => setBatchForm((f) => ({ ...f, namaWaliKelas: e.target.value }))}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-secondary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Tanggal Rapor</label>
                    <input
                      type="date"
                      value={batchForm.tanggalRapor}
                      onChange={(e) => setBatchForm((f) => ({ ...f, tanggalRapor: e.target.value }))}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Tanggal TTD Kepsek</label>
                    <input
                      type="date"
                      value={batchForm.tanggalIdentitas}
                      onChange={(e) => setBatchForm((f) => ({ ...f, tanggalIdentitas: e.target.value }))}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-secondary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Diberikan di (Tempat)</label>
                  <input
                    type="text"
                    placeholder="mis. Tanjung Rejo"
                    value={batchForm.tempatRapor}
                    onChange={(e) => setBatchForm((f) => ({ ...f, tempatRapor: e.target.value }))}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-secondary"
                  />
                </div>

                {/* Panel Opsi Hapus All Semester Ini (Bila salah input) */}
                {matchingBatchPeriods.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mt-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0 mt-0.5">
                        <Trash2 size={16} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h5 className="font-black text-rose-900 text-xs">Pembersihan / Hapus All Semester Ini</h5>
                        <p className="text-[11px] text-rose-700 font-medium mt-0.5 leading-relaxed">
                          Ditemukan <b>{matchingBatchPeriods.length} data semester</b> untuk TP {batchForm.tahunAjaran} Semester {batchForm.semester === '1' ? 'Ganjil' : 'Genap'} di kelas {activeGrade}. Jika Anda salah setup atau salah ketik tahun/semester, Anda dapat menghapus seluruh semester ini sekaligus se-kelas.
                        </p>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteBatchSemester(true)}
                          disabled={savingBatch || deletingBatch}
                          className="mt-3 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black rounded-xl uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {deletingBatch ? <><Loader2 size={13} className="animate-spin" /> Menghapus…</> : <><Trash2 size={13} /> Hapus All Semester Ini ({matchingBatchPeriods.length} Siswa)</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <ModalFooter>
              <div className="flex gap-2 justify-end w-full">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  disabled={savingBatch || deletingBatch}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApplyBatchSemester}
                  disabled={savingBatch || deletingBatch}
                  className="px-5 py-2.5 rounded-xl bg-secondary text-white font-black text-xs uppercase tracking-wider hover:brightness-95 transition-all shadow-md shadow-secondary/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {savingBatch ? <><Loader2 size={14} className="animate-spin" /> Menerapkan…</> : <><Check size={14} /> Terapkan ke Semua Siswa Kelas {activeGrade}</>}
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Konfirmasi Hapus Massal Semester Se-Kelas */}
      <AnimatePresence>
        {confirmingDeleteBatchSemester && (
          <ConfirmDialog
            title={`Hapus All Semester: Kelas ${activeGrade}?`}
            message={`PERINGATAN: Tindakan ini akan menghapus seluruh data rapor Semester ${batchForm.semester === '1' ? 'Ganjil' : 'Genap'} TP ${batchForm.tahunAjaran} untuk ${matchingBatchPeriods.length} siswa kelas ${activeGrade}, termasuk nilai mata pelajaran, aspek capaian, dan catatan wali kelas yang terhubung ke semester tersebut.\n\nApakah Anda yakin ingin menghapus seluruhnya?`}
            confirmLabel="Ya, Hapus Semua"
            cancelLabel="Batal"
            loading={deletingBatch}
            onConfirm={handleDeleteBatchSemester}
            onCancel={() => !deletingBatch && setConfirmingDeleteBatchSemester(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal Unduh E-Raport Kelas (Multi-Export) */}
      <AnimatePresence>
        {showMultiExportModal && (
          <Modal
            onClose={() => !exportingMulti && setShowMultiExportModal(false)}
            title={`Unduh E-Raport: Kelas ${activeGrade}`}
            maxWidthClass="max-w-3xl"
          >
            <div className="p-4 sm:p-6 md:p-8 space-y-5">
              {/* Filter Tahun Ajaran & Semester */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-black uppercase text-secondary tracking-wider">
                    1. Pilih Semester Rapor yang Ingin Diunduh
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Kelas {activeGrade}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Tahun Pelajaran</label>
                    <select
                      value={exportYear}
                      onChange={(e) => setExportYear(e.target.value)}
                      disabled={exportingMulti}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-secondary transition-all"
                    >
                      {classAvailableYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">Semester</label>
                    <select
                      value={exportSemester}
                      onChange={(e) => setExportSemester(e.target.value)}
                      disabled={exportingMulti}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-secondary transition-all"
                    >
                      <option value="1">1 (Ganjil)</option>
                      <option value="2">2 (Genap)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Cakupan Halaman Rapor (Hemat Kertas vs Lengkap) */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase text-secondary tracking-wider">
                  2. Pilih Cakupan Halaman Rapor
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => !exportingMulti && setExportPageRange('rapor_only')}
                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all ${
                      exportPageRange === 'rapor_only'
                        ? 'border-emerald-600 bg-emerald-50/50 text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={exportPageRange === 'rapor_only'}
                          onChange={() => setExportPageRange('rapor_only')}
                          className="accent-emerald-600"
                        />
                        <span className="font-black text-xs">Halaman Rapor Saja (Hal 4–6)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black shrink-0">
                        Hemat Kertas
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1.5 ml-5 leading-relaxed">
                      Tanpa Sampul & Identitas (Hal 1–3). Hanya mencetak lembar nilai akademik, capaian kompetensi, ekskul, dan catatan guru. Rekomendasi utama untuk cetak rutin tiap akhir semester!
                    </p>
                  </div>

                  <div
                    onClick={() => !exportingMulti && setExportPageRange('full')}
                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all ${
                      exportPageRange === 'full'
                        ? 'border-secondary bg-secondary/5 text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={exportPageRange === 'full'}
                        onChange={() => setExportPageRange('full')}
                        className="accent-secondary"
                      />
                      <span className="font-black text-xs">Versi Lengkap + Sampul (Hal 1–6)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1.5 ml-5 leading-relaxed">
                      Lengkap dengan Sampul Depan, Data Sekolah, Identitas Peserta Didik, dan Lembar Nilai. Sangat cocok untuk siswa baru masuk sekolah atau arsip awal tahun.
                    </p>
                  </div>
                </div>
              </div>

              {/* Format Unduh (Kompilasi All vs Terpisah) */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase text-secondary tracking-wider">
                  3. Pilih Format Dokumen PDF
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => !exportingMulti && setExportFormat('bundle')}
                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all ${
                      exportFormat === 'bundle'
                        ? 'border-secondary bg-secondary/5 text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={exportFormat === 'bundle'}
                        onChange={() => setExportFormat('bundle')}
                        className="accent-secondary"
                      />
                      <span className="font-black text-xs">1 File PDF Kompilasi (Gabungan)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1.5 ml-5 leading-relaxed">
                      Seluruh rapor murid terpilih digabung berurutan dalam 1 file PDF. Sangat praktis untuk langsung dicetak se-kelas ke printer/percetakan!
                    </p>
                  </div>

                  <div
                    onClick={() => !exportingMulti && setExportFormat('separate')}
                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all ${
                      exportFormat === 'separate'
                        ? 'border-secondary bg-secondary/5 text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={exportFormat === 'separate'}
                        onChange={() => setExportFormat('separate')}
                        className="accent-secondary"
                      />
                      <span className="font-black text-xs">File PDF Terpisah per Murid</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1.5 ml-5 leading-relaxed">
                      Tiap murid diunduh menjadi 1 file PDF masing-masing (diunduh berurutan otomatis satu per satu).
                    </p>
                  </div>
                </div>
              </div>

              {/* Daftar Pilihan Murid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-[11px] font-black uppercase text-secondary tracking-wider">
                    4. Pilih Murid ({selectedExportStudentIds.length} dari {(students || []).filter((s) => s.kelas === activeGrade).length} dipilih)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllExportStudents}
                      disabled={exportingMulti}
                      className="text-[11px] font-black text-secondary hover:underline px-2.5 py-1 rounded-lg bg-secondary/10"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllExportStudents}
                      disabled={exportingMulti}
                      className="text-[11px] font-black text-slate-500 hover:underline px-2.5 py-1 rounded-lg bg-slate-100"
                    >
                      Batal Pilih
                    </button>
                  </div>
                </div>

                {/* List Siswa (Overscroll contain & pan-y agar tidak macet di webview) */}
                <div className="max-h-64 sm:max-h-72 overflow-y-auto overscroll-contain divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white [touch-action:pan-y] [-webkit-overflow-scrolling:touch]">
                  {(students || [])
                    .filter((s) => s.kelas === activeGrade)
                    .map((stu, idx) => {
                      const isSelected = selectedExportStudentIds.includes(String(stu.id));
                      const matchPeriod = (periods || []).find(
                        (p) =>
                          String(p.studentId) === String(stu.id) &&
                          String(p.tahunAjaran) === String(exportYear) &&
                          String(p.semester) === String(exportSemester)
                      );
                      const isTK = activeGrade === 'TK';
                      const filledScores = matchPeriod
                        ? isTK
                          ? (subData.ReportAspects || []).filter((a) => String(a.reportPeriodId) === String(matchPeriod.id) && String(a.deskripsi || '').trim() !== '').length
                          : (subData.ReportGrades || []).filter((g) => String(g.reportPeriodId) === String(matchPeriod.id) && String(g.nilaiAngka || '').trim() !== '').length
                        : 0;

                      return (
                        <div
                          key={stu.id}
                          onClick={() => !exportingMulti && toggleExportStudent(stu.id)}
                          className={`p-3 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-secondary/5' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleExportStudent(stu.id)}
                              disabled={exportingMulti}
                              className="w-4 h-4 accent-secondary shrink-0"
                            />
                            <span className="font-bold text-slate-400 w-5 text-center shrink-0">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 truncate">{stu.nama_siswa}</p>
                              <p className="text-[10px] text-slate-400 font-medium truncate">
                                NISN: {stu.nisn || '-'} {stu.nis ? `• NIS: ${stu.nis}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {matchPeriod ? (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                filledScores > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                                {filledScores > 0 ? `✓ Rapor Siap (${filledScores} ${isTK ? 'aspek' : 'mapel'})` : 'Periode Ada (Nilai Kosong)'}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                                Belum Ada Semester Ini
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Progress Bar saat Eksekusi */}
              {exportingMulti && (
                <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-2 text-secondary">
                      <Loader2 size={14} className="animate-spin" /> Sedang Menghasilkan Dokumen PDF Rapor…
                    </span>
                    <span>
                      {exportProgress.current} / {exportProgress.total} Siswa
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary transition-all duration-300"
                      style={{ width: `${exportProgress.total ? (exportProgress.current / exportProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium italic truncate">
                    Memproses murid: <span className="font-bold text-slate-700">{exportProgress.currentName}</span>
                  </p>
                </div>
              )}
            </div>

            <ModalFooter>
              <div className="flex gap-2 justify-end w-full">
                <button
                  type="button"
                  onClick={() => setShowMultiExportModal(false)}
                  disabled={exportingMulti}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteMultiExport}
                  disabled={exportingMulti || selectedExportStudentIds.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-secondary text-white font-black text-xs uppercase tracking-wider hover:brightness-95 transition-all shadow-md shadow-secondary/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {exportingMulti ? (
                    <><Loader2 size={14} className="animate-spin" /> Memproses…</>
                  ) : (
                    <><FileDown size={14} /> Unduh {selectedExportStudentIds.length} Rapor Murid</>
                  )}
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Konfirmasi Murid Dilewati saat Ekspor Rapor Multi */}
      <AnimatePresence>
        {confirmingMultiExportSkip && (
          <ConfirmDialog
            type="warning"
            title="Sebagian Murid Dilewati"
            message={`${confirmingMultiExportSkip.missingNames.length} murid (${confirmingMultiExportSkip.missingNames.slice(0, 3).join(', ')}${confirmingMultiExportSkip.missingNames.length > 3 ? '...' : ''}) belum memiliki periode rapor pada Semester ${exportSemester === '1' ? 'Ganjil' : 'Genap'} TP ${exportYear}.\n\nApakah Anda ingin tetap melanjutkan mengunduh ${confirmingMultiExportSkip.readyTargets.length} murid yang sudah memiliki data rapor?`}
            confirmLabel="Lanjutkan Unduh"
            cancelLabel="Batal"
            onConfirm={() => {
              const targets = confirmingMultiExportSkip.readyTargets;
              setConfirmingMultiExportSkip(null);
              startGeneratingMultiRapor(targets);
            }}
            onCancel={() => setConfirmingMultiExportSkip(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast Notifikasi Modern (Tengah Atas) */}
      <AnimatePresence>
        {toast && (
          <ToastNotification
            toast={toast}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
