import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  BookOpen,
  BookMarked,
  Award,
  Users,
  FileBarChart2,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  FileSpreadsheet,
  Printer,
  Calendar,
  Layers,
  HeartHandshake
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchSchoolData } from '../../services/gsheet';

export default function TeacherHome() {
  const navigate = useNavigate();

  // Pengguna login saat ini
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('teacherUser') || sessionStorage.getItem('teacherUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Waktu Live Digital Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sapaan Berdasarkan Jam
  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 3 && hour < 11) return 'Selamat Pagi';
    if (hour >= 11 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }, [currentTime]);

  // Data Akademik Sekolah dari Server Cloudflare D1
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassTab, setSelectedClassTab] = useState('ALL');

  useEffect(() => {
    let isMounted = true;
    fetchSchoolData().then((data) => {
      if (isMounted) {
        setSchoolData(data || {});
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Olah Metrik Akademik Siswa
  const studentMetrics = useMemo(() => {
    const students = (schoolData && schoolData.Students) || [];
    const active = students.filter(
      (s) => (s.status || s.status_siswa) !== 'Keluar' && (s.kelas || s.kelas_id) !== 'Tamat'
    );

    // Hitung per kelas
    const byClass = {};
    let lkCount = 0;
    let prCount = 0;

    active.forEach((s) => {
      const cls = s.kelas || s.kelas_id || 'Lainnya';
      byClass[cls] = (byClass[cls] || 0) + 1;

      const jk = (s.jenis_kelamin || '').toLowerCase();
      if (jk.includes('laki') || jk === 'l') lkCount++;
      else if (jk.includes('perempuan') || jk === 'p') prCount++;
    });

    return {
      totalActive: active.length,
      totalAll: students.length,
      byClass,
      lkCount,
      prCount,
      classes: Object.keys(byClass).sort(),
    };
  }, [schoolData]);

  // Olah Metrik Mata Pelajaran & Kurikulum
  const subjectMetrics = useMemo(() => {
    const subjects = (schoolData && schoolData.MasterSubjects) || [];
    const activeSubjects = subjects.filter((s) => s.is_active == null || Number(s.is_active) === 1);
    return {
      total: activeSubjects.length,
      rawTotal: subjects.length,
    };
  }, [schoolData]);

  // Olah Metrik Bank Soal
  const questionMetrics = useMemo(() => {
    const questions = (schoolData && schoolData.TeacherQuestions) || [];
    return {
      total: questions.length,
    };
  }, [schoolData]);

  // Olah Metrik E-Raport & Penilaian
  const reportMetrics = useMemo(() => {
    const periods = (schoolData && schoolData.ReportPeriods) || [];
    const grades = (schoolData && schoolData.ReportGrades) || [];
    const publications = (schoolData && schoolData.GradePublications) || [];
    const publishedCount = publications.filter((p) => p.is_published === 1 || p.is_published === '1').length;

    return {
      totalPeriods: periods.length,
      totalGrades: grades.length,
      publishedCount,
      publications,
    };
  }, [schoolData]);

  // Quick Action Power Hub
  const quickActions = [
    {
      title: 'E-Raport Kurikulum Merdeka',
      subtitle: 'Input CP, deskripsi nilai akhir & unduh PDF rapor resmi.',
      path: '/dashboard-guru/eraport',
      icon: FileBarChart2,
      accent: 'from-emerald-600 to-teal-700',
      badge: 'Prioritas Semester',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      shadow: 'shadow-emerald-900/10 hover:shadow-emerald-900/20',
    },
    {
      title: 'Publikasi Nilai ke Ortu',
      subtitle: 'Buka atau kunci akses nilai ulangan di portal wali murid.',
      path: '/dashboard-guru/nilai',
      icon: Award,
      accent: 'from-amber-500 to-amber-700',
      badge: 'Portal Ortu',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      shadow: 'shadow-amber-900/10 hover:shadow-amber-900/20',
    },
    {
      title: 'Bank Soal Digital',
      subtitle: 'Kelola butir soal evaluasi, format cetak DOCX/PDF & kunci.',
      path: '/dashboard-guru/soal',
      icon: BookOpen,
      accent: 'from-blue-600 to-indigo-700',
      badge: 'Cetak Ujian',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      shadow: 'shadow-blue-900/10 hover:shadow-blue-900/20',
    },
    {
      title: 'Data Induk Siswa & KK',
      subtitle: 'Arsip induk data siswa, berkas KK, NISN & kontak orang tua.',
      path: '/dashboard-guru/siswa',
      icon: GraduationCap,
      accent: 'from-cyan-600 to-blue-700',
      badge: 'Master Siswa',
      badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      shadow: 'shadow-cyan-900/10 hover:shadow-cyan-900/20',
    },
    {
      title: 'Mata Pelajaran (Mapel)',
      subtitle: 'Konfigurasi susunan mapel, kelompok umum & muatan diniyah.',
      path: '/dashboard-guru/mapel',
      icon: BookMarked,
      accent: 'from-purple-600 to-indigo-800',
      badge: 'Kurikulum',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      shadow: 'shadow-purple-900/10 hover:shadow-purple-900/20',
    },
    {
      title: 'Presensi Harian Guru',
      subtitle: 'Check-in datang & pulang dengan validasi radius GPS sekolah.',
      path: '/dashboard-guru/absensi',
      icon: Clock,
      accent: 'from-rose-500 to-pink-700',
      badge: 'Harian GPS',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      shadow: 'shadow-rose-900/10 hover:shadow-rose-900/20',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* ============================================================== */}
      {/* 1. HERO COMMAND CENTER (BANNER EKSEKUTIF BERKELAS)             */}
      {/* ============================================================== */}
      <section className="relative overflow-hidden bg-slate-950 text-white rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border border-white/10">
        {/* Glow Ambient Lights */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 bg-emerald-600/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            {/* Pill Header Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-[11px] font-black uppercase tracking-widest text-emerald-300 mb-4">
              <Sparkles size={13} className="text-amber-400 animate-pulse" />
              <span>Sistem Informasi Akademik Terpadu</span>
            </div>

            {/* Sapaan Personal Guru */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-3">
              {greeting},{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent italic">
                {currentUser?.name || 'Ustadz / Ustadzah'}
              </span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-xl">
              Selamat datang di pusat kendali akademik Sekolah Islam Imam Syafi'i. Pantau data siswa, kelola capaian pembelajaran Kurikulum Merdeka, dan terbitkan nilai secara terpadu.
            </p>

            {/* Tombol Aksi Langsung di Hero */}
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Link
                to="/dashboard-guru/eraport"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-secondary hover:bg-forest text-white text-xs font-black shadow-lg shadow-secondary/30 active:scale-95 transition-all"
              >
                <FileBarChart2 size={16} />
                <span>Buka E-Raport Siswa</span>
              </Link>
              <Link
                to="/dashboard-guru/nilai"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black border border-white/15 backdrop-blur-md active:scale-95 transition-all"
              >
                <Award size={16} />
                <span>Publikasi Nilai Ortu</span>
              </Link>
              <Link
                to="/dashboard-guru/absensi"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-black active:scale-95 transition-all"
              >
                <Clock size={16} />
                <span>Absensi Mandiri</span>
              </Link>
            </div>
          </div>

          {/* Widget Jam Digital & Kalender WIB */}
          <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-3.5 bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-secondary/20 text-emerald-400">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Waktu Server (WIB)</p>
                <p className="text-2xl font-mono font-black text-white tracking-wider">
                  {currentTime.toLocaleTimeString('id-ID', { hour12: false })}
                </p>
              </div>
            </div>

            <div className="h-px bg-white/10 my-1 hidden lg:block" />

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-400/10 text-amber-300">
                <Calendar size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kalender Akademik</p>
                <p className="text-xs font-black text-slate-200">
                  {currentTime.toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-[10px] text-amber-300 font-bold mt-0.5">TP 2026/2027 &bull; Semester Ganjil</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. EXECUTIVE ACADEMIC KPI CARDS                                */}
      {/* ============================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI 1: Siswa Aktif */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Peserta Didik
              </span>
              <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
                {loading ? '...' : studentMetrics.totalActive}
                <span className="text-xs font-bold text-slate-400 ml-1.5 font-sans">Siswa Aktif</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-secondary to-forest text-white flex items-center justify-center shadow-lg shadow-secondary/20 group-hover:scale-110 transition-transform">
              <GraduationCap size={24} />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Ikhwan: <b className="text-slate-800">{studentMetrics.lkCount}</b></span>
            <span>&bull;</span>
            <span>Akhwat: <b className="text-slate-800">{studentMetrics.prCount}</b></span>
          </div>
        </motion.div>

        {/* KPI 2: Mata Pelajaran */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Kurikulum
              </span>
              <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
                {loading ? '...' : subjectMetrics.total}
                <span className="text-xs font-bold text-slate-400 ml-1.5 font-sans">Mata Pelajaran</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
              <BookMarked size={24} />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Diniyah, Tematik & Mulok</span>
            <Link to="/dashboard-guru/mapel" className="text-blue-600 hover:underline">Kelola &rarr;</Link>
          </div>
        </motion.div>

        {/* KPI 3: Bank Soal Siap Ujian */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-purple-900/5 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                Evaluasi Belajar
              </span>
              <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
                {loading ? '...' : questionMetrics.total}
                <span className="text-xs font-bold text-slate-400 ml-1.5 font-sans">Butir Soal</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-800 text-white flex items-center justify-center shadow-lg shadow-purple-600/20 group-hover:scale-110 transition-transform">
              <BookOpen size={24} />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>Pilihan Ganda & Isian</span>
            <Link to="/dashboard-guru/soal" className="text-purple-600 hover:underline">Bank Soal &rarr;</Link>
          </div>
        </motion.div>

        {/* KPI 4: Nilai & E-Raport */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-amber-900/5 transition-all flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                Hasil Penilaian
              </span>
              <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
                {loading ? '...' : reportMetrics.totalPeriods}
                <span className="text-xs font-bold text-slate-400 ml-1.5 font-sans">Rapor Terisi</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
              <Award size={24} />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>{reportMetrics.publishedCount} Terbit ke Wali Murid</span>
            <Link to="/dashboard-guru/eraport" className="text-amber-600 hover:underline">E-Raport &rarr;</Link>
          </div>
        </motion.div>
      </section>

      {/* ============================================================== */}
      {/* 3. DISTRIBUSI KELAS & PROGRESS PENILAIAN SISWA                 */}
      {/* ============================================================== */}
      <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                Distribusi & Komposisi Siswa Per-Kelas
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Gambaran jumlah siswa aktif SD Islam Imam Syafi'i untuk persiapan pembelajaran & rapor
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard-guru/siswa"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-secondary hover:text-white text-slate-700 text-xs font-black transition-all"
            >
              <Users size={14} />
              <span>Kelola Seluruh Siswa</span>
            </Link>
          </div>
        </div>

        {/* Grid Kartu Kelas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {studentMetrics.classes.map((className) => {
            const count = studentMetrics.byClass[className] || 0;
            const percentage = studentMetrics.totalActive > 0
              ? Math.round((count / studentMetrics.totalActive) * 100)
              : 0;

            return (
              <div
                key={className}
                className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200/80 shadow-sm hover:border-secondary/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-black text-sm">
                      {className.replace('SD', '').trim()}
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {percentage}% Populasi
                    </span>
                  </div>

                  <h4 className="text-base font-black text-slate-900">{className}</h4>
                  <p className="text-xs text-slate-400 font-bold mb-4">
                    Kurikulum Merdeka &bull; Fase A/B
                  </p>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-slate-600">Jumlah Siswa:</span>
                      <span className="text-slate-900 font-black">{count} Siswa</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-secondary to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Pintasan Aksi Kelas */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs font-black">
                  <Link
                    to="/dashboard-guru/eraport"
                    className="py-2 rounded-xl bg-emerald-50 hover:bg-secondary text-secondary hover:text-white transition-all"
                  >
                    E-Raport
                  </Link>
                  <Link
                    to="/dashboard-guru/nilai"
                    className="py-2 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white transition-all"
                  >
                    Input Nilai
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. QUICK-ACTION POWER HUB (PUSAT PINTASAN 6 MODUL UTAMA)       */}
      {/* ============================================================== */}
      <section>
        <div className="flex items-center justify-between mb-6 px-1">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Pusat Akses Cepat Modul Guru
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5">
              Pintasan 1-klik ke tugas dan tanggung jawab harian pendidik
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
              >
                <Link
                  to={action.path}
                  className={`bg-white rounded-3xl p-6 border border-slate-100 shadow-sm ${action.shadow} hover:-translate-y-1 transition-all flex flex-col justify-between h-full group block`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${action.accent} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                        <Icon size={26} />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${action.badgeBg}`}>
                        {action.badge}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-secondary transition-colors mb-2">
                      {action.title}
                    </h3>

                    <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-6">
                      {action.subtitle}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-black text-slate-400 group-hover:text-secondary transition-colors">
                    <span>Buka Modul</span>
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 5. PANDUAN PENTING & STATUS KURIKULUM MERDEKA                   */}
      {/* ============================================================== */}
      <section className="bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 border border-emerald-100 p-6 sm:p-8 rounded-3xl shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-secondary text-white rounded-2xl shadow-md shrink-0 mt-0.5">
            <HeartHandshake size={24} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1">
              Panduan Guru & Nilai Kurikulum Merdeka (MIAS)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed mb-4">
              Penilaian E-Raport menggunakan format Kurikulum Merdeka dengan deskripsi capaian pembelajaran (Tujuan Pembelajaran) yang telah dikuasai atau perlu ditingkatkan. Seluruh data rapor dapat langsung dicetak berformat kop resmi sekolah berformat PDF.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/dashboard-guru/eraport"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-white text-xs font-black hover:bg-forest transition-all"
              >
                <Printer size={14} /> Cetak Format Rapor Resmi
              </Link>
              <Link
                to="/dashboard-guru/mapel"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-slate-700 border border-slate-200 text-xs font-black hover:bg-slate-50 transition-all"
              >
                <SlidersHorizontal size={14} /> Cek Susunan Mata Pelajaran
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
