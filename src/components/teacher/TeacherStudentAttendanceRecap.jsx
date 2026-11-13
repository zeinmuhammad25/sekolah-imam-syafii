import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar, Users, Filter, Download, RefreshCw, Search,
  Award, HeartPulse, UserCheck, UserX, Clock, ChevronDown,
  FileSpreadsheet, ArrowUpDown, ShieldCheck, CheckCircle2,
  Copy, MessageSquare
} from 'lucide-react';
import { getStudentAttendanceRecap } from '../../services/gsheet';
import { ToastNotification } from './ModalKit';

const GRADES = ['Semua Kelas', 'TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];

// Format tanggal YYYY-MM-DD
function getTodayDate() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000));
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

export default function TeacherStudentAttendanceRecap() {
  const [selectedGrade, setSelectedGrade] = useState('Semua Kelas');
  const [startDate, setStartDate] = useState(getStartOfMonthDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', title: '' });

  const showToast = (message, type = 'success', title = '') => {
    setToast({ show: true, message, type, title });
  };

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

  // Agregasi Data per Siswa
  const studentSummary = useMemo(() => {
    const map = new Map();

    attendances.forEach((record) => {
      const sId = record.student_id;
      if (!map.has(sId)) {
        map.set(sId, {
          id: sId,
          nama: record.student_name || 'Siswa',
          kelas: record.kelas || '-',
          hadir: 0,
          sakit: 0,
          izin: 0,
          alpha: 0,
          total: 0,
        });
      }

      const st = map.get(sId);
      st.total += 1;
      if (record.status === 'hadir') st.hadir += 1;
      else if (record.status === 'sakit') st.sakit += 1;
      else if (record.status === 'izin') st.izin += 1;
      else if (record.status === 'alpha') st.alpha += 1;
    });

    const list = Array.from(map.values());
    if (!searchQuery) return list;

    const q = searchQuery.toLowerCase();
    return list.filter((s) => String(s.nama || '').toLowerCase().includes(q) || String(s.kelas || '').toLowerCase().includes(q));
  }, [attendances, searchQuery]);

  // Statistik Total Keseluruhan
  const overallStats = useMemo(() => {
    let totalHadir = 0;
    let totalSakit = 0;
    let totalIzin = 0;
    let totalAlpha = 0;

    attendances.forEach((r) => {
      if (r.status === 'hadir') totalHadir++;
      else if (r.status === 'sakit') totalSakit++;
      else if (r.status === 'izin') totalIzin++;
      else if (r.status === 'alpha') totalAlpha++;
    });

    const totalRecords = attendances.length;
    const rate = totalRecords > 0 ? Math.round((totalHadir / totalRecords) * 100) : 0;

    return { totalRecords, totalHadir, totalSakit, totalIzin, totalAlpha, rate };
  }, [attendances]);

  // Export ke Excel (.xlsx)
  const handleExportExcel = () => {
    if (studentSummary.length === 0) {
      showToast('Tidak ada data rekap untuk diekspor.', 'warning', 'Peringatan');
      return;
    }

    const rows = studentSummary.map((s, idx) => ({
      'No': idx + 1,
      'Nama Siswa': s.nama,
      'Kelas': s.kelas,
      'Hadir (Hari)': s.hadir,
      'Sakit (Hari)': s.sakit,
      'Izin (Hari)': s.izin,
      'Alpha (Hari)': s.alpha,
      'Total Pertemuan': s.total,
      'Persentase Hadir (%)': s.total > 0 ? `${Math.round((s.hadir / s.total) * 100)}%` : '0%',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi');

    const cleanGrade = selectedGrade.replace(/\s+/g, '_');
    XLSX.writeFile(wb, `Rekap_Presensi_Siswa_${cleanGrade}_${startDate}_sd_${endDate}.xlsx`);
    showToast('File Excel rekap presensi berhasil diunduh.', 'success', 'Export Selesai');
  };

  // Salin Ringkasan Rekap WhatsApp
  const handleCopyWhatsAppRecap = () => {
    if (studentSummary.length === 0) {
      showToast('Tidak ada data rekap untuk disalin.', 'warning', 'Peringatan');
      return;
    }

    let text = `*REKAPITULASI PRESENSI SISWA*\n`;
    text += `*Sekolah Islam Imam Syafi'i Percut*\n`;
    text += `══════════════════════════\n`;
    text += `🏫 *Kelas:* ${selectedGrade}\n`;
    text += `📅 *Periode:* ${startDate} s/d ${endDate}\n`;
    text += `══════════════════════════\n\n`;
    text += `📊 *Ringkasan Keseluruhan:*\n`;
    text += `• Total Catatan: ${overallStats.totalRecords} presensi\n`;
    text += `• ✅ Hadir: ${overallStats.totalHadir}\n`;
    text += `• 🏥 Sakit: ${overallStats.totalSakit}\n`;
    text += `• ✉️ Izin: ${overallStats.totalIzin}\n`;
    text += `• ❌ Alpha: ${overallStats.totalAlpha}\n`;
    text += `• 📈 Rata-rata Kehadiran: *${overallStats.rate}%*\n\n`;

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

    const alphaStudents = studentSummary.filter((s) => s.alpha > 0);
    if (alphaStudents.length > 0) {
      text += `⚠️ *Catatan Alpha Terbanyak:*\n`;
      alphaStudents.sort((a, b) => b.alpha - a.alpha).slice(0, 5).forEach((s, idx) => {
        text += `  ${idx + 1}. ${s.nama}: ${s.alpha} hari Alpha\n`;
      });
      text += `\n`;
    }

    text += `_Data resmi Sistem Presensi Digital Sekolah Islam Imam Syafi'i._`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Ringkasan rekap WhatsApp berhasil disalin!', 'success', 'Tersalin');
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Panel */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Rekapitulasi Presensi Siswa
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-bold mt-0.5">
            Laporan kehadiran siswa per kelas dan rentang tanggal dengan ekspor Excel.
          </p>
        </div>

        {/* Tombol Aksi Header */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleCopyWhatsAppRecap}
            disabled={studentSummary.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl border-2 border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-xs disabled:opacity-40"
            title="Salin ringkasan rekap bulanan ke format WhatsApp"
          >
            <Copy size={15} /> Salin Ringkasan WA
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={studentSummary.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-700 text-white font-black text-xs uppercase tracking-wider hover:bg-emerald-800 active:scale-95 transition-all shadow-md disabled:opacity-40"
          >
            <FileSpreadsheet size={16} /> Unduh Laporan Excel
          </button>
        </div>
      </div>

      {/* Filter Kontrol */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        {/* Filter Kelas */}
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
              {GRADES.map((g) => (
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
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-3.5 py-2 font-bold text-xs text-slate-800 outline-none focus:border-secondary transition-all"
          />
        </div>

        {/* Tanggal Sampai */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Tanggal Sampai
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-3.5 py-2 font-bold text-xs text-slate-800 outline-none focus:border-secondary transition-all"
          />
        </div>

        {/* Tombol Terapkan & Cari */}
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Cari nama siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl pl-8 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-secondary"
            />
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <button
            type="button"
            onClick={loadRecap}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-slate-900 text-white hover:bg-black transition-all shrink-0"
            title="Muat ulang data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Statistik Ringkasan */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tingkat Kehadiran</p>
            <p className="text-2xl font-black text-emerald-700">{overallStats.rate}%</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
            <Award size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Hadir</p>
            <p className="text-2xl font-black text-slate-900">{overallStats.totalHadir}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
            <UserCheck size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Sakit</p>
            <p className="text-2xl font-black text-amber-600">{overallStats.totalSakit}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
            <HeartPulse size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Izin</p>
            <p className="text-2xl font-black text-blue-600">{overallStats.totalIzin}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
            <Clock size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Alpha</p>
            <p className="text-2xl font-black text-rose-600">{overallStats.totalAlpha}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black">
            <UserX size={18} />
          </div>
        </div>
      </div>

      {/* Tabel Rincian Kehadiran Per Siswa */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-base text-slate-900">
            Daftar Kehadiran Siswa ({studentSummary.length} Siswa)
          </h3>
          <span className="text-xs font-bold text-slate-400">
            Periode: {startDate} s/d {endDate}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4 text-center text-emerald-700">Hadir</th>
                <th className="py-3 px-4 text-center text-amber-600">Sakit</th>
                <th className="py-3 px-4 text-center text-blue-600">Izin</th>
                <th className="py-3 px-4 text-center text-rose-600">Alpha</th>
                <th className="py-3 px-4 text-center">Total Hari</th>
                <th className="py-3 px-4 text-right">% Kehadiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
              {studentSummary.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                    Tidak ada catatan presensi pada rentang tanggal atau kelas ini.
                  </td>
                </tr>
              ) : (
                studentSummary.map((s, idx) => {
                  const rate = s.total > 0 ? Math.round((s.hadir / s.total) * 100) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-black text-slate-900">{s.nama}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                          {s.kelas}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-black text-emerald-700">{s.hadir}</td>
                      <td className="py-3 px-4 text-center font-black text-amber-600">{s.sakit}</td>
                      <td className="py-3 px-4 text-center font-black text-blue-600">{s.izin}</td>
                      <td className="py-3 px-4 text-center font-black text-rose-600">{s.alpha}</td>
                      <td className="py-3 px-4 text-center text-slate-500">{s.total}</td>
                      <td className="py-3 px-4 text-right font-black">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] ${
                          rate >= 85 ? 'bg-emerald-100 text-emerald-800' :
                          rate >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {rate}%
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
