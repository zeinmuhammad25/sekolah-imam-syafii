import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar, Users, Filter, Download, RefreshCw, Search,
  Award, HeartPulse, UserCheck, UserX, Clock, ChevronDown,
  FileSpreadsheet, FileText, ShieldCheck, CheckCircle2, Copy, MessageSquare,
  Zap, CalendarDays, AlertCircle, X, Check, ArrowUpDown, ChevronRight
} from 'lucide-react';
import { getStudentAttendanceRecap, fetchSchoolData } from '../../services/gsheet';
import { exportStudentAttendancePdf } from '../../services/studentAttendancePdf';
import { ToastNotification } from './ModalKit';

const DEFAULT_GRADES = ['Semua Kelas', 'TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];

// Format tanggal YYYY-MM-DD sesuai zona waktu WIB (UTC+7)
function getTodayDate() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000));
  const yyyy = wib.getFullYear();
  const mm = String(wib.getMonth() + 1).padStart(2, '0');
  const dd = String(wib.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getYesterdayDate() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000) - (24 * 3600000));
  const yyyy = wib.getFullYear();
  const mm = String(wib.getMonth() + 1).padStart(2, '0');
  const dd = String(wib.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getStartOfMonthDate() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000));
  const yyyy = wib.getFullYear();
  const mm = String(wib.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

export default function TeacherStudentAttendanceRecap() {
  const [selectedGrade, setSelectedGrade] = useState('Semua Kelas');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [attendances, setAttendances] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'hadir' | 'belum_absen' | 'sakit' | 'izin' | 'alpha'
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', title: '' });

  const showToast = (message, type = 'success', title = '') => {
    setToast({ show: true, message, type, title });
  };

  // Muat data master siswa untuk memastikan semua kelas tampil lengkap
  useEffect(() => {
    fetchSchoolData().then((data) => {
      if (data && Array.isArray(data.students)) {
        const active = data.students.filter(
          (s) => !s.status || String(s.status).toLowerCase().trim() !== 'alumni'
        );
        setStudentsList((prev) => (prev.length === 0 ? active : prev));
      }
    }).catch((err) => {
      console.warn('Gagal memuat master siswa dari fetchSchoolData:', err);
    });
  }, []);

  const loadRecap = useCallback(async () => {
    setLoading(true);
    try {
      const kelasParam = selectedGrade === 'Semua Kelas' ? 'ALL' : selectedGrade;
      const res = await getStudentAttendanceRecap({
        kelas: kelasParam,
        startDate,
        endDate,
      });

      if (res.success) {
        setAttendances(res.attendances || []);
        if (Array.isArray(res.students) && res.students.length > 0) {
          setStudentsList(res.students);
        }
      } else {
        showToast(res.error || 'Gagal memuat rekap presensi.', 'error', 'Error');
      }
    } catch (err) {
      console.error('loadRecap error:', err);
      showToast('Koneksi terputus: ' + err.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  }, [selectedGrade, startDate, endDate]);

  useEffect(() => {
    loadRecap();
  }, [loadRecap]);

  // Daftar Jenjang / Kelas Gabungan
  const availableGrades = useMemo(() => {
    const set = new Set(DEFAULT_GRADES);
    studentsList.forEach((s) => {
      if (s.kelas && String(s.kelas).trim()) {
        set.add(String(s.kelas).trim());
      }
    });
    return Array.from(set);
  }, [studentsList]);

  const isSingleDay = startDate === endDate;
  const isToday = isSingleDay && startDate === getTodayDate();
  const isYesterday = isSingleDay && startDate === getYesterdayDate();
  const isCurrentMonth = startDate === getStartOfMonthDate() && endDate === getTodayDate();

  // Preset Cepat Tanggal
  const handleSetToday = () => {
    const today = getTodayDate();
    setStartDate(today);
    setEndDate(today);
  };

  const handleSetYesterday = () => {
    const yesterday = getYesterdayDate();
    setStartDate(yesterday);
    setEndDate(yesterday);
  };

  const handleSetThisMonth = () => {
    setStartDate(getStartOfMonthDate());
    setEndDate(getTodayDate());
  };

  // Agregasi Data per Siswa (Menampilkan SEMUA kelas dan seluruh siswa aktif)
  const studentSummary = useMemo(() => {
    const map = new Map();

    // 1. Saring master siswa sesuai filter kelas
    let relevantStudents = studentsList;
    if (selectedGrade && selectedGrade !== 'Semua Kelas') {
      const targetGrade = selectedGrade.trim().toLowerCase();
      relevantStudents = studentsList.filter(
        (s) => String(s.kelas || '').trim().toLowerCase() === targetGrade
      );
    }

    // Inisialisasi seluruh siswa dari master data
    relevantStudents.forEach((s) => {
      const sId = String(s.id);
      map.set(sId, {
        id: sId,
        nama: s.nama_siswa || s.nama || 'Siswa',
        nisn: s.nisn || s.nis || '-',
        kelas: s.kelas || '-',
        hadir: 0,
        sakit: 0,
        izin: 0,
        alpha: 0,
        total: 0,
        statusHariIni: null, // hadir | sakit | izin | alpha | null (belum scan)
        scanTime: null,
        method: null,
      });
    });

    // 2. Akumulasi data presensi yang tercatat pada rentang tanggal
    attendances.forEach((record) => {
      const sId = String(record.student_id);
      if (!map.has(sId)) {
        if (
          selectedGrade === 'Semua Kelas' ||
          String(record.kelas || '').trim().toLowerCase() === selectedGrade.trim().toLowerCase()
        ) {
          map.set(sId, {
            id: sId,
            nama: record.student_name || 'Siswa',
            nisn: '-',
            kelas: record.kelas || '-',
            hadir: 0,
            sakit: 0,
            izin: 0,
            alpha: 0,
            total: 0,
            statusHariIni: null,
            scanTime: null,
            method: null,
          });
        }
      }

      if (map.has(sId)) {
        const st = map.get(sId);
        st.total += 1;
        if (record.status === 'hadir') st.hadir += 1;
        else if (record.status === 'sakit') st.sakit += 1;
        else if (record.status === 'izin') st.izin += 1;
        else if (record.status === 'alpha') st.alpha += 1;

        if (isSingleDay) {
          st.statusHariIni = record.status;
          st.scanTime = record.scan_time;
          st.method = record.method;
        }
      }
    });

    const list = Array.from(map.values());

    // Urutkan kelas (TK, SD 1, SD 2, ...) lalu nama santri
    list.sort((a, b) => {
      if (a.kelas !== b.kelas) return a.kelas.localeCompare(b.kelas);
      return a.nama.localeCompare(b.nama);
    });

    if (!searchQuery) return list;

    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        String(s.nama || '').toLowerCase().includes(q) ||
        String(s.kelas || '').toLowerCase().includes(q) ||
        String(s.nisn || '').toLowerCase().includes(q)
    );
  }, [studentsList, attendances, selectedGrade, searchQuery, isSingleDay]);

  // Statistik Total Keseluruhan
  const overallStats = useMemo(() => {
    let totalHadir = 0;
    let totalSakit = 0;
    let totalIzin = 0;
    let totalAlpha = 0;
    let totalBelumAbsen = 0;

    if (isSingleDay) {
      studentSummary.forEach((s) => {
        if (s.statusHariIni === 'hadir') totalHadir++;
        else if (s.statusHariIni === 'sakit') totalSakit++;
        else if (s.statusHariIni === 'izin') totalIzin++;
        else if (s.statusHariIni === 'alpha') totalAlpha++;
        else totalBelumAbsen++;
      });
      const totalSiswa = studentSummary.length;
      const rate = totalSiswa > 0 ? Math.round((totalHadir / totalSiswa) * 100) : 0;
      return {
        totalRecords: totalSiswa,
        totalHadir,
        totalSakit,
        totalIzin,
        totalAlpha,
        totalBelumAbsen,
        rate,
        isSingleDay: true,
      };
    }

    attendances.forEach((r) => {
      if (r.status === 'hadir') totalHadir++;
      else if (r.status === 'sakit') totalSakit++;
      else if (r.status === 'izin') totalIzin++;
      else if (r.status === 'alpha') totalAlpha++;
    });

    const totalRecords = attendances.length;
    const rate = totalRecords > 0 ? Math.round((totalHadir / totalRecords) * 100) : 0;

    return {
      totalRecords,
      totalHadir,
      totalSakit,
      totalIzin,
      totalAlpha,
      totalBelumAbsen: 0,
      rate,
      isSingleDay: false,
    };
  }, [attendances, studentSummary, isSingleDay]);

  // Data Siswa yang ditampilkan setelah filter tab status aktif
  const displayedStudents = useMemo(() => {
    if (statusFilter === 'ALL') return studentSummary;
    if (statusFilter === 'hadir') {
      return studentSummary.filter((s) => isSingleDay ? s.statusHariIni === 'hadir' : s.hadir > 0);
    }
    if (statusFilter === 'belum_absen') {
      return studentSummary.filter((s) => isSingleDay ? !s.statusHariIni : s.total === 0);
    }
    if (statusFilter === 'sakit') {
      return studentSummary.filter((s) => isSingleDay ? s.statusHariIni === 'sakit' : s.sakit > 0);
    }
    if (statusFilter === 'izin') {
      return studentSummary.filter((s) => isSingleDay ? s.statusHariIni === 'izin' : s.izin > 0);
    }
    if (statusFilter === 'alpha') {
      return studentSummary.filter((s) => isSingleDay ? s.statusHariIni === 'alpha' : s.alpha > 0);
    }
    return studentSummary;
  }, [studentSummary, statusFilter, isSingleDay]);

  // ==================== UNDUH FORMAT PDF RESMI ====================
  const handleExportPdf = () => {
    if (studentSummary.length === 0) {
      showToast('Tidak ada data presensi santri untuk diekspor ke PDF.', 'warning', 'Peringatan');
      return;
    }
    try {
      exportStudentAttendancePdf({
        studentSummary,
        startDate,
        endDate,
        selectedGrade,
        stats: overallStats,
      });
      showToast('Dokumen PDF rekap presensi santri berhasil diunduh.', 'success', 'PDF Tersimpan');
    } catch (err) {
      console.error('Export PDF error:', err);
      showToast('Gagal membuat dokumen PDF: ' + err.message, 'error', 'Error');
    }
  };

  // ==================== UNDUH FORMAT EXCEL (.XLSX) ====================
  const handleExportExcel = () => {
    if (studentSummary.length === 0) {
      showToast('Tidak ada data rekap untuk diekspor ke Excel.', 'warning', 'Peringatan');
      return;
    }

    const rows = studentSummary.map((s, idx) => {
      const baseRow = {
        'No': idx + 1,
        'Nama Santri': s.nama,
        'NISN / NIS': s.nisn,
        'Kelas': s.kelas,
      };

      if (isSingleDay) {
        let statusText = 'Belum Scan';
        if (s.statusHariIni === 'hadir') statusText = `Hadir ${s.scanTime ? `(${s.scanTime.slice(0, 5)})` : ''}`;
        else if (s.statusHariIni === 'sakit') statusText = 'Sakit';
        else if (s.statusHariIni === 'izin') statusText = 'Izin';
        else if (s.statusHariIni === 'alpha') statusText = 'Alpha';
        baseRow['Status Kehadiran'] = statusText;
        baseRow['Waktu Scan'] = s.scanTime || '-';
        baseRow['Metode'] = s.method === 'qr_scan' ? 'QR Code' : s.method ? 'Manual Guru' : '-';
      }

      baseRow['Hadir (Hari)'] = s.hadir;
      baseRow['Sakit (Hari)'] = s.sakit;
      baseRow['Izin (Hari)'] = s.izin;
      baseRow['Alpha (Hari)'] = s.alpha;
      baseRow['Total Pertemuan'] = s.total;
      baseRow['Persentase Hadir (%)'] = s.total > 0 ? `${Math.round((s.hadir / s.total) * 100)}%` : '0%';

      return baseRow;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi');

    const cleanGrade = selectedGrade.replace(/\s+/g, '_');
    const filename = isSingleDay
      ? `Rekap_Presensi_Siswa_${cleanGrade}_${startDate}.xlsx`
      : `Rekap_Presensi_Siswa_${cleanGrade}_${startDate}_sd_${endDate}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast('File Excel rekap presensi santri berhasil diunduh.', 'success', 'Excel Tersimpan');
  };

  // Salin Ringkasan Rekap WhatsApp
  const handleCopyWhatsAppRecap = () => {
    if (studentSummary.length === 0) {
      showToast('Tidak ada data rekap untuk disalin.', 'warning', 'Peringatan');
      return;
    }

    let text = isSingleDay
      ? `*REKAPITULASI PRESENSI HARIAN SANTRI*\n`
      : `*REKAPITULASI PRESENSI SANTRI*\n`;
    text += `*Sekolah Islam Imam Syafi'i Percut*\n`;
    text += `══════════════════════════\n`;
    text += `🏫 *Jenjang/Kelas:* ${selectedGrade}\n`;
    text += `📅 *Tanggal:* ${isSingleDay ? formatDateIndo(startDate) : `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`}\n`;
    text += `══════════════════════════\n\n`;
    text += `📊 *Ringkasan Kehadiran:*\n`;
    text += `• Total Santri: ${studentSummary.length} siswa\n`;
    text += `• ✅ Hadir: ${overallStats.totalHadir}\n`;
    text += `• 🏥 Sakit: ${overallStats.totalSakit}\n`;
    text += `• ✉️ Izin: ${overallStats.totalIzin}\n`;
    text += `• ❌ Alpha: ${overallStats.totalAlpha}\n`;
    if (isSingleDay) {
      text += `• ⏳ Belum Absen: ${overallStats.totalBelumAbsen}\n`;
    }
    text += `• 📈 Tingkat Kehadiran: *${overallStats.rate}%*\n\n`;

    if (isSingleDay) {
      const belumAbsenList = studentSummary.filter((s) => !s.statusHariIni);
      if (belumAbsenList.length > 0) {
        text += `⏳ *Belum Absen (${belumAbsenList.length} Santri):*\n`;
        belumAbsenList.slice(0, 10).forEach((s, idx) => {
          text += `  ${idx + 1}. ${s.nama} (${s.kelas})\n`;
        });
        if (belumAbsenList.length > 10) {
          text += `  ... dan ${belumAbsenList.length - 10} santri lainnya.\n`;
        }
        text += `\n`;
      }
    } else {
      const perfectAttendance = studentSummary.filter((s) => s.total > 0 && s.hadir === s.total);
      if (perfectAttendance.length > 0) {
        text += `🌟 *Kehadiran 100% (${perfectAttendance.length} Santri):*\n`;
        perfectAttendance.slice(0, 8).forEach((s, idx) => {
          text += `  ${idx + 1}. ${s.nama} (${s.kelas})\n`;
        });
        if (perfectAttendance.length > 8) {
          text += `  ... dan ${perfectAttendance.length - 8} santri lainnya.\n`;
        }
        text += `\n`;
      }
    }

    text += `_Data resmi Sistem Presensi Digital Sekolah Islam Imam Syafi'i._`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Ringkasan rekap presensi berhasil disalin!', 'success', 'Tersalin');
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Panel dengan Konsep Unduh Modern (PDF & Excel) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-black uppercase tracking-wider mb-2 border border-emerald-200">
            <ShieldCheck size={13} className="text-emerald-700" />
            Laporan Presensi Siswa Digital
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Rekapitulasi Presensi Siswa
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-bold mt-0.5">
            Laporan presensi lengkap seluruh jenjang (TK s/d SD), filter harian instan, dan ekspor dokumen PDF & Excel.
          </p>
        </div>

        {/* Grup Tombol Unduh & Aksi Header */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Tombol Salin Ringkasan WA */}
          <button
            type="button"
            onClick={handleCopyWhatsAppRecap}
            disabled={studentSummary.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl border-2 border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-xs disabled:opacity-40"
            title="Salin ringkasan rekap ke format WhatsApp"
          >
            <Copy size={15} className="text-slate-500" />
            <span className="hidden lg:inline">Salin</span> Ringkasan WA
          </button>

          {/* Konsep Unduh: PDF (Resmi Berkop Sekolah) */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={studentSummary.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-rose-200 disabled:opacity-40"
            title="Unduh laporan presensi format PDF resmi berkop surat sekolah"
          >
            <FileText size={16} />
            <span>Unduh PDF</span>
          </button>

          {/* Konsep Unduh: Excel (.xlsx Spreadsheet) */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={studentSummary.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-emerald-200 disabled:opacity-40"
            title="Unduh laporan presensi format Spreadsheet Excel (.xlsx)"
          >
            <FileSpreadsheet size={16} />
            <span>Unduh Excel</span>
          </button>
        </div>
      </div>

      {/* Filter Kontrol & Preset Cepat */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        {/* Preset Cepat Tanggal */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Filter Cepat:
            </span>
            <button
              type="button"
              onClick={handleSetToday}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs transition-all active:scale-95 shadow-xs ${
                isToday
                  ? 'bg-emerald-700 text-white shadow-emerald-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Zap size={14} className={isToday ? 'text-amber-300' : 'text-slate-500'} />
              Hari Ini
            </button>

            <button
              type="button"
              onClick={handleSetYesterday}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs transition-all active:scale-95 shadow-xs ${
                isYesterday
                  ? 'bg-emerald-700 text-white shadow-emerald-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Clock size={13} className={isYesterday ? 'text-white' : 'text-slate-500'} />
              Kemarin
            </button>

            <button
              type="button"
              onClick={handleSetThisMonth}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-xs transition-all active:scale-95 shadow-xs ${
                isCurrentMonth
                  ? 'bg-emerald-700 text-white shadow-emerald-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <CalendarDays size={14} className={isCurrentMonth ? 'text-white' : 'text-slate-500'} />
              Bulan Ini
            </button>
          </div>

          <div className="text-[11px] font-black text-slate-500">
            {isSingleDay ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Mode Harian: {formatDateIndo(startDate)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                <Calendar size={12} className="text-slate-500" />
                Mode Rentang: {formatDateIndo(startDate)} s/d {formatDateIndo(endDate)}
              </span>
            )}
          </div>
        </div>

        {/* Form Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {/* Filter Jenjang / Kelas */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Pilih Jenjang / Kelas
            </label>
            <div className="relative">
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full appearance-none bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-2.5 pr-8 font-black text-xs text-slate-800 outline-none focus:border-secondary transition-all"
              >
                {availableGrades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Tanggal Mulai */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Tanggal Mulai
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-3.5 py-2 font-bold text-xs text-slate-800 outline-none focus:border-secondary transition-all"
              />
            </div>
          </div>

          {/* Tanggal Sampai */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Tanggal Sampai
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-3.5 py-2 font-bold text-xs text-slate-800 outline-none focus:border-secondary transition-all"
              />
            </div>
          </div>

          {/* Kolom Pencarian Santri & Tombol Refresh */}
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Cari nama atau NISN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl pl-8 pr-8 py-2 text-xs font-bold text-slate-800 outline-none focus:border-secondary"
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={loadRecap}
              disabled={loading}
              className="p-2.5 rounded-2xl bg-slate-900 text-white hover:bg-black transition-all shrink-0 active:scale-95 shadow-sm"
              title="Muat ulang data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Kartu Statistik Interaktif (Dapat diklik untuk memfilter santri) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Tingkat Hadir */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
            statusFilter === 'ALL'
              ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
              : 'border-slate-100 shadow-sm hover:border-slate-200'
          }`}
          title="Klik untuk tampilkan semua santri"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tingkat Hadir</p>
            <p className="text-2xl font-black text-emerald-700">{overallStats.rate}%</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
            <Award size={18} />
          </div>
        </div>

        {/* Total Hadir */}
        <div
          onClick={() => setStatusFilter('hadir')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
            statusFilter === 'hadir'
              ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/30'
              : 'border-slate-100 shadow-sm hover:border-slate-200'
          }`}
          title="Klik untuk filter santri yang Hadir"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Hadir</p>
            <p className="text-2xl font-black text-slate-900">{overallStats.totalHadir}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
            <UserCheck size={18} />
          </div>
        </div>

        {/* Total Sakit */}
        <div
          onClick={() => setStatusFilter('sakit')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
            statusFilter === 'sakit'
              ? 'border-amber-600 ring-2 ring-amber-500/20 shadow-md bg-amber-50/30'
              : 'border-slate-100 shadow-sm hover:border-slate-200'
          }`}
          title="Klik untuk filter santri Sakit"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Sakit</p>
            <p className="text-2xl font-black text-amber-600">{overallStats.totalSakit}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
            <HeartPulse size={18} />
          </div>
        </div>

        {/* Total Izin */}
        <div
          onClick={() => setStatusFilter('izin')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
            statusFilter === 'izin'
              ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md bg-blue-50/30'
              : 'border-slate-100 shadow-sm hover:border-slate-200'
          }`}
          title="Klik untuk filter santri Izin"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Izin</p>
            <p className="text-2xl font-black text-blue-600">{overallStats.totalIzin}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
            <Clock size={18} />
          </div>
        </div>

        {/* Total Alpha */}
        <div
          onClick={() => setStatusFilter('alpha')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
            statusFilter === 'alpha'
              ? 'border-rose-600 ring-2 ring-rose-500/20 shadow-md bg-rose-50/30'
              : 'border-slate-100 shadow-sm hover:border-slate-200'
          }`}
          title="Klik untuk filter santri Alpha"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Alpha</p>
            <p className="text-2xl font-black text-rose-600">{overallStats.totalAlpha}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black">
            <UserX size={18} />
          </div>
        </div>

        {/* Belum Absen / Total Siswa */}
        <div
          onClick={() => setStatusFilter(isSingleDay ? 'belum_absen' : 'ALL')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between col-span-2 sm:col-span-1 ${
            statusFilter === 'belum_absen'
              ? 'border-amber-600 ring-2 ring-amber-500/20 shadow-md bg-amber-50/30'
              : 'border-slate-100 shadow-sm hover:border-slate-200'
          }`}
          title={isSingleDay ? 'Klik untuk filter santri yang Belum Scan' : 'Total Santri'}
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {isSingleDay ? 'Belum Scan' : 'Total Data'}
            </p>
            <p className={`text-2xl font-black ${isSingleDay && overallStats.totalBelumAbsen > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {isSingleDay ? overallStats.totalBelumAbsen : overallStats.totalRecords}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
            isSingleDay && overallStats.totalBelumAbsen > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
          }`}>
            {isSingleDay ? <AlertCircle size={18} /> : <Users size={18} />}
          </div>
        </div>
      </div>

      {/* Tabel Rincian Kehadiran Seluruh Siswa */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header Tabel dengan Tab Filter Status Interaktif */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              Daftar Kehadiran Santri
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700">
                {displayedStudents.length} dari {studentSummary.length} Siswa
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              Menampilkan {selectedGrade !== 'Semua Kelas' ? `Kelas ${selectedGrade}` : 'Semua Kelas (TK, SD 1, SD 2, SD 3)'}.
            </p>
          </div>

          {/* Tab Filter Status Cepat */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({studentSummary.length})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('hadir')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                statusFilter === 'hadir'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Hadir ({overallStats.totalHadir})
            </button>

            {isSingleDay && (
              <button
                type="button"
                onClick={() => setStatusFilter('belum_absen')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  statusFilter === 'belum_absen'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Belum Scan ({overallStats.totalBelumAbsen})
              </button>
            )}

            <button
              type="button"
              onClick={() => setStatusFilter('sakit')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                statusFilter === 'sakit'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Sakit ({overallStats.totalSakit})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('izin')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                statusFilter === 'izin'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              Izin ({overallStats.totalIzin})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('alpha')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                statusFilter === 'alpha'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Alpha ({overallStats.totalAlpha})
            </button>
          </div>
        </div>

        {/* Tabel Data Presensi */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Santri</th>
                <th className="py-3 px-4 text-center">Kelas</th>
                {isSingleDay && (
                  <th className="py-3 px-4 text-center">Status Hari Ini</th>
                )}
                <th className="py-3 px-4 text-center text-emerald-700">Hadir</th>
                <th className="py-3 px-4 text-center text-amber-600">Sakit</th>
                <th className="py-3 px-4 text-center text-blue-600">Izin</th>
                <th className="py-3 px-4 text-center text-rose-600">Alpha</th>
                <th className="py-3 px-4 text-center">Total Hari</th>
                <th className="py-3 px-4 text-right">% Kehadiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={isSingleDay ? 10 : 9} className="py-14 text-center text-slate-400 font-bold">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                        <Users size={22} />
                      </div>
                      <p className="text-slate-700 font-black text-sm">Tidak Ada Data Santri</p>
                      <p className="text-xs text-slate-400">
                        Tidak ada santri yang cocok dengan filter kelas, pencarian, atau status &quot;{statusFilter}&quot;.
                      </p>
                      {statusFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter('ALL')}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider"
                        >
                          Tampilkan Semua Santri
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedStudents.map((s, idx) => {
                  const rate = s.total > 0 ? Math.round((s.hadir / s.total) * 100) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900">{s.nama}</div>
                        {s.nisn && s.nisn !== '-' && (
                          <div className="text-[10px] font-bold text-slate-400">NISN/NIS: {s.nisn}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {s.kelas}
                        </span>
                      </td>

                      {/* Status Spesifik jika filter Hari Ini / 1 Tanggal */}
                      {isSingleDay && (
                        <td className="py-3 px-4 text-center">
                          {s.statusHariIni === 'hadir' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                              <CheckCircle2 size={12} className="text-emerald-700" />
                              Hadir {s.scanTime ? `(${s.scanTime.slice(0, 5)})` : ''}
                            </span>
                          ) : s.statusHariIni === 'sakit' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                              🏥 Sakit
                            </span>
                          ) : s.statusHariIni === 'izin' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                              ✉️ Izin
                            </span>
                          ) : s.statusHariIni === 'alpha' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800">
                              ❌ Alpha
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                              ⏳ Belum Scan
                            </span>
                          )}
                        </td>
                      )}

                      <td className="py-3 px-4 text-center font-black text-emerald-700">{s.hadir}</td>
                      <td className="py-3 px-4 text-center font-black text-amber-600">{s.sakit}</td>
                      <td className="py-3 px-4 text-center font-black text-blue-600">{s.izin}</td>
                      <td className="py-3 px-4 text-center font-black text-rose-600">{s.alpha}</td>
                      <td className="py-3 px-4 text-center text-slate-500 font-black">{s.total}</td>
                      <td className="py-3 px-4 text-right font-black">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] ${
                          s.total === 0 ? 'bg-slate-100 text-slate-400' :
                          rate >= 85 ? 'bg-emerald-100 text-emerald-800' :
                          rate >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {s.total > 0 ? `${rate}%` : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Notification */}
      <ToastNotification
        toast={toast}
        onClose={() => setToast({ show: false, message: '', type: 'success', title: '' })}
      />
    </div>
  );
}
