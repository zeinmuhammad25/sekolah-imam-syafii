import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Award, FileText, Calendar, User, BookOpen,
  Download, Loader2, AlertCircle, CheckCircle2, ChevronRight, MessageSquare,
  HelpCircle, RefreshCw, X, Sparkles, Lock, Users, ShieldCheck, Home, Phone, MapPin,
  GraduationCap, Eye, Search, LayoutDashboard
} from 'lucide-react';
import { lookupParentStudent, fetchSchoolData } from './services/gsheet';

const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];

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
  // Navigation State
  // viewMode: 'CLASS_SELECT' (awal) | 'STUDENT_LIST' (pilih siswa) | 'PROFILE_VIEW' (detail data siswa) | 'RAPORT_VIEW' (detail nilai rapor)
  const [viewMode, setViewMode] = useState('CLASS_SELECT');
  const [selectedClass, setSelectedClass] = useState(null);
  
  // Data Siswa di Kelas Terpilih
  const [classStudents, setClassStudents] = useState([]);
  const [loadingClass, setLoadingClass] = useState(false);
  const [classSearch, setClassSearch] = useState('');

  // Target Siswa Terpilih (untuk Modal Pilihan A / B)
  const [targetStudent, setTargetStudent] = useState(null);
  const [showChoiceModal, setShowChoiceModal] = useState(false);

  // Modal Verifikasi NISN / NIS (untuk B. Nilai Rapor)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // A. Data Siswa (Profil Lengkap yang Terisi)
  const [studentProfile, setStudentProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // B. Nilai Rapor & Ujian
  const [raportData, setRaportData] = useState(null);
  const [loadingRaport, setLoadingRaport] = useState(false);
  const [activeTab, setActiveTab] = useState('raport'); // 'raport' | 'exams'
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');
  const [downloadingPdf, setDownloadingPdf] = useState(null);

  // Feedback Error Global
  const [globalError, setGlobalError] = useState('');

  // Sesi Verifikasi NISN per siswa tersimpan di LocalStorage (Next-Level UX: tidak perlu ketik ulang di HP yang sama)
  const getStoredAuth = (studentId) => {
    try {
      const stored = localStorage.getItem(`mias_auth_${studentId}`);
      return stored || null;
    } catch (e) {
      return null;
    }
  };

  const setStoredAuth = (studentId, code) => {
    try {
      localStorage.setItem(`mias_auth_${studentId}`, code);
    } catch (e) {
      console.error(e);
    }
  };

  // 1. Pilih Kelas -> Muat Seluruh Siswa di Kelas Terpilih
  const handleSelectClass = async (grade) => {
    setSelectedClass(grade);
    setViewMode('STUDENT_LIST');
    setClassSearch('');
    setGlobalError('');
    setLoadingClass(true);

    let students = [];
    const res = await lookupParentStudent({ action: 'list_class', kelas: grade });

    if (res.success && Array.isArray(res.students) && res.students.length > 0) {
      students = res.students;
    } else {
      // Fallback: Ambil dari snapshot data sekolah jika API lookup belum tersedia / dev lokal
      try {
        const fullData = await fetchSchoolData();
        if (fullData && Array.isArray(fullData.Students)) {
          students = fullData.Students.filter((s) => {
            const matchesGrade = String(s.kelas || '').trim().toLowerCase() === String(grade || '').trim().toLowerCase();
            const notAlumni = !s.status || String(s.status).toLowerCase() !== 'alumni';
            return matchesGrade && notAlumni;
          }).map((s) => ({
            id: s.id,
            nama_siswa: s.nama_siswa,
            jenis_kelamin: s.jenis_kelamin,
            kelas: s.kelas,
            nisn: s.nisn,
            nis: s.nis,
          }));
        }
      } catch (err) {
        console.error('Fallback fetchSchoolData error:', err);
      }
    }

    setLoadingClass(false);

    if (students.length > 0) {
      setClassStudents(students);
    } else if (!res.success && (!students || students.length === 0)) {
      setGlobalError(res.message || 'Belum ada data siswa terdaftar untuk kelas ini.');
    } else {
      setClassStudents([]);
    }
  };

  // 2. Klik Siswa -> Buka Modal Pilihan (Data Siswa vs Nilai Rapor)
  const handleSelectStudent = (stu) => {
    setTargetStudent(stu);
    setShowChoiceModal(true);
    setAuthCode('');
    setAuthError('');
  };

  // 3. Pilihan A: Buka Profil Data Siswa (Langsung)
  const handleOpenProfile = async (stu = targetStudent) => {
    setShowChoiceModal(false);
    setLoadingProfile(true);
    setGlobalError('');
    setViewMode('PROFILE_VIEW');

    const res = await lookupParentStudent({ action: 'profile', studentId: stu.id });
    setLoadingProfile(false);

    if (res.success && res.profile) {
      setStudentProfile(res.profile);
    } else {
      setGlobalError(res.message || 'Gagal memuat data siswa.');
    }
  };

  // 4. Pilihan B: Buka Nilai Rapor (Verifikasi NISN/NIS jika SD; Langsung jika TK)
  const handleOpenRaport = async (stu = targetStudent, directCode = null) => {
    const isTK = String(stu.kelas || '').toUpperCase() === 'TK';

    // Jika TK -> Langsung buka tanpa minta NISN
    if (isTK) {
      setShowChoiceModal(false);
      executeLoadRaport(stu.id, null);
      return;
    }

    // Jika SD -> Cek apakah sudah pernah diverifikasi di perangkat ini
    const savedCode = directCode || getStoredAuth(stu.id);
    if (savedCode) {
      setShowChoiceModal(false);
      executeLoadRaport(stu.id, savedCode);
      return;
    }

    // Jika belum pernah verifikasi -> Tampilkan modal masukkan NISN / NIS
    setShowChoiceModal(false);
    setShowAuthModal(true);
  };

  // Eksekusi Muat Nilai Rapor dengan kode verifikasi
  const executeLoadRaport = async (studentId, code) => {
    setAuthenticating(true);
    setAuthError('');
    setLoadingRaport(true);

    const res = await lookupParentStudent({
      action: 'raport',
      studentId,
      authCode: code,
    });

    setAuthenticating(false);
    setLoadingRaport(false);

    if (res.success) {
      if (code) setStoredAuth(studentId, code);
      setShowAuthModal(false);
      setRaportData(res);
      setViewMode('RAPORT_VIEW');
    } else {
      setAuthError(res.message || 'Verifikasi gagal. Mohon periksa kembali NISN/NIS.');
      if (!showAuthModal) setShowAuthModal(true);
    }
  };

  // Unduh PDF Rapor Semester Resmi
  const handleDownloadRaporPdf = async (period) => {
    const student = raportData?.student;
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

      const pGrades = (raportData.reportGrades || []).filter((g) => String(g.reportPeriodId || g.report_period_id) === String(period.id));
      const pAspects = (raportData.reportAspects || []).filter((a) => String(a.reportPeriodId || a.report_period_id) === String(period.id));
      const pExtras = (raportData.reportExtras || []).filter((x) => String(x.reportPeriodId || x.report_period_id) === String(period.id));

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

  // Navigasi Kembali ke Tampilan Sebelumnya
  const handleBackNavigation = () => {
    if (viewMode === 'RAPORT_VIEW' || viewMode === 'PROFILE_VIEW') {
      setViewMode('STUDENT_LIST');
    } else if (viewMode === 'STUDENT_LIST') {
      setViewMode('CLASS_SELECT');
      setSelectedClass(null);
    }
  };

  // Filter siswa per kelas berdasarkan pencarian lokal di kelas tersebut
  const filteredClassStudents = classStudents.filter((s) => {
    if (!classSearch) return true;
    return String(s.nama_siswa || '').toLowerCase().includes(classSearch.toLowerCase());
  });

  // Statistik Nilai Ujian (jika ada)
  const exams = raportData?.exams || [];
  const availableSubjects = Array.from(new Set(exams.map((e) => e.subject)));
  const filteredExams = exams.filter((e) => {
    if (selectedSubjectFilter === 'ALL') return true;
    return e.subject === selectedSubjectFilter;
  });

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
              <span className="font-display font-bold text-sm md:text-base tracking-wide block leading-tight group-hover:text-secondary transition-colors">
                Portal Wali Murid
              </span>
              <span className="text-[10px] md:text-xs text-ivory/60 font-sans tracking-wider block">
                Sekolah Islam Imam Syafi'i
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {viewMode !== 'CLASS_SELECT' && (
              <button
                onClick={handleBackNavigation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ivory/10 hover:bg-ivory/20 text-xs font-semibold text-ivory transition-all"
              >
                <ArrowLeft size={14} /> Kembali
              </button>
            )}

            <Link
              to="/dashboard-guru"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-secondary hover:brightness-110 text-xs font-bold text-white shadow-sm transition-all active:scale-95"
              title="Kembali ke Dashboard Guru / Admin"
            >
              <LayoutDashboard size={14} /> Ke Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex-grow">
        {globalError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAMPILAN 1: PILIHAN KELAS (TK, SD 1 - SD 6) */}
        {/* ========================================================================= */}
        {viewMode === 'CLASS_SELECT' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Banner Pengantar */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest to-primary p-8 md:p-10 text-ivory shadow-xl border border-secondary/20">
              <div className="relative z-10 max-w-2xl space-y-3">
                <span className="inline-flex items-center gap-2 bg-secondary/20 border border-secondary/30 text-secondary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  <Sparkles size={14} /> Layanan Informasi Siswa & Rapor Digital
                </span>
                <h1 className="font-display text-2xl md:text-4xl font-bold leading-tight">
                  Selamat Datang di Portal Wali Murid
                </h1>
                <p className="text-xs md:text-sm text-ivory/80 leading-relaxed font-sans">
                  Silakan pilih jenjang atau kelas ananda tercinta di bawah ini untuk melihat profil data siswa serta capaian nilai rapor semester Kurikulum Merdeka secara resmi.
                </p>
              </div>

              {/* Hiasan background visual */}
              <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
                <GraduationCap size={220} />
              </div>
            </div>

            {/* Grid Kartu Kelas */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-lg md:text-xl text-primary flex items-center gap-2">
                  <Users size={20} className="text-secondary" /> Pilih Jenjang / Kelas
                </h2>
                <span className="text-xs text-primary/60 font-semibold">7 Tingkatan Kelas</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {GRADES.map((grade) => {
                  const isTK = grade === 'TK';
                  return (
                    <button
                      key={grade}
                      onClick={() => handleSelectClass(grade)}
                      className="group relative bg-white hover:bg-forest rounded-3xl p-6 border border-primary/10 hover:border-secondary/50 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between items-start text-left active:scale-95 overflow-hidden"
                    >
                      <div className="space-y-1 mb-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-secondary group-hover:text-secondary-light">
                          {isTK ? 'Fondasi' : 'Tingkat SD'}
                        </span>
                        <h3 className="font-display text-xl md:text-2xl font-bold text-primary group-hover:text-ivory transition-colors">
                          {grade}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between w-full pt-4 border-t border-primary/5 group-hover:border-ivory/10 text-xs font-bold text-primary/60 group-hover:text-ivory/90">
                        <span>Buka Kelas</span>
                        <ChevronRight size={16} className="text-secondary group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAMPILAN 2: DAFTAR SELURUH SISWA PADA KELAS TERPILIH */}
        {/* ========================================================================= */}
        {viewMode === 'STUDENT_LIST' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Breadcrumb Header Kelas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-primary/10 shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-secondary mb-1">
                  <button onClick={() => setViewMode('CLASS_SELECT')} className="hover:underline">Semua Kelas</button>
                  <span>/</span>
                  <span>Kelas {selectedClass}</span>
                </div>
                <h1 className="font-display text-2xl font-bold text-primary">
                  Daftar Siswa Kelas {selectedClass}
                </h1>
                <p className="text-xs text-primary/60 mt-0.5">
                  Menampilkan {classStudents.length} murid terdaftar. Klik pada nama ananda untuk melihat detail profil atau nilai rapor.
                </p>
              </div>

              {/* Input Pencarian Cepat Khusus Kelas Ini */}
              <div className="relative sm:w-72">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary/40" />
                <input
                  type="text"
                  placeholder={`Cari nama siswa ${selectedClass}…`}
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="w-full bg-ivory border border-primary/15 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-primary placeholder:text-primary/40 focus:outline-none focus:border-secondary transition-all"
                />
              </div>
            </div>

            {/* List Siswa */}
            {loadingClass ? (
              <div className="bg-white rounded-3xl border border-primary/10 p-16 text-center text-primary/50 space-y-3">
                <Loader2 size={32} className="animate-spin mx-auto text-secondary" />
                <p className="text-xs font-semibold">Memuat daftar siswa kelas {selectedClass}…</p>
              </div>
            ) : filteredClassStudents.length === 0 ? (
              <div className="bg-white rounded-3xl border border-primary/10 p-12 text-center text-primary/50 space-y-2">
                <Users size={36} className="mx-auto text-primary/30" />
                <p className="font-semibold text-sm">Tidak ada siswa ditemukan</p>
                <p className="text-xs text-primary/40">
                  {classSearch ? `Tidak ada nama yang cocok dengan kata kunci "${classSearch}".` : `Belum ada siswa yang tercatat di kelas ${selectedClass}.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredClassStudents.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectStudent(s)}
                    className="group bg-white hover:bg-forest/5 rounded-2xl p-4 border border-primary/10 hover:border-secondary/40 shadow-sm hover:shadow-md transition-all flex items-center justify-between text-left active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar gender={s.jenis_kelamin} className="w-12 h-12 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-display font-bold text-sm text-primary group-hover:text-forest transition-colors truncate">
                          {s.nama_siswa}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-primary/60 font-sans mt-0.5">
                          <span className="capitalize">{s.jenis_kelamin || 'Siswa'}</span>
                          <span>•</span>
                          <span className="text-secondary font-semibold">Kelas {s.kelas}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-primary/70 group-hover:text-secondary flex items-center gap-1 transition-colors">
                        Lihat <ChevronRight size={14} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAMPILAN 3 (PILIHAN A): DETAIL DATA SISWA (FIELD YANG TERISI SAJA) */}
        {/* ========================================================================= */}
        {viewMode === 'PROFILE_VIEW' && (
          <div className="space-y-6 animate-fadeIn">
            {loadingProfile ? (
              <div className="bg-white rounded-3xl border border-primary/10 p-16 text-center text-primary/50 space-y-3">
                <Loader2 size={32} className="animate-spin mx-auto text-secondary" />
                <p className="text-xs font-semibold">Memuat profil lengkap ananda…</p>
              </div>
            ) : studentProfile ? (
              <div className="space-y-6">
                {/* Header Profil */}
                <div className="bg-white rounded-3xl border border-primary/10 p-6 shadow-sm flex flex-col sm:flex-row items-center gap-5">
                  <Avatar gender={studentProfile.jenis_kelamin} className="w-20 h-20 shrink-0" />
                  <div className="text-center sm:text-left space-y-1">
                    <span className="bg-secondary/15 text-secondary text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                      Data Siswa Resmi
                    </span>
                    <h1 className="font-display text-2xl font-bold text-primary">
                      {studentProfile.nama_siswa}
                    </h1>
                    <p className="text-xs text-primary/60">
                      Kelas: <strong className="text-primary">{studentProfile.kelas}</strong>
                      {studentProfile.status && ` • Status: ${studentProfile.status}`}
                    </p>
                  </div>
                </div>

                {/* Seksi Profil: Hanya yang ada isinya */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Seksi 1: Identitas Pribadi */}
                  <div className="bg-white rounded-3xl border border-primary/10 p-6 shadow-sm space-y-4">
                    <h3 className="font-display font-bold text-sm text-primary uppercase tracking-wider flex items-center gap-2 border-b border-primary/5 pb-3">
                      <User size={16} className="text-secondary" /> Identitas Diri
                    </h3>

                    <div className="space-y-3 text-xs">
                      {studentProfile.nama_siswa && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Nama Lengkap</span>
                          <strong className="text-primary font-semibold">{studentProfile.nama_siswa}</strong>
                        </div>
                      )}
                      {studentProfile.nisn && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">NISN</span>
                          <strong className="text-primary font-semibold">{studentProfile.nisn}</strong>
                        </div>
                      )}
                      {studentProfile.nis && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">NIS (Nomor Induk Sekolah)</span>
                          <strong className="text-primary font-semibold">{studentProfile.nis}</strong>
                        </div>
                      )}
                      {studentProfile.jenis_kelamin && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Jenis Kelamin</span>
                          <strong className="text-primary font-semibold capitalize">{studentProfile.jenis_kelamin}</strong>
                        </div>
                      )}
                      {(studentProfile.tempat_lahir || studentProfile.tanggal_lahir) && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Tempat, Tanggal Lahir</span>
                          <strong className="text-primary font-semibold">
                            {[studentProfile.tempat_lahir, studentProfile.tanggal_lahir].filter(Boolean).join(', ')}
                          </strong>
                        </div>
                      )}
                      {studentProfile.agama && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Agama</span>
                          <strong className="text-primary font-semibold">{studentProfile.agama}</strong>
                        </div>
                      )}
                      {studentProfile.anak_ke && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Anak Ke-</span>
                          <strong className="text-primary font-semibold">{studentProfile.anak_ke}</strong>
                        </div>
                      )}
                      {studentProfile.nik_siswa && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">NIK Siswa (Disensor)</span>
                          <strong className="text-primary font-semibold font-mono">{studentProfile.nik_siswa}</strong>
                        </div>
                      )}
                      {studentProfile.no_kk && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Nomor KK (Disensor)</span>
                          <strong className="text-primary font-semibold font-mono">{studentProfile.no_kk}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seksi 2: Orang Tua & Wali */}
                  <div className="bg-white rounded-3xl border border-primary/10 p-6 shadow-sm space-y-4">
                    <h3 className="font-display font-bold text-sm text-primary uppercase tracking-wider flex items-center gap-2 border-b border-primary/5 pb-3">
                      <Users size={16} className="text-secondary" /> Data Orang Tua / Wali
                    </h3>

                    <div className="space-y-3 text-xs">
                      {studentProfile.nama_ayah && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Nama Ayah</span>
                          <strong className="text-primary font-semibold">{studentProfile.nama_ayah}</strong>
                        </div>
                      )}
                      {studentProfile.pekerjaan_ayah && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Pekerjaan Ayah</span>
                          <strong className="text-primary font-semibold">{studentProfile.pekerjaan_ayah}</strong>
                        </div>
                      )}
                      {studentProfile.pendidikan_ayah && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Pendidikan Ayah</span>
                          <strong className="text-primary font-semibold">{studentProfile.pendidikan_ayah}</strong>
                        </div>
                      )}
                      {studentProfile.nik_ayah && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">NIK Ayah (Disensor)</span>
                          <strong className="text-primary font-semibold font-mono">{studentProfile.nik_ayah}</strong>
                        </div>
                      )}

                      {studentProfile.nama_ibu && (
                        <div className="pt-2 border-t border-primary/5">
                          <span className="text-primary/50 block text-[11px]">Nama Ibu</span>
                          <strong className="text-primary font-semibold">{studentProfile.nama_ibu}</strong>
                        </div>
                      )}
                      {studentProfile.pekerjaan_ibu && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Pekerjaan Ibu</span>
                          <strong className="text-primary font-semibold">{studentProfile.pekerjaan_ibu}</strong>
                        </div>
                      )}
                      {studentProfile.pendidikan_ibu && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">Pendidikan Ibu</span>
                          <strong className="text-primary font-semibold">{studentProfile.pendidikan_ibu}</strong>
                        </div>
                      )}
                      {studentProfile.nik_ibu && (
                        <div>
                          <span className="text-primary/50 block text-[11px]">NIK Ibu (Disensor)</span>
                          <strong className="text-primary font-semibold font-mono">{studentProfile.nik_ibu}</strong>
                        </div>
                      )}

                      {studentProfile.nama_wali && (
                        <div className="pt-2 border-t border-primary/5">
                          <span className="text-primary/50 block text-[11px]">Nama Wali</span>
                          <strong className="text-primary font-semibold">{studentProfile.nama_wali}</strong>
                        </div>
                      )}
                      {studentProfile.no_hp_ortu && (
                        <div className="pt-2 border-t border-primary/5">
                          <span className="text-primary/50 block text-[11px]">Kontak Ortu (Disensor)</span>
                          <strong className="text-primary font-semibold font-mono">{studentProfile.no_hp_ortu}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seksi 3: Alamat Tempat Tinggal */}
                  {(studentProfile.alamat || studentProfile.kelurahan || studentProfile.kecamatan || studentProfile.kabupaten) && (
                    <div className="bg-white rounded-3xl border border-primary/10 p-6 shadow-sm space-y-4 md:col-span-2">
                      <h3 className="font-display font-bold text-sm text-primary uppercase tracking-wider flex items-center gap-2 border-b border-primary/5 pb-3">
                        <MapPin size={16} className="text-secondary" /> Alamat Tempat Tinggal
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {studentProfile.alamat && (
                          <div className="sm:col-span-2">
                            <span className="text-primary/50 block text-[11px]">Alamat Jalan</span>
                            <strong className="text-primary font-semibold">{studentProfile.alamat}</strong>
                          </div>
                        )}
                        {studentProfile.kelurahan && (
                          <div>
                            <span className="text-primary/50 block text-[11px]">Kelurahan / Desa</span>
                            <strong className="text-primary font-semibold">{studentProfile.kelurahan}</strong>
                          </div>
                        )}
                        {studentProfile.kecamatan && (
                          <div>
                            <span className="text-primary/50 block text-[11px]">Kecamatan</span>
                            <strong className="text-primary font-semibold">{studentProfile.kecamatan}</strong>
                          </div>
                        )}
                        {studentProfile.kabupaten && (
                          <div>
                            <span className="text-primary/50 block text-[11px]">Kabupaten / Kota</span>
                            <strong className="text-primary font-semibold">{studentProfile.kabupaten}</strong>
                          </div>
                        )}
                        {studentProfile.provinsi && (
                          <div>
                            <span className="text-primary/50 block text-[11px]">Provinsi</span>
                            <strong className="text-primary font-semibold">{studentProfile.provinsi}</strong>
                          </div>
                        )}
                        {studentProfile.kode_pos && (
                          <div>
                            <span className="text-primary/50 block text-[11px]">Kode Pos</span>
                            <strong className="text-primary font-semibold">{studentProfile.kode_pos}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tombol Lanjut ke Nilai Rapor */}
                <div className="text-center pt-4">
                  <button
                    onClick={() => handleOpenRaport(targetStudent)}
                    className="inline-flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider hover:brightness-95 transition-all shadow-lg shadow-secondary/20 active:scale-95"
                  >
                    <FileText size={16} /> Buka Nilai Rapor Ananda
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAMPILAN 4 (PILIHAN B): DETAIL NILAI RAPOR RESMI & UJIAN */}
        {/* ========================================================================= */}
        {viewMode === 'RAPORT_VIEW' && raportData && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Siswa */}
            <div className="bg-white rounded-3xl border border-primary/10 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <Avatar gender={raportData.student.jenis_kelamin} className="w-16 h-16 shrink-0" />
                <div>
                  <h1 className="font-display text-xl font-bold text-primary">
                    {raportData.student.nama_siswa}
                  </h1>
                  <p className="text-xs text-primary/60">
                    Kelas: <strong className="text-primary">{raportData.student.kelas}</strong>
                    {raportData.student.nisn && ` • NISN: ${raportData.student.nisn}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleOpenProfile(targetStudent)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all"
              >
                <User size={14} /> Lihat Profil Siswa
              </button>
            </div>

            {/* TAB NAVIGASI: RAPOR vs UJIAN */}
            <div className="flex border-b border-primary/10 gap-6">
              <button
                onClick={() => setActiveTab('raport')}
                className={`pb-3 px-2 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === 'raport'
                    ? 'border-secondary text-primary font-bold'
                    : 'border-transparent text-primary/50 hover:text-primary'
                }`}
              >
                <FileText size={16} className={activeTab === 'raport' ? 'text-secondary' : ''} />
                Rapor Kurikulum Merdeka ({raportData.reportPeriods?.length || 0})
              </button>

              {exams.length > 0 && (
                <button
                  onClick={() => setActiveTab('exams')}
                  className={`pb-3 px-2 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
                    activeTab === 'exams'
                      ? 'border-secondary text-primary font-bold'
                      : 'border-transparent text-primary/50 hover:text-primary'
                  }`}
                >
                  <Award size={16} className={activeTab === 'exams' ? 'text-secondary' : ''} />
                  Nilai Ujian ({exams.length})
                </button>
              )}
            </div>

            {/* KONTEN TAB RAPOR */}
            {activeTab === 'raport' && (
              <div className="space-y-6">
                {!raportData.reportPeriods || raportData.reportPeriods.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-primary/10 p-12 text-center text-primary/50 space-y-2">
                    <FileText size={36} className="mx-auto text-primary/30" />
                    <p className="font-semibold text-sm">Belum ada rapor semester digital</p>
                    <p className="text-xs text-primary/40">
                      Rapor Kurikulum Merdeka akan tampil setelah wali kelas menyelesaikan pengisian semester.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {raportData.reportPeriods.map((p) => {
                      const semGrades = (raportData.reportGrades || []).filter(
                        (g) => String(g.reportPeriodId || g.report_period_id) === String(p.id)
                      );
                      const semAspects = (raportData.reportAspects || []).filter(
                        (a) => String(a.reportPeriodId || a.report_period_id) === String(p.id)
                      );
                      const semExtras = (raportData.reportExtras || []).filter(
                        (x) => String(x.reportPeriodId || x.report_period_id) === String(p.id)
                      );
                      const isDownloading = downloadingPdf === p.id;
                      const isTk = String(p.kelas || raportData.student?.kelas || '').toUpperCase().includes('TK');

                      // Status Belum Diterbitkan (Draft)
                      if (!p.isPublished) {
                        return (
                          <div
                            key={p.id}
                            className="bg-amber-50/70 rounded-3xl border border-amber-200/80 p-6 shadow-sm space-y-4"
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

                            <div className="bg-white/80 rounded-2xl p-4 border border-amber-100 text-xs text-ink/80 space-y-2">
                              <div className="flex items-start gap-2.5">
                                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold text-primary">Nilai Rapor Sedang Dalam Proses Finalisasi</p>
                                  <p className="text-primary/70 mt-1 leading-relaxed">
                                    Dewan guru dan wali kelas sedang menyelesaikan verifikasi nilai capaian kompetensi ananda untuk kelas {p.kelas}.
                                    Nilai resmi beserta dokumen PDF lengkap dapat diunduh segera setelah diposting secara resmi oleh wali kelas.
                                  </p>
                                </div>
                              </div>
                              {p.publicationNotes && (
                                <div className="mt-3 pt-3 border-t border-amber-100 flex items-start gap-2 text-xs text-amber-900 bg-amber-50/60 p-2.5 rounded-xl">
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

                      // SUDAH DITERBITKAN RESMI
                      const umumGrades = semGrades.filter((g) => !g.kelompok || g.kelompok === 'umum');
                      const mulokGrades = semGrades.filter((g) => g.kelompok === 'mulok');

                      return (
                        <div
                          key={p.id}
                          className="bg-white rounded-3xl border border-primary/10 p-6 shadow-sm space-y-5"
                        >
                          {/* Header Rapor & Tombol Unduh */}
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

                          {/* KONTEN SD: Muatan Pelajaran Umum */}
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

                          {/* Ekstrakurikuler */}
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

            {/* KONTEN TAB UJIAN */}
            {activeTab === 'exams' && (
              <div className="space-y-4">
                {filteredExams.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-primary/10 p-12 text-center text-primary/50 space-y-2">
                    <Award size={36} className="mx-auto text-primary/30" />
                    <p className="font-semibold text-sm">Belum ada nilai ujian yang diterbitkan</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredExams.map((ex) => (
                      <div key={ex.id} className="bg-white rounded-2xl border border-primary/10 p-5 shadow-sm space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[11px] font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-lg">
                            {ex.subject}
                          </span>
                          <span className="text-xl font-bold font-display text-secondary">{ex.score}</span>
                        </div>
                        <h4 className="font-semibold text-primary text-sm">{ex.title}</h4>
                        <div className="text-[11px] text-primary/50 flex items-center gap-1">
                          <Calendar size={12} /> {ex.exam_date || '-'}
                        </div>
                        {ex.notes && (
                          <p className="text-xs italic text-primary/80 bg-ivory p-2.5 rounded-lg border border-primary/5">
                            "{ex.notes}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: PILIHAN AKSES SISWA (A. DATA SISWA vs B. NILAI RAPOR) */}
      {/* ========================================================================= */}
      {showChoiceModal && targetStudent && (
        <div className="fixed inset-0 z-50 bg-forest/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-primary/10 space-y-6 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-primary/5 pb-4">
              <div className="flex items-center gap-3">
                <Avatar gender={targetStudent.jenis_kelamin} className="w-12 h-12" />
                <div>
                  <h3 className="font-display font-bold text-base text-primary leading-tight">
                    {targetStudent.nama_siswa}
                  </h3>
                  <p className="text-xs text-primary/60 font-sans">Kelas {targetStudent.kelas}</p>
                </div>
              </div>
              <button
                onClick={() => setShowChoiceModal(false)}
                className="p-1.5 rounded-full text-primary/40 hover:text-primary hover:bg-primary/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-primary/70">
                Pilih jenis informasi ananda yang ingin dilihat:
              </p>

              {/* Pilihan A: Data Siswa (Profil) */}
              <button
                onClick={() => handleOpenProfile(targetStudent)}
                className="w-full p-4 rounded-2xl border border-primary/15 hover:border-secondary hover:bg-secondary/5 transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary group-hover:bg-secondary group-hover:text-white flex items-center justify-center transition-colors">
                    <User size={18} />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-primary group-hover:text-forest">
                      A. Data Siswa
                    </h4>
                    <p className="text-[11px] text-primary/60">
                      Identitas diri, orang tua, & domisili resmi
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-primary/40 group-hover:text-secondary group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Pilihan B: Nilai Rapor (Perlu NISN untuk SD) */}
              <button
                onClick={() => handleOpenRaport(targetStudent)}
                className="w-full p-4 rounded-2xl border border-primary/15 hover:border-secondary hover:bg-secondary/5 transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary group-hover:bg-secondary group-hover:text-white flex items-center justify-center transition-colors">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-display font-bold text-sm text-primary group-hover:text-forest">
                        B. Nilai Rapor
                      </h4>
                      {String(targetStudent.kelas).toUpperCase() !== 'TK' && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          Kunci NISN
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-primary/60">
                      Capaian Kurikulum Merdeka & Unduh PDF
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-primary/40 group-hover:text-secondary group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VERIFIKASI NISN / NIS (KHUSUS SD SEBELUM BUKA RAPOR) */}
      {/* ========================================================================= */}
      {showAuthModal && targetStudent && (
        <div className="fixed inset-0 z-50 bg-forest/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-primary/10 space-y-5 animate-scaleUp">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center mx-auto">
                <ShieldCheck size={24} />
              </div>
              <h3 className="font-display font-bold text-lg text-primary">
                Verifikasi Keamanan Rapor
              </h3>
              <p className="text-xs text-primary/70 leading-relaxed">
                Untuk melindungi privasi ananda <b>{targetStudent.nama_siswa}</b>, silakan masukkan <b>NISN</b> atau <b>NIS</b> siswa.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeLoadRaport(targetStudent.id, authCode);
              }}
              className="space-y-4"
            >
              <div>
                <input
                  type="text"
                  placeholder="Masukkan 10 digit NISN atau NIS…"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  autoFocus
                  required
                  className="w-full bg-ivory border-2 border-primary/20 rounded-2xl px-4 py-3 text-center text-sm font-bold text-primary tracking-widest placeholder:text-primary/40 focus:outline-none focus:border-secondary transition-all"
                />
                {authError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1.5 text-center">
                    {authError}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  disabled={authenticating}
                  className="flex-1 py-3 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={authenticating || !authCode.trim()}
                  className="flex-1 py-3 rounded-xl bg-secondary text-white text-xs font-bold uppercase tracking-wider hover:brightness-95 transition-all shadow-md shadow-secondary/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {authenticating ? <Loader2 size={14} className="animate-spin" /> : 'Buka Rapor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-forest text-ivory/60 text-center py-6 text-xs border-t border-primary/20 mt-12">
        <p>© {new Date().getFullYear()} Sekolah Islam Imam Syafi'i Percut Sei Tuan. Seluruh hak cipta dilindungi.</p>
      </footer>
    </div>
  );
}
