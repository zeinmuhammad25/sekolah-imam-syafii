import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Download, Printer, Sparkles, CheckCircle2,
  ChevronLeft, ChevronRight, Loader2, Layers, ShieldCheck
} from 'lucide-react';
import {
  generateStudentQrCode,
  generateSingleCardPdf,
  generateBatchA4Pdf,
  SCHOOL_INFO
} from '../../services/studentIdCardPdf';

export default function StudentIdCardModal({
  isOpen,
  onClose,
  initialStudent,
  students = [],
  activeGrade = 'SD 1',
  selectedStudents = []
}) {
  const [currentStudent, setCurrentStudent] = useState(initialStudent);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [themeMode, setThemeMode] = useState('auto'); // 'auto' | 'sd' | 'tk'
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [isZoomQr, setIsZoomQr] = useState(false);

  // Sinkronisasi siswa saat modal dibuka
  useEffect(() => {
    if (initialStudent) {
      setCurrentStudent(initialStudent);
    } else if (students.length > 0) {
      setCurrentStudent(students[0]);
    }
  }, [initialStudent, students, isOpen]);

  // Generate QR Code saat siswa berganti
  useEffect(() => {
    let isMounted = true;
    if (currentStudent) {
      generateStudentQrCode(currentStudent).then((url) => {
        if (isMounted) setQrDataUrl(url || '');
      });
    }
    return () => { isMounted = false; };
  }, [currentStudent]);

  if (!isOpen || !currentStudent) return null;

  // Tentukan apakah TK atau SD
  const isTk = themeMode === 'tk'
    ? true
    : themeMode === 'sd'
    ? false
    : String(currentStudent.kelas || activeGrade || '').toUpperCase().includes('TK');

  const cfg = isTk ? SCHOOL_INFO.tk : SCHOOL_INFO.sd;
  const isAkhwat = String(currentStudent.jenis_kelamin || '').toLowerCase().includes('p');
  const fallbackAvatar = isAkhwat ? '/avatars/akhwat.webp' : '/avatars/ikhwan.webp';
  const photoSrc = currentStudent.foto_siswa || fallbackAvatar;

  // Navigasi siswa (toleran perbandingan string vs number id)
  const currentIndex = students.findIndex((s) => String(s.id) === String(currentStudent.id));
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentStudent(students[currentIndex - 1]);
    }
  };
  const handleNext = () => {
    if (currentIndex < students.length - 1) {
      setCurrentStudent(students[currentIndex + 1]);
    }
  };

  // Handler Download Single Card PDF (1 Halaman ISO CR-80)
  const handleDownloadSingle = async () => {
    try {
      setGeneratingPdf(true);
      setPdfProgress('Menyiapkan file PDF kartu pelajar (1 Sisi)...');
      await generateSingleCardPdf(currentStudent, isTk);
    } catch (err) {
      alert('Gagal membuat PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
      setPdfProgress('');
    }
  };

  // Handler Download Batch Class A4 PDF (10 Kartu per Lembar A4)
  const handleDownloadBatch = async (batchList, label) => {
    try {
      setGeneratingPdf(true);
      setPdfProgress(`Memproses ${batchList.length} kartu siswa ke format A4 (10 kartu/lembar)...`);
      await generateBatchA4Pdf(batchList, label, isTk);
    } catch (err) {
      alert('Gagal membuat PDF Massal: ' + err.message);
    } finally {
      setGeneratingPdf(false);
      setPdfProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg leading-tight">
                Kartu Pelajar & Presensi Digital (ID Card)
              </h3>
              <p className="text-slate-400 font-bold text-xs">
                Desain Fisik Resmi Standar ISO CR-80 (54 x 85.6 mm) • Single-Sided dengan QR Presensi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Modal (2 Kolom: Kiri Mockup Fisik Lanyard, Kanan Kontrol & Cetak) */}
        <div className="flex-grow p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Kolom Kiri: Visual Realistis ID Card + Lanyard Hook (5 Kolom) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            {/* Navigasi Siswa */}
            <div className="flex items-center justify-between w-full max-w-[270px] mb-2 text-xs font-bold text-slate-500">
              <button
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft size={16} /> Sebelumnya
              </button>
              <span className="text-[11px] font-black text-slate-700">
                {currentIndex >= 0 ? `${currentIndex + 1} / ${students.length}` : ''}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex >= students.length - 1}
                className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
              >
                Berikut <ChevronRight size={16} />
              </button>
            </div>

            {/* Mockup Tali Lanyard Hijau & Pengait Besi (Seperti di Foto Asli) */}
            <div className="flex flex-col items-center select-none">
              {/* Tali Lanyard Hijau */}
              <div className="w-10 h-7 bg-emerald-600 rounded-t-sm shadow-inner flex items-center justify-center border-x-2 border-emerald-700">
                <div className="w-2 h-full bg-emerald-500/40" />
              </div>
              {/* Cincin Logam & Jepitan Logam */}
              <div className="w-6 h-3 rounded-full border-2 border-slate-400 -mt-1 bg-slate-300" />
              <div className="w-4 h-5 border-2 border-slate-500 rounded-b-md bg-gradient-to-b from-slate-300 to-slate-400 shadow-sm" />
            </div>

            {/* CONTAINER KARTU FISIK (Rasio 54 x 85.6 mm -> 260px x 412px) */}
            <div className="relative w-[260px] h-[412px] rounded-[18px] overflow-hidden shadow-2xl border border-slate-300/60 select-none -mt-1 flex flex-col justify-between">
              {/* LUBANG TALI KARTU (Lanyard Slot Punch) */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-2 rounded-full bg-black/40 border border-white/20 z-20 pointer-events-none" />

              {/* TEMA SD: DEEP EMERALD + MIHRAB GOLD + MENARA */}
              {!isTk && (
                <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#064e3b] via-[#022c22] to-[#011c15] flex flex-col justify-between overflow-hidden">
                  {/* Watermark Pola Arabesque */}
                  <svg className="absolute inset-0 w-full h-44 opacity-20 pointer-events-none text-amber-300" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="islamicGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M15 0 L30 15 L15 30 L0 15 Z" fill="none" stroke="currentColor" strokeWidth="1" />
                        <circle cx="15" cy="15" r="1.5" fill="currentColor" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#islamicGrid)" />
                  </svg>

                  {/* Outline Mihrab Arch Emas di Atas */}
                  <svg className="absolute top-4 left-0 w-full h-48 pointer-events-none" viewBox="0 0 260 190" fill="none">
                    <path
                      d="M 16 190 L 16 115 C 16 65, 75 30, 130 16 C 185 30, 244 65, 244 115 L 244 190"
                      stroke="url(#goldArchGrad)"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 22 190 L 22 118 C 22 72, 78 40, 130 26 C 182 40, 238 72, 238 118 L 238 190"
                      stroke="url(#goldArchGrad)"
                      strokeWidth="1.2"
                    />
                    <defs>
                      <linearGradient id="goldArchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="40%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#b45309" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Bagian Atas: Logo & Header Sekolah */}
                  <div className="pt-7 px-3 flex flex-col items-center relative z-10 text-center">
                    <img
                      src={cfg.logo}
                      alt="Logo SD"
                      className="w-[46px] h-[46px] object-contain drop-shadow-md mb-1"
                    />
                    <h4 className="text-white font-black text-[12px] leading-tight tracking-wider drop-shadow-xs uppercase">
                      KARTU PELAJAR
                    </h4>
                    <p className="text-[#fbbf24] font-black text-[10.5px] tracking-wide leading-tight drop-shadow-xs uppercase">
                      SD ISLAM IMAM SYAFI'I
                    </p>
                  </div>

                  {/* Bagian Tengah: Pas Foto Siswa Bulat dengan Double Ring Emas */}
                  <div className="flex flex-col items-center relative z-10 my-1">
                    <div className="w-[102px] h-[102px] rounded-full p-[3px] bg-gradient-to-tr from-[#b45309] via-[#fbbf24] to-[#fef08a] shadow-xl">
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#064e3b] bg-slate-100 flex items-center justify-center">
                        <img
                          src={photoSrc}
                          alt={currentStudent.nama_siswa}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Data Nama & NISN (Left-aligned colons) */}
                    <div className="mt-2.5 px-6 w-full text-white font-black text-[10.5px] leading-snug">
                      <div className="flex items-start">
                        <span className="w-12 shrink-0">NAMA</span>
                        <span className="mx-1">:</span>
                        <span className="uppercase line-clamp-1 flex-grow">
                          {currentStudent.nama_siswa || 'NAMA SISWA'}
                        </span>
                      </div>
                      <div className="flex items-center mt-0.5">
                        <span className="w-12 shrink-0">NISN</span>
                        <span className="mx-1">:</span>
                        <span className="font-mono">
                          {currentStudent.nisn || currentStudent.nis || currentStudent.id || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bagian Bawah: QR Code Box + Menara Masjid Emas Sudut */}
                  <div className="relative z-10 pb-2 px-3 flex flex-col items-center">
                    {/* Kotak Putih QR Code (Dapat diklik untuk memperbesar saat scan tes) */}
                    <div
                      onClick={(e) => { e.stopPropagation(); setIsZoomQr(true); }}
                      title="Klik untuk memperbesar QR Code agar mudah di-scan dari HP lain"
                      className="bg-white rounded-xl p-1.5 shadow-lg flex flex-col items-center justify-center w-26 cursor-pointer hover:scale-105 active:scale-95 transition-all group/qr"
                    >
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR" className="w-[74px] h-[74px] object-contain" />
                      ) : (
                        <div className="w-[74px] h-[74px] flex items-center justify-center">
                          <Loader2 className="animate-spin text-slate-400" size={18} />
                        </div>
                      )}
                      <span className="text-[9.5px] font-black text-black font-mono leading-none mt-0.5 mb-0.5">
                        {currentStudent.nisn || currentStudent.nis || currentStudent.id || '20240987'}
                      </span>
                    </div>

                    {/* Teks Scan Untuk Absensi */}
                    <p className="text-[#fbbf24] font-black text-[9px] tracking-widest uppercase mt-1 drop-shadow-xs">
                      SCAN UNTUK ABSENSI
                    </p>

                    {/* Siluet Menara Masjid Emas di Sudut Kiri & Kanan */}
                    <svg className="absolute bottom-0 left-0 w-16 h-20 pointer-events-none text-amber-500" viewBox="0 0 70 90" fill="none">
                      <path
                        d="M 0 90 L 0 50 C 10 40, 28 20, 35 5 C 42 20, 60 40, 70 50 L 70 90 Z"
                        fill="url(#goldMinaretGrad)"
                      />
                      <circle cx="35" cy="5" r="4" fill="#fef08a" />
                      <defs>
                        <linearGradient id="goldMinaretGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fef08a" />
                          <stop offset="50%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#b45309" />
                        </linearGradient>
                      </defs>
                    </svg>

                    <svg className="absolute bottom-0 right-0 w-16 h-20 pointer-events-none text-amber-500 scale-x-[-1]" viewBox="0 0 70 90" fill="none">
                      <path
                        d="M 0 90 L 0 50 C 10 40, 28 20, 35 5 C 42 20, 60 40, 70 50 L 70 90 Z"
                        fill="url(#goldMinaretGrad)"
                      />
                      <circle cx="35" cy="5" r="4" fill="#fef08a" />
                    </svg>
                  </div>
                </div>
              )}

              {/* TEMA TK: LIME-YELLOW + AWAN + BINTANG + GELOMBANG HIJAU */}
              {isTk && (
                <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#84cc16] via-[#a3e635] to-[#facc15] flex flex-col justify-between overflow-hidden">
                  {/* Awan Kartun Putih */}
                  <div className="absolute top-12 left-3 w-16 h-8 bg-white rounded-full shadow-xs opacity-95 pointer-events-none before:absolute before:-top-3 before:left-3 before:w-8 before:h-8 before:bg-white before:rounded-full after:absolute after:-top-1.5 after:left-7 after:w-6 after:h-6 after:bg-white after:rounded-full" />
                  <div className="absolute top-36 -right-2 w-16 h-8 bg-white rounded-full shadow-xs opacity-95 pointer-events-none before:absolute before:-top-3 before:left-2 before:w-8 before:h-8 before:bg-white before:rounded-full" />
                  <div className="absolute bottom-28 -left-3 w-16 h-8 bg-white rounded-full shadow-xs opacity-95 pointer-events-none before:absolute before:-top-2 before:left-3 before:w-7 before:h-7 before:bg-white before:rounded-full" />

                  {/* Bintang-Bintang Kuning */}
                  <span className="absolute top-14 right-5 text-yellow-200 text-xl font-black">★</span>
                  <span className="absolute top-36 left-4 text-white text-sm font-black">★</span>
                  <span className="absolute bottom-32 right-4 text-emerald-800 text-sm font-black">★</span>

                  {/* Bagian Atas: Logo & Header TK */}
                  <div className="pt-7 px-3 flex flex-col items-center relative z-10 text-center">
                    <img
                      src={cfg.logo}
                      alt="Logo TK"
                      className="w-[48px] h-[48px] object-contain drop-shadow-md mb-1"
                    />
                    <h4 className="text-[#ca8a04] font-black text-[12px] leading-tight tracking-wider drop-shadow-xs uppercase">
                      KARTU PELAJAR
                    </h4>
                    <p className="text-white font-black text-[10.5px] tracking-wide leading-tight drop-shadow-xs uppercase">
                      TK QUR'AN IMAM SYAFI'I
                    </p>
                  </div>

                  {/* Bagian Tengah: Pas Foto Siswa Bulat dengan Ring Hijau & Putih */}
                  <div className="flex flex-col items-center relative z-10 my-1">
                    <div className="w-[102px] h-[102px] rounded-full p-[3.5px] bg-[#15803d] shadow-xl">
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-slate-100 flex items-center justify-center">
                        <img
                          src={photoSrc}
                          alt={currentStudent.nama_siswa}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Data Nama Siswa TK */}
                    <div className="mt-2.5 px-4 w-full text-center text-[#064e3b] font-black text-[11px] leading-tight uppercase line-clamp-1">
                      NAMA : {currentStudent.nama_siswa || 'MUHAMMAD ALFATIH'}
                    </div>
                  </div>

                  {/* Bagian Bawah: Gelombang Rumput Hijau & QR Code */}
                  <div className="relative z-10 pb-2 px-3 flex flex-col items-center">
                    {/* Gelombang Rumput Hijau Tua */}
                    <svg className="absolute bottom-0 left-0 w-full h-24 pointer-events-none" viewBox="0 0 260 90" fill="none">
                      <path
                        d="M 0 45 C 70 20, 180 55, 260 30 L 260 90 L 0 90 Z"
                        fill="#16a34a"
                      />
                      <path
                        d="M 0 55 C 90 65, 170 30, 260 48 L 260 90 L 0 90 Z"
                        fill="#15803d"
                      />
                    </svg>

                    {/* Kotak Putih QR Code (Dapat diklik untuk memperbesar saat scan tes) */}
                    <div
                      onClick={(e) => { e.stopPropagation(); setIsZoomQr(true); }}
                      title="Klik untuk memperbesar QR Code agar mudah di-scan dari HP lain"
                      className="bg-white rounded-xl p-1.5 shadow-lg flex flex-col items-center justify-center w-26 relative z-10 cursor-pointer hover:scale-105 active:scale-95 transition-all group/qr"
                    >
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR" className="w-[74px] h-[74px] object-contain" />
                      ) : (
                        <div className="w-[74px] h-[74px] flex items-center justify-center">
                          <Loader2 className="animate-spin text-slate-400" size={18} />
                        </div>
                      )}
                      <span className="text-[9.5px] font-black text-black font-mono leading-none mt-0.5 mb-0.5">
                        {currentStudent.nis || currentStudent.id || '242501001'}
                      </span>
                    </div>

                    {/* Teks Scan Untuk Absensi */}
                    <p className="text-white font-black text-[9px] tracking-widest uppercase mt-1 relative z-10 drop-shadow-xs">
                      SCAN UNTUK ABSENSI
                    </p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] font-bold text-slate-400 mt-2.5">
              1 Sisi Saja (Single-Sided • Blank Back)
            </p>
          </div>

          {/* Kolom Kanan: Pengaturan & Cetak (7 Kolom) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Status Siswa Terpilih */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Data Siswa
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <CheckCircle2 size={11} /> {currentStudent.foto_siswa ? 'Pas Foto Ada' : 'Avatar Standar'}
                </span>
              </div>
              <h4 className="font-black text-lg text-slate-900 leading-tight">
                {currentStudent.nama_siswa}
              </h4>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                Kelas: <span className="text-emerald-700">{currentStudent.kelas || activeGrade}</span> • NISN: {currentStudent.nisn || '-'} • NIS: {currentStudent.nis || '-'}
              </p>
            </div>

            {/* Pilihan Tema Desain */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                Pilih Tema Desain ID Card
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setThemeMode('auto')}
                  className={`p-3 rounded-2xl border text-left font-black text-xs transition-all ${
                    themeMode === 'auto'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="font-black">Otomatis</p>
                  <p className="text-[10px] font-normal text-slate-500 mt-0.5">Sesuai kelas siswa</p>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('sd')}
                  className={`p-3 rounded-2xl border text-left font-black text-xs transition-all ${
                    themeMode === 'sd'
                      ? 'border-emerald-600 bg-emerald-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="font-black">Tema SD Islam</p>
                  <p className="text-[10px] font-normal text-slate-300 mt-0.5">Deep Emerald & Gold</p>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('tk')}
                  className={`p-3 rounded-2xl border text-left font-black text-xs transition-all ${
                    themeMode === 'tk'
                      ? 'border-amber-500 bg-emerald-600 text-amber-200 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="font-black">Tema TK Qur'an</p>
                  <p className="text-[10px] font-normal text-emerald-100 mt-0.5">Ceria Hijau & Kuning</p>
                </button>
              </div>
            </div>

            {/* Opsi Unduh / Cetak */}
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Aksi Ekspor & Cetak Siap Pakai
              </h4>

              {/* Tombol 1: Cetak Satuan Siswa Ini (1 Halaman ISO CR-80) */}
              <button
                type="button"
                onClick={handleDownloadSingle}
                disabled={generatingPdf}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-black transition-all shadow-md active:scale-98 disabled:opacity-50"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Download size={18} />
                  </div>
                  <div>
                    <p className="font-black">Download PDF Kartu Ini (CR-80)</p>
                    <p className="text-xs text-slate-400 font-normal">Ukuran 54 x 85.6 mm • 1 Sisi Siap Cetak</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400 shrink-0">Satuan</span>
              </button>

              {/* Tombol 2: Cetak Lembar Massal A4 (10 Kartu per Lembar) */}
              <button
                type="button"
                onClick={() => handleDownloadBatch(students, activeGrade)}
                disabled={generatingPdf || students.length === 0}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-emerald-700 text-white font-black text-sm hover:bg-emerald-800 transition-all shadow-md active:scale-98 disabled:opacity-50"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Printer size={18} />
                  </div>
                  <div>
                    <p className="font-black">Cetak Massal 1 Kelas (A4 • 10 Kartu / Lembar)</p>
                    <p className="text-xs text-emerald-200 font-normal">
                      {students.length} siswa kelas {activeGrade} • Grid 5x2 + Garis Potong Presisi
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full shrink-0">A4 Massal</span>
              </button>

              {/* Tombol 3: Cetak Siswa Terpilih (jika ada centang) */}
              {selectedStudents.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleDownloadBatch(selectedStudents, `${activeGrade}_Terpilih`)}
                  disabled={generatingPdf}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-amber-600 text-white font-black text-sm hover:bg-amber-700 transition-all shadow-md active:scale-98 disabled:opacity-50"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <Layers size={18} />
                    </div>
                    <div>
                      <p className="font-black">Cetak {selectedStudents.length} Siswa Terpilih (A4)</p>
                      <p className="text-xs text-amber-200 font-normal">10 kartu per lembar A4 landscape</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full shrink-0">Terpilih</span>
                </button>
              )}
            </div>

            {/* Status Progress PDF */}
            {generatingPdf && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800">
                <Loader2 className="animate-spin text-emerald-600 shrink-0" size={20} />
                <p className="text-xs font-bold">{pdfProgress || 'Sedang memproses PDF kartu pelajar...'}</p>
              </div>
            )}

            {/* Petunjuk Cetak & Bahan */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-600 leading-relaxed space-y-1">
              <p className="font-black text-slate-800 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" /> Tips Cetak & Penggunaan:
              </p>
              <p>
                Gunakan <b>kertas foto tebal (210–260 gsm)</b> atau <b>kartu PVC inkjet</b>. Desain ini dibuat 1 sisi (single-sided). Untuk lembar A4, 10 kartu langsung dapat dipotong menggunakan gunting atau paper cutter, lalu dimasukkan ke dalam <i>casing card holder lanyard (54 x 85.6 mm)</i>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL ZOOM QR CODE (Untuk kemudahan pengujian scan antar layar smartphone) */}
      {isZoomQr && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setIsZoomQr(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Mode Uji Scan Presensi
              </span>
              <button
                onClick={() => setIsZoomQr(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-inner my-2">
              <img
                src={qrDataUrl}
                alt="Zoomed QR"
                className="w-56 h-56 object-contain"
              />
            </div>

            <h4 className="font-black text-slate-900 text-base mt-2 uppercase">
              {currentStudent.nama_siswa}
            </h4>
            <p className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
              KODE: {currentStudent.nisn || currentStudent.nis || currentStudent.id}
            </p>
            <p className="text-[11px] text-slate-400 mt-2">
              Arahkan kamera scanner ke layar ini dari jarak 15–20 cm.
            </p>

            <button
              onClick={() => setIsZoomQr(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-black"
            >
              Tutup Tampilan QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
