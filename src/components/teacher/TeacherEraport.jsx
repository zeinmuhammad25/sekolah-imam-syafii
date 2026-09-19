import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Search, Plus, Pencil, Trash2, ArrowLeft, Loader2, AlertTriangle, FileBarChart2, FileDown } from 'lucide-react';
import { fetchSchoolData, mutateRow, formatSheetDate } from '../../services/gsheet';
import { Modal, ModalFooter, ConfirmDialog, Field } from './ModalKit';

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

const draftsFrom = (kelas, periodId, data) =>
  Object.fromEntries(tablesFor(kelas).map((t) => [t.key, rowsOf(data, t, periodId).map((item) => ({
    _key: String(item.id), id: item.id, updatedAt: item.updatedAt,
    ...Object.fromEntries(t.fields.map((f) => [f.name, item[f.name] != null ? String(item[f.name]) : ''])),
  }))]));

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
  if (res && res.conflict) return 'Data ini baru saja diubah dari perangkat/guru lain. Silakan buka lagi dan ulangi.';
  return (res && res.error) || 'Tidak diketahui — periksa koneksi lalu coba lagi.';
};

const cellBase = 'w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-secondary transition-all';

export default function TeacherEraport() {
  const [students, setStudents] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [subData, setSubData] = useState(EMPTY_SUBDATA); // { ReportGrades, ReportAspects, ReportExtras }
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

  const load = async () => {
    const d = await fetchSchoolData();
    setStudents((d && d.Students) || []);
    setPeriods((d && d.ReportPeriods) || []);
    setSubData({
      ReportGrades: (d && d.ReportGrades) || [],
      ReportAspects: (d && d.ReportAspects) || [],
      ReportExtras: (d && d.ReportExtras) || [],
    });
  };
  useEffect(() => { load(); }, []);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (s.kelas !== activeGrade) return false;
      if (!q) return true;
      return String(s.nama_siswa || '').toLowerCase().includes(q);
    });
  }, [students, activeGrade, query]);

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
    setDrafts(draftsFrom(p.kelas, p.id, subData));
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
      ? await mutateRow({ action: 'update', sheetName: 'ReportPeriods', id: activePeriod.id, expectedUpdatedAt: activePeriod.updatedAt, row })
      : await mutateRow({ action: 'add', sheetName: 'ReportPeriods', row });
    setSaving(false);
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
    const res = await mutateRow({ action: 'delete', sheetName: 'ReportPeriods', id: confirmingDeletePeriod.id });
    setDeleting(false);
    if (!res.success) { setConfirmingDeletePeriod(null); setError('Gagal menghapus: ' + describeError(res)); return; }
    setPeriods((prev) => prev.filter((p) => String(p.id) !== String(confirmingDeletePeriod.id)));
    setConfirmingDeletePeriod(null);
    if (activePeriod && activePeriod.id === confirmingDeletePeriod.id) setActivePeriod(null);
  };

  // ---- Tabel nilai / aspek / ekskul — banyak baris, sekali Simpan ----
  const isTK = !!activePeriod && activePeriod.form.kelas === 'TK';
  const tables = activePeriod ? tablesFor(activePeriod.form.kelas) : [];

  const enterSubEditMode = () => {
    setDrafts(draftsFrom(activePeriod.form.kelas, activePeriod.id, subData));
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
  const updateDraftCell = (tk, key, name, value) =>
    setDrafts((d) => ({ ...d, [tk]: (d[tk] || []).map((r) => (r._key === key ? { ...r, [name]: value } : r)) }));
  const removeDraftRow = (tk, key) => {
    const row = (drafts[tk] || []).find((r) => r._key === key);
    if (row && row.id) setRemoved((rm) => ({ ...rm, [tk]: [...(rm[tk] || []), row.id] }));
    setDrafts((d) => ({ ...d, [tk]: (d[tk] || []).filter((r) => r._key !== key) }));
  };
  const cancelDraftSub = () => {
    setDrafts(draftsFrom(activePeriod.form.kelas, activePeriod.id, subData));
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
    setSavingSub(true);
    let firstError = '';
    const local = { ReportGrades: [...subData.ReportGrades], ReportAspects: [...subData.ReportAspects], ReportExtras: [...subData.ReportExtras] };

    for (const t of tables) {
      const rows = (drafts[t.key] || []).filter((r) => hasContent(t, r));
      for (const r of rows) {
        let row = { reportPeriodId: activePeriod.id, ...Object.fromEntries(t.fields.map((f) => [f.name, String(r[f.name] ?? '').trim()])) };
        if (t.kelompok) row.kelompok = t.kelompok;
        if (t.finalize) row = t.finalize(row);
        const res = r.id
          ? await mutateRow({ action: 'update', sheetName: t.sheet, id: r.id, expectedUpdatedAt: r.updatedAt, row })
          : await mutateRow({ action: 'add', sheetName: t.sheet, row });
        if (!res.success) { if (!firstError) firstError = describeError(res); continue; }
        const savedId = r.id || res.id;
        const merged = { ...row, id: savedId, updatedAt: res.updatedAt };
        local[t.sheet] = r.id ? local[t.sheet].map((x) => (String(x.id) === String(savedId) ? merged : x)) : [...local[t.sheet], merged];
      }
      for (const id of (removed[t.key] || [])) {
        const res = await mutateRow({ action: 'delete', sheetName: t.sheet, id });
        if (!res.success) { if (!firstError) firstError = describeError(res); continue; }
        local[t.sheet] = local[t.sheet].filter((x) => String(x.id) !== String(id));
      }
    }

    // TK: Catatan Guru = kolom catatanWaliKelas di baris semester (versi `updatedAt` dijaga)
    if (isTK && catatanDraft.trim() !== String(activePeriod.form.catatanWaliKelas || '').trim()) {
      const row = { catatanWaliKelas: catatanDraft.trim() };
      const res = await mutateRow({ action: 'update', sheetName: 'ReportPeriods', id: activePeriod.id, expectedUpdatedAt: activePeriod.updatedAt, row });
      if (res.success) {
        setActivePeriod((p) => ({ ...p, updatedAt: res.updatedAt, form: { ...p.form, ...row } }));
        setPeriods((prev) => prev.map((p) => (String(p.id) === String(activePeriod.id) ? { ...p, ...row, updatedAt: res.updatedAt } : p)));
      } else if (!firstError) firstError = 'Catatan Guru: ' + describeError(res);
    }

    setSubData(local);
    setSavingSub(false);
    setRemoved({});
    setDrafts(draftsFrom(activePeriod.form.kelas, activePeriod.id, local));
    if (firstError) setError('Sebagian data gagal disimpan: ' + firstError);
    else setSubEditMode(false);
  };

  const renderEditCell = (t, row, f) => {
    const common = { value: row[f.name], onChange: (e) => updateDraftCell(t.key, row._key, f.name, e.target.value) };
    if (f.type === 'textarea') return <textarea rows={f.rows || 1} {...common} className={`${cellBase} ${f.w || ''}`} />;
    if (f.type === 'select') {
      return (
        <select {...common} className={`${cellBase} ${f.w || ''}`}>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return <input {...common} placeholder={f.placeholder} inputMode={f.score ? 'decimal' : undefined} className={`${cellBase} ${f.w || ''}`} />;
  };

  // Unduh rapor PDF (format sama dengan rapor sekolah) — memakai data TERSIMPAN, bukan isian form yang belum disimpan.
  const exportRaporPdf = async (periodId) => {
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
      });
      doc.save(raporFileName(stu, saved));
    } catch (e) {
      setError('Gagal membuat PDF: ' + String((e && e.message) || e));
    } finally {
      setExportingId(null);
    }
  };

  const periodTitle = (p) => `${KELAS_ROMAWI[p.kelas] ? `Kelas ${KELAS_ROMAWI[p.kelas]}` : p.kelas} • Semester ${SEMESTER_LABEL[p.semester] || p.semester}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">E-Raport</h2>
          <p className="text-slate-400 font-bold text-sm mt-1">
            {students === null ? 'Memuat…' : `${filteredStudents.length} siswa • Kelas ${activeGrade}`}
          </p>
        </div>
      </div>

      {/* Tab kelas */}
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

      {/* Cari siswa */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama siswa…"
          className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-11 pr-4 py-3.5 font-bold text-slate-800 outline-none focus:border-secondary transition-all"
        />
      </div>

      {/* Daftar siswa */}
      {students === null ? (
        <div className="flex justify-center py-20 text-slate-300"><Loader2 className="animate-spin" size={32} /></div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold">Tidak ada siswa di kelas {activeGrade}.</div>
      ) : (
        <div className="grid gap-3">
          {filteredStudents.map((s) => {
            const count = periods.filter((p) => String(p.studentId) === String(s.id)).length;
            return (
              <button
                key={s.id}
                onClick={() => openStudent(s)}
                className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-secondary/40 hover:shadow-md transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                  <FileBarChart2 size={18} />
                </div>
                <div className="min-w-0 flex-grow">
                  <p className="font-black text-slate-900 truncate">{s.nama_siswa || '(tanpa nama)'}</p>
                  <p className="text-slate-400 font-bold text-xs truncate">{count} semester tercatat</p>
                </div>
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
                <div className="px-6 md:px-8 py-5">
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
                        <div key={p.id} className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                          <div className="min-w-0 flex-grow">
                            <p className="font-black text-slate-900 text-sm">{periodTitle(p)}</p>
                            <p className="text-slate-400 font-bold text-xs">Tahun Pelajaran {p.tahunAjaran}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {(
                              <button onClick={() => exportRaporPdf(p.id)} disabled={exportingId === p.id} className="p-2.5 rounded-xl bg-white text-slate-500 hover:bg-emerald-600 hover:text-white transition-all border border-slate-100 disabled:opacity-50" title="Unduh Rapor (PDF)">
                                {exportingId === p.id ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
                              </button>
                            )}
                            <button onClick={() => openEditPeriod(p)} className="p-2.5 rounded-xl bg-white text-slate-500 hover:bg-secondary hover:text-white transition-all border border-slate-100" title="Buka"><Pencil size={16} /></button>
                            <button onClick={() => setConfirmingDeletePeriod(p)} className="p-2.5 rounded-xl bg-white text-slate-500 hover:bg-rose-500 hover:text-white transition-all border border-slate-100" title="Hapus"><Trash2 size={16} /></button>
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
                <div className="px-6 md:px-8 py-5 space-y-5">
                  <button onClick={backToPeriodList} className="inline-flex items-center gap-2 text-xs font-black text-slate-400 hover:text-slate-700 transition-colors">
                    <ArrowLeft size={14} /> Kembali ke Daftar Semester
                  </button>

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
                            {t.key === 'aspekAgama' && <h3 className="text-sm font-black text-slate-800 mb-3">Aspek Perkembangan</h3>}
                            <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em] mb-3">{t.title}</h4>

                            {!subEditMode ? (
                              saved.length === 0 ? (
                                <div className="text-center py-5 text-slate-400 font-bold text-sm bg-slate-50 rounded-xl">Belum ada data.</div>
                              ) : (
                                <>
                                  <div className="overflow-x-auto -mx-1 px-1">
                                    <table className="w-full border-separate border-spacing-x-2 border-spacing-y-1">
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
                                  <div className="overflow-x-auto -mx-1 px-1 mb-2">
                                    <table className="w-full border-separate border-spacing-x-2 border-spacing-y-1">
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
                </div>
                <ModalFooter>
                  <div className="flex gap-3">
                    <button onClick={backToPeriodList} className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all">
                      Kembali
                    </button>
                    {activePeriod.id && (
                      <button onClick={() => exportRaporPdf(activePeriod.id)} disabled={exportingId === activePeriod.id || subEditMode} title={subEditMode ? 'Simpan/Batal tabel nilai dulu' : 'Unduh Rapor (PDF)'} className="flex-1 py-3.5 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {exportingId === activePeriod.id ? <><Loader2 className="animate-spin" size={16} /> Membuat PDF…</> : <><FileDown size={16} /> Unduh Rapor (PDF)</>}
                      </button>
                    )}
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
    </div>
  );
}
