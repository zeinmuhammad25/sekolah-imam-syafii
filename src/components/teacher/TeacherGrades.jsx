import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Award, Search, Check, Eye, EyeOff, Calendar, Users, Save, X,
  FileText, ExternalLink, RefreshCw, AlertTriangle, Loader2, Sparkles,
  Send, Lock, ChevronRight, FileDown, MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchSchoolData, mutateRow } from '../../services/gsheet';
import { Modal, ModalFooter } from './ModalKit';

const ALL_GRADES = [
  { key: 'TK', label: 'TK', fase: 'Fondasi' },
  { key: 'SD 1', label: 'Kelas 1', fase: 'Fase A' },
  { key: 'SD 2', label: 'Kelas 2', fase: 'Fase A' },
  { key: 'SD 3', label: 'Kelas 3', fase: 'Fase B' },
  { key: 'SD 4', label: 'Kelas 4', fase: 'Fase B' },
  { key: 'SD 5', label: 'Kelas 5', fase: 'Fase C' },
  { key: 'SD 6', label: 'Kelas 6', fase: 'Fase C' },
];

const SEMESTER_OPTIONS = [
  { key: '1', label: 'Semester 1 (Ganjil)' },
  { key: '2', label: 'Semester 2 (Genap)' },
];

export default function TeacherGrades() {
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [semester, setSemester] = useState('1');
  const [students, setStudents] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [grades, setGrades] = useState([]);
  const [aspects, setAspects] = useState([]);
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Modal Rekap Siswa Kelas
  const [inspectGrade, setInspectGrade] = useState(null); // grade object yang sedang dibuka rekapnya
  const [inspectSearch, setInspectSearch] = useState('');

  // Modal Catatan Pengumuman
  const [notesModal, setNotesModal] = useState(null); // { grade, pub }
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await fetchSchoolData();
      setStudents((d && d.Students) || []);
      setPeriods((d && d.ReportPeriods) || []);
      setGrades((d && d.ReportGrades) || []);
      setAspects((d && d.ReportAspects) || []);
      setPublications((d && d.GradePublications) || []);
    } catch (e) {
      setError('Gagal memuat data publikasi nilai.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map publikasi berdasarkan "grade|academicYear|semester" (dinormalisasi spasi)
  const pubMap = useMemo(() => {
    const map = new Map();
    publications.forEach((p) => {
      const gradeKey = String(p.grade || '').trim();
      const yearKey = String(p.academicYear || p.academic_year || '').replace(/\s+/g, '');
      const semKey = String(p.semester || '').trim();
      const key = `${gradeKey}|${yearKey}|${semKey}`;
      map.set(key, p);
    });
    return map;
  }, [publications]);

  // Statistik per kelas
  const gradeStats = useMemo(() => {
    const normYear = String(academicYear || '').replace(/\s+/g, '');
    const normSem = String(semester || '').trim();

    return ALL_GRADES.map((g) => {
      const isTK = g.key === 'TK';
      const classStudents = students.filter((s) => s.kelas === g.key);
      const studentIds = new Set(classStudents.map((s) => String(s.id)));

      // Cari rapor semester murid di kelas ini
      const classPeriods = periods.filter(
        (p) =>
          studentIds.has(String(p.studentId || p.student_id)) &&
          String(p.semester || '').trim() === normSem &&
          String(p.tahunAjaran || p.tahun_ajaran || '').replace(/\s+/g, '') === normYear
      );

      // Cari murid yang sudah ada baris nilainya (atau aspek untuk TK)
      const filledStudentIds = new Set();
      classPeriods.forEach((p) => {
        const pId = String(p.id);
        if (isTK) {
          const hasAspects = aspects.some(
            (a) =>
              String(a.reportPeriodId || a.report_period_id) === pId &&
              String(a.deskripsi || '').trim() !== ''
          );
          if (hasAspects) filledStudentIds.add(String(p.studentId || p.student_id));
        } else {
          const hasGrades = grades.some(
            (gr) =>
              String(gr.reportPeriodId || gr.report_period_id) === pId &&
              String(gr.nilaiAngka || gr.nilai_angka || '').trim() !== ''
          );
          if (hasGrades) filledStudentIds.add(String(p.studentId || p.student_id));
        }
      });

      const pubKey = `${g.key}|${normYear}|${normSem}`;
      const pub = pubMap.get(pubKey);
      const isPublished = pub ? Number(pub.isPublished ?? pub.is_published) === 1 : false;

      return {
        ...g,
        totalStudents: classStudents.length,
        filledCount: filledStudentIds.size,
        periodCount: classPeriods.length,
        isPublished,
        publication: pub || null,
        classStudents,
        classPeriods,
      };
    });
  }, [students, periods, grades, aspects, pubMap, academicYear, semester]);

  // Toggle Posting / Terbitkan ke Wali Murid
  const handleTogglePublish = async (g) => {
    const pubKey = `${g.key}|${academicYear}|${semester}`;
    const pub = g.publication;
    const nextState = g.isPublished ? 0 : 1;
    const now = Date.now();

    try {
      if (pub && pub.id) {
        const res = await mutateRow({
          action: 'update',
          sheetName: 'GradePublications',
          id: pub.id,
          expectedUpdatedAt: pub.updatedAt ?? null,
          row: {
            isPublished: nextState,
            publishedAt: nextState ? now : null,
            publishedBy: nextState ? 'Wali Kelas' : null,
          },
        });
        if (!res.success) {
          showToast(res.error || 'Gagal mengubah status publikasi.', 'error');
          return;
        }
        setPublications((prev) =>
          prev.map((p) =>
            p.id === pub.id
              ? { ...p, isPublished: nextState, publishedAt: nextState ? now : null, publishedBy: 'Wali Kelas', updatedAt: res.updatedAt }
              : p
          )
        );
      } else {
        const newId = `pub-${g.key.replace(/\s+/g, '')}-${academicYear.replace(/[^0-9]/g, '')}-${semester}`;
        const row = {
          id: newId,
          grade: g.key,
          academicYear,
          semester,
          isPublished: nextState,
          publishedAt: nextState ? now : null,
          publishedBy: nextState ? 'Wali Kelas' : null,
          notes: `Nilai Rapor ${g.label} telah resmi diterbitkan.`,
        };
        const res = await mutateRow({
          action: 'add',
          sheetName: 'GradePublications',
          row,
        });
        if (!res.success) {
          showToast(res.error || 'Gagal menerbitkan nilai.', 'error');
          return;
        }
        setPublications((prev) => [...prev, { ...row, updatedAt: res.updatedAt }]);
      }

      showToast(
        nextState
          ? `Nilai ${g.label} berhasil DIPOSTING ke Layar Wali Murid!`
          : `Nilai ${g.label} ditarik kembali ke DRAFT.`
      );
    } catch (e) {
      showToast('Terjadi kesalahan jaringan.', 'error');
    }
  };

  // Simpan Catatan / Pesan Pengumuman Kelas
  const handleSaveNotes = async () => {
    if (!notesModal) return;
    setSavingNotes(true);
    const { grade, pub } = notesModal;
    const now = Date.now();

    try {
      if (pub && pub.id) {
        const res = await mutateRow({
          action: 'update',
          sheetName: 'GradePublications',
          id: pub.id,
          expectedUpdatedAt: pub.updatedAt ?? null,
          row: { notes: notesDraft.trim() },
        });
        if (res.success) {
          setPublications((prev) =>
            prev.map((p) => (p.id === pub.id ? { ...p, notes: notesDraft.trim(), updatedAt: res.updatedAt } : p))
          );
          showToast('Pesan pengumuman berhasil disimpan.');
          setNotesModal(null);
        } else {
          showToast(res.error || 'Gagal menyimpan pesan.', 'error');
        }
      } else {
        const newId = `pub-${grade.key.replace(/\s+/g, '')}-${academicYear.replace(/[^0-9]/g, '')}-${semester}`;
        const row = {
          id: newId,
          grade: grade.key,
          academicYear,
          semester,
          isPublished: 0,
          notes: notesDraft.trim(),
        };
        const res = await mutateRow({
          action: 'add',
          sheetName: 'GradePublications',
          row,
        });
        if (res.success) {
          setPublications((prev) => [...prev, { ...row, updatedAt: res.updatedAt }]);
          showToast('Pesan pengumuman berhasil disimpan.');
          setNotesModal(null);
        } else {
          showToast(res.error || 'Gagal menyimpan pesan.', 'error');
        }
      }
    } catch (e) {
      showToast('Gagal menyimpan pesan.', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold text-white transition-all transform animate-bounce ${
            toast.type === 'error' ? 'bg-rose-500' : 'bg-secondary'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-secondary/10 text-secondary">
              <Award size={22} />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900">Publikasi Nilai Rapor</h2>
              <p className="text-slate-400 font-bold text-xs mt-0.5">
                Posting Nilai E-Raport per Kelas ke Layar Portal Wali Murid
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tahun Ajaran & Semester */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-1 shadow-sm flex items-center gap-2 flex-grow sm:flex-grow-0 justify-between sm:justify-start">
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2025/2026"
              className="w-24 sm:w-28 px-3 py-1.5 text-xs font-black text-slate-800 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-secondary transition-all"
            />
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-black text-slate-800 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-secondary transition-all"
            >
              {SEMESTER_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Banner Penjelasan Alur Terintegrasi */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-secondary/20 rounded-2xl p-4 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-secondary text-white shrink-0 mt-0.5">
          <Sparkles size={16} />
        </div>
        <div className="text-xs">
          <p className="font-black text-slate-800">Sistem Nilai Rapor Terintegrasi (1 Kali Input)</p>
          <p className="text-slate-600 font-medium mt-0.5 leading-relaxed">
            Guru cukup menginput nilai di menu <b>E-Raport</b>. Di halaman ini, guru cukup menekan tombol <b>"📢 Posting ke Wali Murid"</b> untuk kelas yang sudah siap. Begitu diposting, wali murid dari kelas tersebut langsung bisa melihat nilai ananda di Portal Ortu!
          </p>
        </div>
      </div>

      {/* Grid Kartu Kelas */}
      {loading && !students.length ? (
        <div className="flex justify-center py-24 text-slate-300">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {gradeStats.map((g) => {
            const pct = g.totalStudents > 0 ? Math.round((g.filledCount / g.totalStudents) * 100) : 0;

            return (
              <div
                key={g.key}
                className={`rounded-2xl sm:rounded-3xl border transition-all duration-200 bg-white p-4 sm:p-6 flex flex-col justify-between shadow-sm relative overflow-hidden ${
                  g.isPublished
                    ? 'border-emerald-200 shadow-emerald-500/5'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                {/* Header Kartu */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      {g.fase}
                    </span>

                    {/* Badge Status Publikasi */}
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black border transition-all ${
                        g.isPublished
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {g.isPublished ? (
                        <>
                          <Check size={12} className="stroke-[3]" /> Terbit di Portal Ortu
                        </>
                      ) : (
                        <>
                          <Lock size={12} /> Draft (Belum Terbit)
                        </>
                      )}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900">{g.label}</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    {academicYear} • Semester {semester === '1' ? 'Ganjil' : 'Genap'}
                  </p>

                  {/* Ringkasan Kelengkapan Rapor */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500">Kelengkapan Nilai Rapor</span>
                      <span className="text-slate-800">
                        {g.filledCount} dari {g.totalStudents} Siswa ({pct}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-secondary' : 'bg-slate-200'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Catatan / Pesan Pengumuman */}
                  {g.publication && g.publication.notes && (
                    <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 flex items-start gap-2">
                      <MessageSquare size={14} className="text-secondary shrink-0 mt-0.5" />
                      <p className="italic line-clamp-2">"{g.publication.notes}"</p>
                    </div>
                  )}
                </div>

                {/* Footer Tombol Aksi */}
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2.5">
                  {/* Tombol Utama: Posting / Tarik */}
                  <button
                    onClick={() => handleTogglePublish(g)}
                    className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                      g.isPublished
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 shadow-rose-500/5'
                        : 'bg-secondary text-white hover:brightness-95 shadow-secondary/20'
                    }`}
                  >
                    {g.isPublished ? (
                      <>
                        <Lock size={15} /> Tarik Kembali ke Draft
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Posting ke Wali Murid
                      </>
                    )}
                  </button>

                  {/* Tombol Sekunder */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setInspectGrade(g)}
                      className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye size={14} /> Tinjau Siswa
                    </button>

                    <button
                      onClick={() => {
                        setNotesModal({ grade: g, pub: g.publication });
                        setNotesDraft(g.publication?.notes || '');
                      }}
                      className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare size={14} /> Pesan Ortu
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tinjau Nilai Siswa per Kelas */}
      <AnimatePresence>
        {inspectGrade && (
          <Modal
            title={`Rekap Nilai Siswa: ${inspectGrade.label} (${academicYear} • Sem ${semester})`}
            onClose={() => setInspectGrade(null)}
            maxWidthClass="max-w-2xl"
          >
            <div className="p-4 sm:p-6 md:p-8 space-y-4">
              {/* Search Siswa */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={inspectSearch}
                  onChange={(e) => setInspectSearch(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                />
              </div>

              {/* Daftar Siswa */}
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {inspectGrade.classStudents
                  .filter((s) => !inspectSearch || s.nama_siswa.toLowerCase().includes(inspectSearch.toLowerCase()))
                  .map((s, idx) => {
                    const isTK = inspectGrade.key === 'TK';
                    const studentPeriod = inspectGrade.classPeriods.find(
                      (p) => String(p.studentId || p.student_id) === String(s.id)
                    );
                    const studentGrades = !isTK && studentPeriod
                      ? grades.filter((gr) => String(gr.reportPeriodId || gr.report_period_id) === String(studentPeriod.id))
                      : [];
                    const studentAspects = isTK && studentPeriod
                      ? aspects.filter((a) => String(a.reportPeriodId || a.report_period_id) === String(studentPeriod.id))
                      : [];
                    const hasScores = isTK
                      ? studentAspects.some((a) => String(a.deskripsi || '').trim() !== '')
                      : studentGrades.some((gr) => String(gr.nilaiAngka || gr.nilai_angka || '').trim() !== '');

                    return (
                      <div key={s.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-400 w-6 text-center">{idx + 1}</span>
                          <div>
                            <p className="font-black text-slate-900">{s.nama_siswa}</p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              NISN: {s.nisn || '-'} {s.nis ? `• NIS: ${s.nis}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                              hasScores
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {hasScores
                              ? isTK
                                ? `✓ Aspek Terisi (${studentAspects.length} narasi)`
                                : `✓ Nilai Terisi (${studentGrades.length} mapel)`
                              : 'Belum Ada Nilai'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs">
                <Link
                  to="/dashboard-guru/eraport"
                  className="inline-flex items-center gap-1 font-black text-secondary hover:underline"
                >
                  Buka Menu E-Raport untuk Mengisi Nilai <ExternalLink size={13} />
                </Link>
              </div>
            </div>

            <ModalFooter>
              <div className="flex justify-end">
                <button
                  onClick={() => setInspectGrade(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-all"
                >
                  Tutup
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Modal Pesan Pengumuman untuk Wali Murid */}
      <AnimatePresence>
        {notesModal && (
          <Modal
            title={`Pesan Wali Murid: ${notesModal.grade.label}`}
            onClose={() => !savingNotes && setNotesModal(null)}
            maxWidthClass="max-w-md"
          >
            <div className="p-4 sm:p-6 md:p-8 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Pesan ini akan ditampilkan di kartu nilai murid saat orang tua membuka <b>Portal Wali Murid</b>.
              </p>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Catatan / Pesan Pengumuman
                </label>
                <textarea
                  rows={4}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="mis. Alhamdulillah nilai rapor semester ganjil telah selesai direkapitulasi oleh dewan guru..."
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                />
              </div>
            </div>

            <ModalFooter>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setNotesModal(null)}
                  disabled={savingNotes}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="flex-1 py-3 rounded-xl bg-secondary text-white font-black text-xs hover:brightness-95 transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2"
                >
                  {savingNotes ? <Loader2 className="animate-spin" size={15} /> : 'Simpan Pesan'}
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
