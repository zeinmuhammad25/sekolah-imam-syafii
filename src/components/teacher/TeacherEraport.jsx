import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Search, Plus, Pencil, Trash2, ArrowLeft, Loader2, AlertTriangle, FileBarChart2 } from 'lucide-react';
import { fetchSchoolData, mutateRow } from '../../services/gsheet';
import { Modal, ModalFooter, ConfirmDialog, Field } from './ModalKit';

// Taksonomi kelas — sama dengan Data Siswa.
const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6', 'Tamat'];
const SEMESTER_OPTIONS = ['1', '2'];

// Field milik 1 semester (ReportPeriods) — tidak termasuk nilai per mapel/aspek (itu tabel terpisah).
const PERIOD_FIELDS = [
  { name: 'tahunAjaran', label: 'Tahun Ajaran', type: 'text', required: true, placeholder: 'mis. 2026/2027' },
  { name: 'semester', label: 'Semester', type: 'select', required: true, options: SEMESTER_OPTIONS },
  { name: 'sikapSpiritual', label: 'Sikap Spiritual', type: 'textarea', rows: 2 },
  { name: 'sikapSosial', label: 'Sikap Sosial', type: 'textarea', rows: 2 },
  { name: 'kehadiranSakit', label: 'Sakit (hari)', type: 'text' },
  { name: 'kehadiranIzin', label: 'Izin (hari)', type: 'text' },
  { name: 'kehadiranAlpa', label: 'Alpa (hari)', type: 'text' },
  { name: 'ekstrakurikuler', label: 'Ekstrakurikuler', type: 'text' },
  { name: 'catatanWaliKelas', label: 'Catatan Wali Kelas', type: 'textarea', rows: 3 },
];
const emptyPeriodForm = (kelas) => ({
  ...Object.fromEntries(PERIOD_FIELDS.map((f) => [f.name, ''])),
  semester: '1',
  kelas,
});

// Nilai mapel (SD) vs aspek perkembangan (TK) — dua bentuk beda, bukan dipaksa satu tabel.
const GRADE_SUBFIELDS = [
  { name: 'mataPelajaran', label: 'Mata Pelajaran', type: 'text', required: true },
  { name: 'nilaiAngka', label: 'Nilai Angka', type: 'text' },
  { name: 'predikat', label: 'Predikat', type: 'text', placeholder: 'A / B / C / D' },
  { name: 'deskripsiCapaian', label: 'Deskripsi Capaian', type: 'textarea', rows: 2 },
];
const ASPECT_SUBFIELDS = [
  { name: 'aspek', label: 'Aspek Perkembangan', type: 'text', required: true, placeholder: 'mis. Nilai Agama & Budi Pekerti' },
  { name: 'deskripsi', label: 'Deskripsi Perkembangan', type: 'textarea', rows: 3 },
];
const describeError = (res) => {
  if (res && res.conflict) return 'Data ini baru saja diubah dari perangkat/guru lain. Silakan buka lagi dan ulangi.';
  return (res && res.error) || 'Tidak diketahui — periksa koneksi lalu coba lagi.';
};

export default function TeacherEraport() {
  const [students, setStudents] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [grades, setGrades] = useState([]);
  const [aspects, setAspects] = useState([]);
  const [activeGrade, setActiveGrade] = useState('TK');
  const [query, setQuery] = useState('');

  const [selectedStudent, setSelectedStudent] = useState(null); // siswa yang dibuka riwayat raport-nya
  const [activePeriod, setActivePeriod] = useState(null); // {id, updatedAt, form} — null = lihat daftar semester
  const [expanded, setExpanded] = useState(false);
  const [subDraft, setSubDraft] = useState([]); // baris nilai mapel/aspek yang sedang diedit (tabel sekali simpan)
  const [removedSubIds, setRemovedSubIds] = useState([]); // id baris tersimpan yang dihapus dari tabel, efektif saat Simpan
  const [subEditMode, setSubEditMode] = useState(false); // false = tampilan ringkas (cuma tombol Edit), true = tabel input
  const [confirmingDeletePeriod, setConfirmingDeletePeriod] = useState(null);

  const [saving, setSaving] = useState(false);
  const [savingSub, setSavingSub] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const rowKeyRef = useRef(0);

  const load = async () => {
    const d = await fetchSchoolData();
    const fresh = {
      students: (d && d.Students) || [],
      periods: (d && d.ReportPeriods) || [],
      grades: (d && d.ReportGrades) || [],
      aspects: (d && d.ReportAspects) || [],
    };
    setStudents(fresh.students);
    setPeriods(fresh.periods);
    setGrades(fresh.grades);
    setAspects(fresh.aspects);
    return fresh;
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

  const openStudent = (student) => { setSelectedStudent(student); setActivePeriod(null); setExpanded(false); setError(''); };
  const closeStudent = () => { setSelectedStudent(null); setActivePeriod(null); setSubDraft([]); setRemovedSubIds([]); setSubEditMode(false); };

  // Bangun baris draft tabel nilai mapel/aspek dari data tersimpan (grades/aspects) untuk 1 periode.
  const draftFrom = (periodKelas, periodId, gradesArr, aspectsArr) => {
    const fields = periodKelas === 'TK' ? ASPECT_SUBFIELDS : GRADE_SUBFIELDS;
    const source = periodKelas === 'TK' ? aspectsArr : gradesArr;
    return source
      .filter((r) => String(r.reportPeriodId) === String(periodId))
      .map((item) => ({
        _key: String(item.id), id: item.id, updatedAt: item.updatedAt,
        ...Object.fromEntries(fields.map((f) => [f.name, item[f.name] != null ? String(item[f.name]) : ''])),
      }));
  };

  const openAddPeriod = () => {
    setError('');
    setActivePeriod({ id: null, updatedAt: null, form: emptyPeriodForm(selectedStudent.kelas) });
    setSubDraft([]); setRemovedSubIds([]); setSubEditMode(false);
  };
  const openEditPeriod = (p) => {
    setError('');
    const form = { kelas: p.kelas };
    PERIOD_FIELDS.forEach((f) => { form[f.name] = p[f.name] != null ? String(p[f.name]) : ''; });
    setActivePeriod({ id: p.id, updatedAt: p.updatedAt, form });
    setSubDraft(draftFrom(p.kelas, p.id, grades, aspects));
    setRemovedSubIds([]); setSubEditMode(false);
  };
  const backToPeriodList = () => { setActivePeriod(null); setSubDraft([]); setRemovedSubIds([]); setSubEditMode(false); };

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

  // ---- Nilai mapel (SD) / aspek perkembangan (TK) — tabel banyak baris, sekali Simpan ----
  const isTK = activePeriod && activePeriod.form.kelas === 'TK';
  const subFields = isTK ? ASPECT_SUBFIELDS : GRADE_SUBFIELDS;
  const subSheetName = isTK ? 'ReportAspects' : 'ReportGrades';
  const subRequiredField = subFields.find((f) => f.required);
  const savedSubItems = useMemo(() => {
    if (!activePeriod || !activePeriod.id) return [];
    const source = isTK ? aspects : grades;
    return source.filter((r) => String(r.reportPeriodId) === String(activePeriod.id));
  }, [activePeriod, grades, aspects, isTK]);

  const enterSubEditMode = () => {
    setSubDraft(draftFrom(activePeriod.form.kelas, activePeriod.id, grades, aspects));
    setRemovedSubIds([]);
    setError('');
    setSubEditMode(true);
  };

  const addDraftRow = () => {
    rowKeyRef.current += 1;
    const blank = { _key: `new-${rowKeyRef.current}`, id: null, updatedAt: null, ...Object.fromEntries(subFields.map((f) => [f.name, ''])) };
    setSubDraft((rows) => [...rows, blank]);
  };
  const updateDraftCell = (key, name, value) => setSubDraft((rows) => rows.map((r) => (r._key === key ? { ...r, [name]: value } : r)));
  const removeDraftRow = (key) => {
    setSubDraft((rows) => {
      const row = rows.find((r) => r._key === key);
      if (row && row.id) setRemovedSubIds((ids) => [...ids, row.id]);
      return rows.filter((r) => r._key !== key);
    });
  };
  const cancelDraftSub = () => {
    setSubDraft(draftFrom(activePeriod.form.kelas, activePeriod.id, grades, aspects));
    setRemovedSubIds([]); setError(''); setSubEditMode(false);
  };

  const saveDraftSub = async () => {
    setError('');
    const rowsToSave = subDraft.filter((r) => subFields.some((f) => String(r[f.name] || '').trim()));
    if (subRequiredField) {
      const missing = rowsToSave.find((r) => !String(r[subRequiredField.name] || '').trim());
      if (missing) { setError(`"${subRequiredField.label}" wajib diisi di setiap baris`); return; }
    }
    setSavingSub(true);
    let firstError = '';
    const isTKLocal = isTK;
    let localSource = isTKLocal ? [...aspects] : [...grades];

    for (const r of rowsToSave) {
      const row = { reportPeriodId: activePeriod.id, ...Object.fromEntries(subFields.map((f) => [f.name, r[f.name]])) };
      const res = r.id
        ? await mutateRow({ action: 'update', sheetName: subSheetName, id: r.id, expectedUpdatedAt: r.updatedAt, row })
        : await mutateRow({ action: 'add', sheetName: subSheetName, row });
      if (!res.success) { if (!firstError) firstError = describeError(res); continue; }
      const savedId = r.id || res.id;
      const merged = { ...row, id: savedId, updatedAt: res.updatedAt };
      localSource = r.id ? localSource.map((x) => (String(x.id) === String(savedId) ? merged : x)) : [...localSource, merged];
    }
    for (const id of removedSubIds) {
      const res = await mutateRow({ action: 'delete', sheetName: subSheetName, id });
      if (!res.success) { if (!firstError) firstError = describeError(res); continue; }
      localSource = localSource.filter((x) => String(x.id) !== String(id));
    }

    if (isTKLocal) setAspects(localSource); else setGrades(localSource);
    setSavingSub(false);
    setRemovedSubIds([]);
    setSubDraft(draftFrom(activePeriod.form.kelas, activePeriod.id, isTKLocal ? grades : localSource, isTKLocal ? localSource : aspects));
    if (firstError) setError('Sebagian data gagal disimpan: ' + firstError);
    else setSubEditMode(false);
  };

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
            expandedWidthClass="max-w-5xl"
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
                            <p className="font-black text-slate-900 text-sm">{p.kelas} • Semester {p.semester}</p>
                            <p className="text-slate-400 font-bold text-xs">Tahun Ajaran {p.tahunAjaran}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
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

                  <div>
                    <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em] mb-2">Data Semester</h4>
                    <div className={`grid sm:grid-cols-2 ${expanded ? 'lg:grid-cols-3' : ''} gap-3`}>
                      {PERIOD_FIELDS.map((f) => (
                        <div key={f.name}>
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
                    <div className={subEditMode ? 'border-2 border-secondary/30 rounded-2xl p-4' : ''}>
                      <h4 className="text-[11px] font-black text-secondary uppercase tracking-[0.15em] mb-3">
                        {isTK ? 'Aspek Perkembangan' : 'Nilai Mata Pelajaran'}
                      </h4>

                      {!subEditMode ? (
                        <>
                          {savedSubItems.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 font-bold text-sm bg-slate-50 rounded-xl mb-3">Belum ada data.</div>
                          ) : (
                            <div className="overflow-x-auto -mx-1 px-1 mb-3">
                              <table className="w-full border-separate border-spacing-x-2 border-spacing-y-1">
                                <thead>
                                  <tr>
                                    {subFields.map((f) => (
                                      <th key={f.name} className="text-left pb-1 font-black text-slate-400 text-[10px] uppercase tracking-wider whitespace-nowrap">{f.label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {savedSubItems.map((item) => (
                                    <tr key={item.id}>
                                      {subFields.map((f) => (
                                        <td key={f.name} className="align-top pb-1">
                                          <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-2 text-xs font-semibold text-slate-800 min-h-[34px]">
                                            {item[f.name] || '—'}
                                          </div>
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <button
                            onClick={enterSubEditMode}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        </>
                      ) : (
                        <>
                          {subDraft.length > 0 && (
                            <div className="overflow-x-auto -mx-1 px-1 mb-2">
                              <table className="w-full border-separate border-spacing-x-2 border-spacing-y-1">
                                <thead>
                                  <tr>
                                    {subFields.map((f) => (
                                      <th key={f.name} className="text-left pb-1 font-black text-slate-400 text-[10px] uppercase tracking-wider whitespace-nowrap">{f.label}</th>
                                    ))}
                                    <th className="w-8"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {subDraft.map((row) => (
                                    <tr key={row._key}>
                                      {subFields.map((f) => (
                                        <td key={f.name} className="align-top pb-1">
                                          {f.type === 'textarea' ? (
                                            <textarea
                                              rows={1}
                                              value={row[f.name]}
                                              onChange={(e) => updateDraftCell(row._key, f.name, e.target.value)}
                                              className="w-full min-w-[140px] bg-slate-50 border-2 border-slate-100 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-secondary transition-all"
                                            />
                                          ) : (
                                            <input
                                              value={row[f.name]}
                                              placeholder={f.placeholder}
                                              onChange={(e) => updateDraftCell(row._key, f.name, e.target.value)}
                                              className="w-full min-w-[90px] bg-slate-50 border-2 border-slate-100 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:border-secondary transition-all"
                                            />
                                          )}
                                        </td>
                                      ))}
                                      <td className="align-top pb-1">
                                        <button onClick={() => removeDraftRow(row._key)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors" title="Hapus baris"><Trash2 size={14} /></button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          <button onClick={addDraftRow} className="inline-flex items-center gap-1.5 text-xs font-black text-secondary hover:underline">
                            <Plus size={14} /> Tambah
                          </button>

                          <div className="flex gap-2 mt-4">
                            <button onClick={cancelDraftSub} disabled={savingSub} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all disabled:opacity-50">Batal</button>
                            <button onClick={saveDraftSub} disabled={savingSub} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                              {savingSub ? <><Loader2 className="animate-spin" size={14} /> Menyimpan…</> : 'Simpan'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {error && <div className="flex items-center gap-2 text-rose-500 font-bold text-sm bg-rose-50 rounded-xl p-3"><AlertTriangle size={16} /> {error}</div>}
                </div>
                <ModalFooter>
                  <button onClick={backToPeriodList} className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all">
                    Kembali ke Daftar Semester
                  </button>
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
            message={<>Yakin mau menghapus <b className="text-slate-800">{confirmingDeletePeriod.kelas} • Semester {confirmingDeletePeriod.semester} • {confirmingDeletePeriod.tahunAjaran}</b>? Semua nilai/aspek di dalamnya juga akan hilang dari tampilan. Tindakan ini permanen.</>}
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
