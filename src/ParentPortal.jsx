import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ArrowLeft, Award, FileText, Calendar, User, BookOpen,
  Download, Loader2, AlertCircle, CheckCircle2, ChevronRight, MessageSquare,
  HelpCircle, RefreshCw, X, Sparkles, Lock
} from 'lucide-react';
import { lookupParentStudent } from './services/gsheet';

// Avatar Ikhwan / Akhwat fallback
const Avatar = ({ gender, className = 'w-16 h-16' }) => {
  const isAkhwat = String(gender || '').toLowerCase() === 'akhwat' || String(gender || '').toLowerCase() === 'p';
  return (
    <img
      src={isAkhwat ? '/avatars/akhwat.webp' : '/avatars/ikhwan.webp'}
      alt="Avatar Siswa"
      className={`${className} rounded-2xl object-cover border border-secondary/30 bg-primary/5 shadow-sm`}
    />
  );
};

export default function ParentPortal() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data State
  const [student, setStudent] = useState(null);
  const [exams, setExams] = useState([]);
  const [reportPeriods, setReportPeriods] = useState([]);
  const [reportGrades, setReportGrades] = useState([]);
  const [reportAspects, setReportAspects] = useState([]);
  const [reportExtras, setReportExtras] = useState([]);

  // Multiple Matches Modal State
  const [multipleMatches, setMultipleMatches] = useState([]);
  const [showMatchPicker, setShowMatchPicker] = useState(false);

  // Tabs: 'raport' | 'exams'
  const [activeTab, setActiveTab] = useState('raport');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');
  const [downloadingPdf, setDownloadingPdf] = useState(null);

  // Local storage history (Ananda tersimpan di perangkat ini)
  const [savedChildren, setSavedChildren] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mias_parent_saved_students');
      if (stored) setSavedChildren(JSON.parse(stored));
    } catch (e) {
      console.error('Error reading saved students:', e);
    }
  }, []);

  const saveChildToLocal = (stu) => {
    try {
      const existing = savedChildren.filter((c) => c.id !== stu.id);
      const updated = [{ id: stu.id, nama_siswa: stu.nama_siswa, kelas: stu.kelas, jenis_kelamin: stu.jenis_kelamin, nisn: stu.nisn }, ...existing].slice(0, 5);
      setSavedChildren(updated);
      localStorage.setItem('mias_parent_saved_students', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving student:', e);
    }
  };

  const removeSavedChild = (id, e) => {
    e.stopPropagation();
    const updated = savedChildren.filter((c) => c.id !== id);
    setSavedChildren(updated);
    localStorage.setItem('mias_parent_saved_students', JSON.stringify(updated));
  };

  // Eksekusi pencarian
  const handleSearch = async (searchTerm = null, studentId = null) => {
    const qVal = searchTerm !== null ? searchTerm : query;
    if (!studentId && (!qVal || qVal.trim().length < 2)) {
      setError('Silakan ketik minimal 2 huruf nama, NIK, atau NISN ananda.');
      return;
    }

    setLoading(true);
    setError('');
    setShowMatchPicker(false);

    const res = await lookupParentStudent({ q: qVal?.trim(), studentId });

    if (!res.success) {
      setError(res.message || 'Terjadi kendala saat mencari data ananda. Coba beberapa saat lagi.');
      setLoading(false);
      return;
    }

    if (!res.found && !res.single) {
      setError(res.message || 'Data ananda tidak ditemukan. Mohon pastikan ejaan Nama, NIK, atau NISN sudah sesuai.');
      setLoading(false);
      return;
    }

    // Jika ada beberapa anak dengan nama serupa
    if (res.multiple && res.students?.length > 1) {
      setMultipleMatches(res.students);
      setShowMatchPicker(true);
      setLoading(false);
      return;
    }

    // Jika data tunggal ditemukan
    if (res.student) {
      setStudent(res.student);
      setExams(res.exams || []);
      setReportPeriods(res.reportPeriods || []);
      setReportGrades(res.reportGrades || []);
      setReportAspects(res.reportAspects || []);
      setReportExtras(res.reportExtras || []);
      saveChildToLocal(res.student);
    }
    setLoading(false);
  };

  // Unduh PDF Rapor Semester Resmi
  const handleDownloadRaporPdf = async (period) => {
    if (!student || !period) return;
    setDownloadingPdf(period.id);
    try {
      const { generateRaporPdf, raporFileName } = await import('./services/raporPdf');
      const wmBlob = await fetch(period.kelas === 'TK' ? '/avatars/logo-tk.png' : '/avatars/rapor-watermark.jpeg')
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null);
      const watermark = wmBlob
        ? await new Promise((resolve) => {
            const fr = new FileReader();
            fr.onloadend = () => resolve(fr.result);
            fr.readAsDataURL(wmBlob);
          })
        : null;

      const pGrades = reportGrades.filter((g) => String(g.reportPeriodId || g.report_period_id) === String(period.id));
      const pAspects = reportAspects.filter((a) => String(a.reportPeriodId || a.report_period_id) === String(period.id));
      const pExtras = reportExtras.filter((x) => String(x.reportPeriodId || x.report_period_id) === String(period.id));

      const doc = await generateRaporPdf({
        student,
        period,
        watermark,
        umum: pGrades.filter((g) => !g.kelompok || g.kelompok === 'umum'),
        mulok: pGrades.filter((g) => g.kelompok === 'mulok'),
        extras: pExtras,
        aspek: {
          agama: pAspects.filter((a) => !a.kelompok || a.kelompok === 'agama'),
          jatidiri: pAspects.filter((a) => a.kelompok === 'jatidiri'),
          literasi: pAspects.filter((a) => a.kelompok === 'literasi'),
        },
      });

      doc.save(raporFileName(student, period));
    } catch (err) {
      alert('Gagal mengunduh PDF rapor: ' + err.message);
    } finally {
      setDownloadingPdf(null);
    }
  };

  // Filter Mata Pelajaran
  const availableSubjects = Array.from(new Set(exams.map((e) => e.subject)));
  const filteredExams = exams.filter((e) => {
    if (selectedSubjectFilter === 'ALL') return true;
    return e.subject === selectedSubjectFilter;
  });

  // Statistik Nilai
  const examStats = React.useMemo(() => {
    const scores = exams.map((e) => Number(e.score)).filter((s) => !isNaN(s));
    if (scores.length === 0) return { avg: '-', max: '-', count: 0 };
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      avg: (sum / scores.length).toFixed(1),
      max: Math.max(...scores),
      count: scores.length,
    };
  }, [exams]);

  return (
    <div className="min-h-screen bg-ivory text-ink flex flex-col antialiased selection:bg-secondary/20">
      {/* Top Header */}
      <header className="bg-forest text-ivory py-4 px-6 sticky top-0 z-40 border-b border-primary/20 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-ivory p-1 flex items-center justify-center overflow-hidden border border-secondary/30">
              <img src="/avatars/logo.png" alt="Logo MIAS" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-display font-semibold text-sm md:text-base leading-tight block text-ivory group-hover:text-secondary-light transition-colors">
                Sekolah Islam Imam Syafi'i
              </span>
              <span className="text-[10px] text-ivory/60 tracking-wider uppercase block">
                Portal Nilai & Rapor Siswa
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/6283125755134"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-ivory/80 hover:text-ivory bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <HelpCircle size={13} />
              <span className="hidden sm:inline">Bantuan TU</span>
            </a>
            <Link
              to="/"
              className="text-[11px] font-semibold text-ivory/80 hover:text-ivory px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Beranda</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {/* Banner Judul */}
        {!student && (
          <div className="text-center py-6 md:py-10 space-y-3">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold text-secondary uppercase tracking-[0.2em] bg-secondary/10 px-3.5 py-1 rounded-full border border-secondary/20">
              <Sparkles size={13} /> Portal Wali Murid
            </span>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-primary">
              Pantau Hasil Ujian & Rapor Ananda
            </h1>
            <p className="text-primary/70 text-xs md:text-sm max-w-lg mx-auto">
              Cukup masukkan Nama Lengkap, NIK, atau NISN ananda untuk melihat riwayat penilaian harian dan rapor digital secara real-time.
            </p>
          </div>
        )}

        {/* Kotak Pencarian */}
        {!student && (
          <div className="max-w-xl mx-auto space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              className="relative bg-white p-2 rounded-2xl border border-primary/15 shadow-xl shadow-primary/5 flex items-center gap-2"
            >
              <div className="pl-3 text-primary/40">
                <Search size={20} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ketik Nama Siswa, NIK, atau NISN..."
                className="w-full text-xs sm:text-sm py-2.5 px-2 bg-transparent focus:outline-none text-ink placeholder:text-ink/40 font-medium"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-forest text-ivory px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 shadow-md shadow-primary/20 active:scale-95"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Cek Nilai'}
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl flex items-start gap-2.5 animate-fade-in">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            {/* Ananda yang Pernah Dicari di HP ini (Riwayat Lokal) */}
            {savedChildren.length > 0 && (
              <div className="pt-4">
                <div className="text-[11px] font-bold text-primary/60 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <User size={13} /> Ananda yang Tersimpan di Perangkat Ini:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {savedChildren.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSearch(null, c.id)}
                      className="bg-white hover:bg-primary/[0.03] border border-primary/10 hover:border-secondary/40 p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between shadow-sm group"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar gender={c.jenis_kelamin} className="w-10 h-10" />
                        <div>
                          <h4 className="font-semibold text-xs text-primary group-hover:text-secondary transition-colors">
                            {c.nama_siswa}
                          </h4>
                          <span className="text-[10px] text-primary/50 block">Kelas {c.kelas}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => removeSavedChild(c.id, e)}
                        title="Hapus dari riwayat perangkat ini"
                        className="text-primary/30 hover:text-red-500 p-1 rounded-md transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Pemilihan Siswa (Jika ada nama yang mirip) */}
        {showMatchPicker && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full border border-primary/10 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-primary/10 pb-3">
                <h3 className="font-display font-semibold text-primary text-base">Pilih Ananda</h3>
                <button
                  onClick={() => setShowMatchPicker(false)}
                  className="text-primary/40 hover:text-primary p-1"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-primary/70">
                Ditemukan beberapa nama yang mirip. Silakan pilih ananda Anda untuk melanjutkan:
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {multipleMatches.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleSearch(null, m.id)}
                    className="p-3.5 rounded-xl border border-primary/10 hover:border-secondary hover:bg-secondary/5 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar gender={m.jenis_kelamin} className="w-10 h-10" />
                      <div>
                        <h4 className="font-semibold text-xs text-primary group-hover:text-secondary">
                          {m.nama_siswa}
                        </h4>
                        <span className="text-[10px] text-primary/50 block">Kelas {m.kelas} {m.nisn ? `• NISN: ${m.nisn}` : ''}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-primary/30 group-hover:text-secondary group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAMPILAN DASHBOARD SISWA (SETELAH DITEMUKAN) ================= */}
        {student && (
          <div className="space-y-6">
            {/* Kartu Profil Ananda */}
            <div className="bg-white rounded-3xl border border-primary/10 p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                <Avatar gender={student.jenis_kelamin} className="w-20 h-20 sm:w-24 sm:h-24" />
                <div className="space-y-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/20">
                    Siswa Aktif
                  </span>
                  <h2 className="font-display text-2xl md:text-3xl font-bold text-primary">
                    {student.nama_siswa}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-primary/60 pt-1">
                    <span className="font-semibold text-primary">Kelas: {student.kelas}</span>
                    <span>•</span>
                    <span>NISN: {student.nisn || 'Belum Terdata'}</span>
                    {student.nis && (
                      <>
                        <span>•</span>
                        <span>NIS: {student.nis}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Tombol Ganti / Cari Siswa Lain */}
              <button
                onClick={() => {
                  setStudent(null);
                  setExams([]);
                  setReportPeriods([]);
                  setQuery('');
                }}
                className="text-xs font-semibold px-4 py-2 rounded-xl border border-primary/15 text-primary/70 hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-1.5 flex-shrink-0"
              >
                <RefreshCw size={13} /> Cari Ananda Lain
              </button>
            </div>

            {/* Navigasi Tab */}
            <div className="flex items-center gap-3 border-b border-primary/10 pb-1">
              <button
                onClick={() => setActiveTab('raport')}
                className={`pb-3 px-3 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === 'raport'
                    ? 'border-secondary text-primary font-bold'
                    : 'border-transparent text-primary/50 hover:text-primary'
                }`}
              >
                <FileText size={16} className={activeTab === 'raport' ? 'text-secondary' : ''} />
                Rapor & Hasil Belajar Resmi ({reportPeriods.length})
              </button>

              {exams.length > 0 && (
                <button
                  onClick={() => setActiveTab('exams')}
                  className={`pb-3 px-3 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                    activeTab === 'exams'
                      ? 'border-secondary text-primary font-bold'
                      : 'border-transparent text-primary/50 hover:text-primary'
                  }`}
                >
                  <Award size={16} className={activeTab === 'exams' ? 'text-secondary' : ''} />
                  Nilai Ujian Tambahan ({exams.length})
                </button>
              )}
            </div>

            {/* TAB 1: NILAI UJIAN BERKALA */}
            {activeTab === 'exams' && (
              <div className="space-y-6">
                {/* Ringkasan Nilai & Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-primary/10">
                  <div className="flex items-center gap-4 text-xs font-semibold text-primary">
                    <div>
                      <span className="text-[10px] text-primary/50 uppercase block">Total Ujian</span>
                      <strong className="text-sm font-bold text-secondary">{examStats.count}</strong>
                    </div>
                    <div className="w-px h-6 bg-primary/10" />
                    <div>
                      <span className="text-[10px] text-primary/50 uppercase block">Rata-Rata Nilai</span>
                      <strong className="text-sm font-bold text-secondary">{examStats.avg}</strong>
                    </div>
                    <div className="w-px h-6 bg-primary/10" />
                    <div>
                      <span className="text-[10px] text-primary/50 uppercase block">Nilai Tertinggi</span>
                      <strong className="text-sm font-bold text-secondary">{examStats.max}</strong>
                    </div>
                  </div>

                  {/* Filter Mapel */}
                  {availableSubjects.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-primary/60 font-semibold whitespace-nowrap">Filter Mapel:</span>
                      <select
                        value={selectedSubjectFilter}
                        onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-primary/20 bg-ivory focus:outline-none"
                      >
                        <option value="ALL">Semua Mata Pelajaran</option>
                        {availableSubjects.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* List Kartu Nilai Ujian */}
                {filteredExams.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-primary/10 p-12 text-center text-primary/50 space-y-2">
                    <Award size={36} className="mx-auto text-primary/30" />
                    <p className="font-semibold text-sm">Belum ada nilai ujian yang diterbitkan</p>
                    <p className="text-xs text-primary/40">
                      Nilai ulangan harian, PTS, atau PAS akan tampil di sini segera setelah guru kelas menerbitkannya.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredExams.map((ex) => {
                      const scoreNum = Number(ex.score);
                      const isHigh = scoreNum >= 85;
                      const isGood = scoreNum >= 75 && scoreNum < 85;

                      return (
                        <div
                          key={ex.id}
                          className="bg-white rounded-2xl border border-primary/10 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-[11px] font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-lg">
                                {ex.subject}
                              </span>
                              <div
                                className={`text-xl font-bold px-3 py-1 rounded-xl flex items-center justify-center font-display ${
                                  isHigh
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : isGood
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {ex.score}
                              </div>
                            </div>

                            <h3 className="font-semibold text-primary text-base leading-snug">{ex.title}</h3>

                            <div className="flex items-center gap-3 text-[11px] text-primary/50">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} /> {ex.exam_date || 'Tanggal tidak dicantumkan'}
                              </span>
                              {ex.teacher_name && (
                                <>
                                  <span>•</span>
                                  <span>Guru: {ex.teacher_name}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Catatan / Pesan Guru */}
                          {ex.notes && (
                            <div className="bg-ivory/70 border border-primary/10 rounded-xl p-3 text-xs text-primary/80 flex items-start gap-2.5">
                              <MessageSquare size={14} className="text-secondary flex-shrink-0 mt-0.5" />
                              <div className="italic leading-relaxed">"{ex.notes}"</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: E-RAPORT SEMESTER */}
            {activeTab === 'raport' && (
              <div className="space-y-4">
                {reportPeriods.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-primary/10 p-12 text-center text-primary/50 space-y-2">
                    <FileText size={36} className="mx-auto text-primary/30" />
                    <p className="font-semibold text-sm">Belum ada rapor semester digital</p>
                    <p className="text-xs text-primary/40">
                      Rapor Kurikulum Merdeka akan tampil setelah wali kelas menyelesaikan pengisian semester.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {reportPeriods.map((p) => {
                      const semGrades = reportGrades.filter(
                        (g) => String(g.reportPeriodId || g.report_period_id) === String(p.id)
                      );
                      const semAspects = reportAspects.filter(
                        (a) => String(a.reportPeriodId || a.report_period_id) === String(p.id)
                      );
                      const semExtras = reportExtras.filter(
                        (x) => String(x.reportPeriodId || x.report_period_id) === String(p.id)
                      );
                      const isDownloading = downloadingPdf === p.id;
                      const isTk = String(p.kelas || student?.kelas || '').toUpperCase().includes('TK');

                      // Belum Diterbitkan (Draft / Masih diverifikasi)
                      if (!p.isPublished) {
                        return (
                          <div
                            key={p.id}
                            className="bg-amber-50/70 rounded-2xl border border-amber-200/80 p-6 shadow-sm space-y-4"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/60 pb-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-display font-semibold text-lg text-primary">
                                    Rapor Kelas {p.kelas} — Semester {p.semester === '1' ? 'Ganjil' : 'Genap'}
                                  </h3>
                                  <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-amber-300">
                                    <Lock size={12} /> Menunggu Publikasi Resmi
                                  </span>
                                </div>
                                <span className="text-xs text-primary/60">
                                  Tahun Ajaran {p.tahunAjaran || p.tahun_ajaran}
                                </span>
                              </div>
                            </div>

                            <div className="bg-white/80 rounded-xl p-4 border border-amber-100 text-xs text-ink/80 space-y-2">
                              <div className="flex items-start gap-2.5">
                                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold text-primary">Nilai Rapor Sedang Dalam Proses Finalisasi</p>
                                  <p className="text-primary/70 mt-1 leading-relaxed">
                                    Dewan guru dan wali kelas sedang menyelesaikan verifikasi nilai capaian kompetensi ananda untuk kelas {p.kelas}.
                                    Nilai rapor resmi beserta dokumen PDF lengkap akan dapat diakses dan diunduh di portal ini segera setelah diposting secara resmi oleh wali kelas.
                                  </p>
                                </div>
                              </div>
                              {p.publicationNotes && (
                                <div className="mt-3 pt-3 border-t border-amber-100 flex items-start gap-2 text-xs text-amber-900 bg-amber-50/60 p-2.5 rounded-lg">
                                  <MessageSquare size={13} className="text-amber-700 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold block text-[11px] text-amber-800">Catatan Wali Kelas:</span>
                                    <span className="italic leading-relaxed">{p.publicationNotes}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // SUDAH DITERBITKAN
                      const umumGrades = semGrades.filter((g) => !g.kelompok || g.kelompok === 'umum');
                      const mulokGrades = semGrades.filter((g) => g.kelompok === 'mulok');

                      return (
                        <div
                          key={p.id}
                          className="bg-white rounded-2xl border border-primary/10 p-6 shadow-sm space-y-5"
                        >
                          {/* Header Rapor & Action */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary/5 pb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-display font-semibold text-lg text-primary">
                                  Rapor Kelas {p.kelas} — Semester {p.semester === '1' ? 'Ganjil' : 'Genap'}
                                </h3>
                                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 size={12} /> Resmi Diterbitkan
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-primary/60 mt-0.5">
                                <span>Tahun Ajaran {p.tahunAjaran || p.tahun_ajaran}</span>
                                {p.publishedAt && (
                                  <>
                                    <span>•</span>
                                    <span>Diterbitkan: {new Date(p.publishedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => handleDownloadRaporPdf(p)}
                              disabled={isDownloading}
                              className="bg-primary hover:bg-forest text-ivory px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-95"
                            >
                              {isDownloading ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Download size={15} />
                              )}
                              Unduh Rapor Lengkap (PDF)
                            </button>
                          </div>

                          {/* Catatan / Pesan Pengumuman Wali Kelas */}
                          {p.publicationNotes && (
                            <div className="bg-primary/[0.03] border border-primary/10 rounded-xl p-3 text-xs text-primary/80 flex items-start gap-2.5">
                              <MessageSquare size={14} className="text-secondary flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-primary block text-[11px]">Pesan / Pengumuman Wali Kelas:</span>
                                <span className="italic leading-relaxed">{p.publicationNotes}</span>
                              </div>
                            </div>
                          )}

                          {/* Rekap Kehadiran */}
                          <div className="grid grid-cols-3 gap-2 bg-primary/[0.02] p-3 rounded-xl border border-primary/5 text-center text-xs">
                            <div>
                              <span className="text-[10px] text-primary/50 block">Sakit</span>
                              <strong className="text-primary font-bold">{p.kehadiranSakit || p.kehadiran_sakit || '0'} hari</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-primary/50 block">Izin</span>
                              <strong className="text-primary font-bold">{p.kehadiranIzin || p.kehadiran_izin || '0'} hari</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-primary/50 block">Tanpa Keterangan</span>
                              <strong className="text-primary font-bold">{p.kehadiranAlpa || p.kehadiran_alpa || '0'} hari</strong>
                            </div>
                          </div>

                          {/* KONTEN TK: Aspek Perkembangan */}
                          {isTk && semAspects.length > 0 && (
                            <div className="space-y-3">
                              <h4 className="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles size={13} className="text-secondary" />
                                Aspek Perkembangan Ananda (Kurikulum Merdeka TK)
                              </h4>
                              <div className="grid grid-cols-1 gap-2.5">
                                {semAspects.map((a, idx) => (
                                  <div key={a.id || idx} className="bg-primary/[0.02] border border-primary/10 rounded-xl p-3.5 space-y-1">
                                    <div className="font-semibold text-xs text-primary flex items-center justify-between">
                                      <span>{a.aspek || 'Aspek Perkembangan'}</span>
                                      <span className="text-[10px] uppercase font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                                        {a.kelompok || 'Perkembangan'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-primary/80 leading-relaxed">
                                      {a.deskripsi || '-'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* KONTEN SD: Muatan Umum */}
                          {!isTk && umumGrades.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen size={13} className="text-secondary" />
                                A. Muatan Pelajaran Umum
                              </h4>
                              <div className="overflow-x-auto border border-primary/5 rounded-xl">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-primary/5 text-primary/70 uppercase text-[10px] font-bold">
                                    <tr>
                                      <th className="py-2.5 px-3">Mata Pelajaran</th>
                                      <th className="py-2.5 px-3 text-center w-24">Nilai Akhir</th>
                                      <th className="py-2.5 px-3">Capaian Kompetensi</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-primary/5 bg-white">
                                    {umumGrades.map((g) => (
                                      <tr key={g.id} className="hover:bg-primary/[0.01]">
                                        <td className="py-2.5 px-3 font-semibold text-primary">{g.mataPelajaran || g.mata_pelajaran}</td>
                                        <td className="py-2.5 px-3 text-center font-bold text-secondary">{g.nilaiAngka || g.nilai_angka || '-'}</td>
                                        <td className="py-2.5 px-3 text-primary/70 text-[11px] leading-relaxed">{g.deskripsiCapaian || g.deskripsi_capaian || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* KONTEN SD: Muatan Lokal Diniyyah */}
                          {!isTk && mulokGrades.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
                                <Award size={13} className="text-secondary" />
                                B. Muatan Lokal Diniyyah / Ciri Khusus
                              </h4>
                              <div className="overflow-x-auto border border-primary/5 rounded-xl">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-primary/5 text-primary/70 uppercase text-[10px] font-bold">
                                    <tr>
                                      <th className="py-2.5 px-3">Mata Pelajaran Diniyyah</th>
                                      <th className="py-2.5 px-3 text-center w-24">Nilai Akhir</th>
                                      <th className="py-2.5 px-3">Capaian Kompetensi</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-primary/5 bg-white">
                                    {mulokGrades.map((g) => (
                                      <tr key={g.id} className="hover:bg-primary/[0.01]">
                                        <td className="py-2.5 px-3 font-semibold text-primary">{g.mataPelajaran || g.mata_pelajaran}</td>
                                        <td className="py-2.5 px-3 text-center font-bold text-secondary">{g.nilaiAngka || g.nilai_angka || '-'}</td>
                                        <td className="py-2.5 px-3 text-primary/70 text-[11px] leading-relaxed">{g.deskripsiCapaian || g.deskripsi_capaian || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Ekstrakurikuler jika ada */}
                          {semExtras.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-semibold text-xs text-primary uppercase tracking-wider">
                                Ekstrakurikuler
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {semExtras.map((x, idx) => (
                                  <div key={x.id || idx} className="bg-primary/[0.02] border border-primary/10 rounded-xl p-2.5">
                                    <div className="flex justify-between font-semibold text-primary text-[11px]">
                                      <span>{x.nama}</span>
                                      <span className="text-secondary font-bold">{x.predikat}</span>
                                    </div>
                                    {x.keterangan && <p className="text-[10px] text-primary/60 mt-0.5">{x.keterangan}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Catatan Wali Kelas */}
                          {(p.catatanWaliKelas || p.catatan_wali_kelas) && (
                            <div className="bg-ivory/60 border border-primary/10 rounded-xl p-3 text-xs text-primary/80">
                              <span className="font-semibold text-primary block text-[11px] mb-1">Catatan Wali Kelas:</span>
                              <p className="italic leading-relaxed">"{p.catatanWaliKelas || p.catatan_wali_kelas}"</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-forest text-ivory/60 text-center py-6 text-xs border-t border-primary/20 mt-12">
        <p>© {new Date().getFullYear()} Sekolah Islam Imam Syafi'i Percut Sei Tuan. Seluruh hak cipta dilindungi.</p>
      </footer>
    </div>
  );
}

