import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Download,
  Calendar,
  Users,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  RotateCcw,
  UserCheck,
  ChevronDown,
  Award,
  Edit2,
  Trash2,
  Sparkles,
  Plus,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Info,
  CalendarDays,
} from 'lucide-react';
import {
  getAttendanceRecap,
  getAttendanceTeachers,
  adminAddAttendanceRecord,
  adminUpdateAttendanceRecord,
  adminResetAttendanceRecord,
  adminDeleteAttendanceRecords,
} from '../../services/gsheet';
import { exportAttendancePdf } from '../../services/attendancePdf';
import { Modal, ModalFooter, ConfirmDialog, ToastNotification } from './ModalKit';

const INDO_DAY_NAMES = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getTodayWib() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 7 * 3600000);
  const y = wib.getFullYear();
  const m = String(wib.getMonth() + 1).padStart(2, '0');
  const day = String(wib.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseWorkDays(val) {
  if (!val) return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  if (Array.isArray(val)) return val;
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  } catch (e) {
    return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  }
}

function getDatesInRange(startStr, endStr) {
  const dates = [];
  if (!startStr || !endStr) return dates;
  let current = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  if (isNaN(current.getTime()) || isNaN(end.getTime())) return dates;

  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function parseTimeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function TeacherAttendanceRecap() {
  const todayStr = getTodayWib();
  const firstDayOfMonth = `${todayStr.slice(0, 7)}-01`;

  // Filter Tanggal & Guru & Status
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedTeacherId, setSelectedTeacherId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Kembalikan semua filter ke kondisi awal default
  const handleResetFilter = () => {
    setStartDate(firstDayOfMonth);
    setEndDate(todayStr);
    setSelectedTeacherId('ALL');
    setSelectedStatus('ALL');
    setSelectedIds(new Set());
  };

  const [teachers, setTeachers] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Popover Unduh Laporan (PDF vs Excel)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef(null);

  // Modal Tambah Presensi Manual
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    teacherId: '',
    date: todayStr,
    status: 'hadir',
    check_in_time: '07:15',
    check_in_status: 'tepat_waktu',
    late_minutes: 0,
    check_out_time: '15:00',
    check_out_status: 'tepat_waktu',
    early_minutes: 0,
    notes: 'Diinput manual oleh Admin (guru lupa absen)',
  });

  // Modal Edit Koreksi State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    check_in_time: '',
    check_in_status: 'tepat_waktu',
    late_minutes: 0,
    check_out_time: '',
    check_out_status: 'tepat_waktu',
    early_minutes: 0,
    status: 'hadir',
    notes: '',
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk Selection & Delete State
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', title: '' });
  const showToast = (message, type = 'success', title = '') => {
    setToast({ show: true, message, type, title });
  };

  // Close download menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Muat Daftar Guru
  useEffect(() => {
    getAttendanceTeachers().then((res) => {
      if (res.success && Array.isArray(res.teachers)) {
        setTeachers(res.teachers);
        if (res.teachers.length > 0) {
          setAddForm((prev) => ({ ...prev, teacherId: res.teachers[0].id }));
        }
      }
    });
  }, []);

  // Muat Data Rekap Berdasarkan Rentang Tanggal
  const loadRecap = async () => {
    setLoading(true);
    const res = await getAttendanceRecap({
      startDate,
      endDate,
      teacherId: selectedTeacherId === 'ALL' ? undefined : selectedTeacherId,
    });
    if (res.success) {
      setAttendances(res.attendances || []);
    } else {
      showToast(res.error || 'Gagal memuat rekap presensi.', 'error', 'Error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRecap();
    setSelectedIds(new Set());
  }, [startDate, endDate, selectedTeacherId]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedStatus]);

  // Deteksi Guru yang Tidak / Lupa Melakukan Presensi Pulang
  // Syarat: Status hadir + ada jam masuk + jam pulang kosong + (tanggal < hari ini ATAU hari ini setelah jam kerja berakhir)
  const isNoCheckOut = (item) => {
    if (!item) return false;
    if (item.status !== 'hadir') return false;
    if (!item.check_in_time) return false;
    if (item.check_out_time) return false;

    // Tanggal kemarin atau hari-hari sebelumnya yang sudah lewat
    if (item.date < todayStr) return true;

    // Tanggal hari ini: dicek apakah sudah melewati jadwal jam kerja pulang guru
    if (item.date === todayStr) {
      const teacher = teachers.find((t) => t.id === item.teacher_id);
      const workEndTime = teacher?.work_end_time || '15:00';
      const endMinutes = parseTimeToMinutes(workEndTime);
      const nowWib = new Date();
      const currentMinutes = nowWib.getHours() * 60 + nowWib.getMinutes();
      return currentMinutes >= endMinutes;
    }

    return false;
  };

  // Deteksi Alpha & Belum Absen Otomatis
  // Hanya berlaku untuk guru dengan is_active = 1 dan hari yang ada di work_days guru tersebut.
  const displayAttendances = useMemo(() => {
    // 1. Filter guru aktif yang relevan
    const activeTeachers = teachers.filter((t) => {
      if (t.is_active != null && Number(t.is_active) === 0) return false;
      if (selectedTeacherId !== 'ALL' && t.id !== selectedTeacherId) return false;
      return true;
    });

    // 2. Index record yang sudah ada di DB: key = `${teacher_id}_${date}`
    // Termasuk yang berstatus 'dikecualikan' agar sistem tidak meng-generate Alpha untuk data yang sudah dihapus oleh Admin
    const existingMap = new Set();
    attendances.forEach((a) => {
      const itemDate = (a.date || '').slice(0, 10).trim();
      if (itemDate) {
        existingMap.add(`${a.teacher_id}_${itemDate}`);
      }
    });

    // Filter data DB: kecualikan yang berstatus 'dikecualikan' dan pastikan SESUAI rentang tanggal startDate s/d endDate
    const visibleRealAttendances = attendances.filter((a) => {
      if (a.status === 'dikecualikan') return false;
      const itemDate = (a.date || '').slice(0, 10).trim();
      if (!itemDate) return false;
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
      if (selectedTeacherId !== 'ALL' && a.teacher_id !== selectedTeacherId) return false;
      return true;
    });

    if (activeTeachers.length === 0) {
      return visibleRealAttendances;
    }

    // 3. Waktu sekarang (WIB)
    const nowWib = new Date();
    const currentMinutes = nowWib.getHours() * 60 + nowWib.getMinutes();

    // 4. Rentang tanggal filter
    const dates = getDatesInRange(startDate, endDate);
    const virtualRecords = [];

    dates.forEach((date) => {
      // Tidak mendeteksi tanggal di masa depan
      if (date > todayStr) return;

      const d = new Date(date + 'T00:00:00');
      const dayName = INDO_DAY_NAMES[d.getDay()];

      activeTeachers.forEach((teacher) => {
        // Cek apakah hari ini adalah hari kerja wajib guru
        const workDays = parseWorkDays(teacher.work_days);
        if (!workDays.includes(dayName)) return; // Libur untuk guru ini

        // Cek apakah guru sudah punya catatan presensi di database (atau sudah dikecualikan/dihapus)
        const key = `${teacher.id}_${date}`;
        if (existingMap.has(key)) return; // Sudah ada catatan presensi / sudah dihapus

        // Belum ada catatan presensi
        const isToday = date === todayStr;
        const teacherEndMinutes = parseTimeToMinutes(teacher.work_end_time || '15:00');

        let status = 'alpha';
        let notes = 'Tidak melakukan presensi (Alpha)';

        if (isToday) {
          if (currentMinutes < teacherEndMinutes) {
            status = 'belum_absen';
            notes = `Belum absen hari ini (Jadwal pulang ${teacher.work_end_time || '15:00'} WIB)`;
          } else {
            status = 'alpha';
            notes = `Tidak hadir hingga jam pulang berakhir (Alpha)`;
          }
        }

        virtualRecords.push({
          id: `virtual-${date}-${teacher.id}`,
          teacher_id: teacher.id,
          teacher_name: teacher.name,
          date,
          status,
          check_in_time: null,
          check_in_status: null,
          late_minutes: 0,
          check_out_time: null,
          check_out_status: null,
          early_minutes: 0,
          notes,
          isVirtual: true,
        });
      });
    });

    // 5. Gabungkan data real yang terlihat dan data virtual
    let combined = [...visibleRealAttendances, ...virtualRecords];

    // Filter berdasarkan status kehadiran jika dipilih
    if (selectedStatus && selectedStatus !== 'ALL') {
      combined = combined.filter((item) => {
        if (selectedStatus === 'hadir') return item.status === 'hadir';
        if (selectedStatus === 'tepat_waktu') return item.status === 'hadir' && item.check_in_status === 'tepat_waktu';
        if (selectedStatus === 'terlambat') return item.status === 'hadir' && item.check_in_status === 'terlambat';
        if (selectedStatus === 'tidak_tap_pulang') return isNoCheckOut(item);
        if (selectedStatus === 'izin') return item.status === 'izin';
        if (selectedStatus === 'sakit') return item.status === 'sakit';
        if (selectedStatus === 'dinas') return item.status === 'dinas';
        if (selectedStatus === 'alpha') return item.status === 'alpha';
        if (selectedStatus === 'belum_absen') return item.status === 'belum_absen';
        return item.status === selectedStatus;
      });
    }

    combined.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.check_in_time && b.check_in_time) return b.check_in_time.localeCompare(a.check_in_time);
      return (a.teacher_name || '').localeCompare(b.teacher_name || '');
    });

    return combined;
  }, [attendances, teachers, startDate, endDate, selectedTeacherId, selectedStatus, todayStr]);

  // Statistik Ringkasan Dihitung dari displayAttendances
  const stats = useMemo(() => {
    let tepatWaktu = 0;
    let terlambat = 0;
    let totalLateMinutes = 0;
    let pulangCepat = 0;
    let tidakTapPulang = 0;
    let izin = 0;
    let sakit = 0;
    let dinas = 0;
    let alpha = 0;
    let belumAbsen = 0;

    displayAttendances.forEach((a) => {
      if (a.status === 'hadir') {
        if (a.check_in_status === 'tepat_waktu') tepatWaktu++;
        else if (a.check_in_status === 'terlambat') {
          terlambat++;
          totalLateMinutes += (a.late_minutes || 0);
        }
        if (a.check_out_status === 'pulang_cepat' || (a.early_minutes && Number(a.early_minutes) > 0)) {
          pulangCepat++;
        }
        if (isNoCheckOut(a)) {
          tidakTapPulang++;
        }
      } else if (a.status === 'izin') izin++;
      else if (a.status === 'sakit') sakit++;
      else if (a.status === 'dinas') dinas++;
      else if (a.status === 'alpha') alpha++;
      else if (a.status === 'belum_absen') belumAbsen++;
    });

    return {
      total: displayAttendances.length,
      hadirTotal: tepatWaktu + terlambat,
      tepatWaktu,
      terlambat,
      totalLateMinutes,
      pulangCepat,
      tidakTapPulang,
      izinSakitDinas: izin + sakit + dinas,
      alpha,
      belumAbsen,
    };
  }, [displayAttendances]);

  // Nama Guru Terpilih untuk Info Filter
  const selectedTeacherName = useMemo(() => {
    if (selectedTeacherId === 'ALL') return 'Semua Guru';
    const found = teachers.find((t) => t.id === selectedTeacherId);
    return found ? found.name : 'Semua Guru';
  }, [selectedTeacherId, teachers]);

  // Buka Modal Tambah Presensi Manual
  const handleOpenAddModal = () => {
    setAddForm({
      teacherId: teachers[0]?.id || '',
      date: todayStr,
      status: 'hadir',
      check_in_time: '07:15',
      check_in_status: 'tepat_waktu',
      late_minutes: 0,
      check_out_time: '15:00',
      check_out_status: 'tepat_waktu',
      early_minutes: 0,
      notes: 'Diinput manual oleh Admin (guru lupa absen)',
    });
    setAddModalOpen(true);
  };

  // Simpan Tambah Presensi Manual
  const handleSaveAdd = async (e) => {
    e.preventDefault();
    const targetTeacher = teachers.find((t) => t.id === addForm.teacherId);
    if (!targetTeacher) {
      showToast('Pilih guru terlebih dahulu.', 'error', 'Validasi');
      return;
    }

    setSavingAdd(true);
    const res = await adminAddAttendanceRecord({
      ...addForm,
      teacherName: targetTeacher.name,
    });
    setSavingAdd(false);

    if (res.success) {
      showToast(
        `Presensi ${targetTeacher.name} tanggal ${addForm.date} berhasil ditambahkan.`,
        'success',
        'Presensi Ditambahkan'
      );
      setAddModalOpen(false);
      loadRecap();
    } else {
      showToast(res.error || 'Gagal menambahkan presensi.', 'error', 'Error');
    }
  };

  // Buka Modal Edit Koreksi (Mendukung Koreksi dari Virtual Record Alpha/Belum Absen)
  const handleOpenEdit = (item) => {
    if (item.isVirtual) {
      setAddForm({
        teacherId: item.teacher_id,
        date: item.date,
        status: 'hadir',
        check_in_time: '07:15',
        check_in_status: 'tepat_waktu',
        late_minutes: 0,
        check_out_time: '15:00',
        check_out_status: 'tepat_waktu',
        early_minutes: 0,
        notes: `Koreksi presensi ${item.status === 'alpha' ? 'Alpha' : 'Belum Absen'} oleh Admin`,
      });
      setAddModalOpen(true);
      return;
    }

    setEditingItem(item);
    setEditForm({
      check_in_time: item.check_in_time ? item.check_in_time.slice(0, 5) : '',
      check_in_status: item.check_in_status || 'tepat_waktu',
      late_minutes: item.late_minutes || 0,
      check_out_time: item.check_out_time ? item.check_out_time.slice(0, 5) : '',
      check_out_status: item.check_out_status || 'tepat_waktu',
      early_minutes: item.early_minutes || 0,
      status: item.status || 'hadir',
      notes: item.notes || '',
    });
    setEditModalOpen(true);
  };

  // Simpan Edit Koreksi
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    setSavingEdit(true);
    const res = await adminUpdateAttendanceRecord({
      id: editingItem.id,
      check_in_time: editForm.check_in_time ? `${editForm.check_in_time}:00` : null,
      check_in_status: editForm.check_in_status,
      late_minutes: editForm.check_in_status === 'terlambat' ? Number(editForm.late_minutes) : 0,
      check_out_time: editForm.check_out_time ? `${editForm.check_out_time}:00` : null,
      check_out_status: editForm.check_out_status,
      early_minutes: editForm.check_out_status === 'pulang_cepat' ? Number(editForm.early_minutes) : 0,
      status: editForm.status,
      notes: editForm.notes,
    });
    setSavingEdit(false);

    if (res.success) {
      showToast(`Data presensi ${editingItem.teacher_name} berhasil dikoreksi.`, 'success', 'Berhasil Dikoreksi');
      setEditModalOpen(false);
      loadRecap();
    } else {
      showToast(res.error || 'Gagal menyimpan perubahan presensi.', 'error', 'Error');
    }
  };

  // Logika Checkbox Seleksi Baris
  const isAllSelected = useMemo(() => {
    if (displayAttendances.length === 0) return false;
    return displayAttendances.every((item) => selectedIds.has(item.id));
  }, [displayAttendances, selectedIds]);

  const isSomeSelected = useMemo(() => {
    if (displayAttendances.length === 0) return false;
    return displayAttendances.some((item) => selectedIds.has(item.id)) && !isAllSelected;
  }, [displayAttendances, selectedIds, isAllSelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayAttendances.map((item) => item.id)));
    }
  };

  const handleToggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Konfirmasi Hapus Presensi Satuan (Semua baris bisa dihapus)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const targetName = deleteTarget.teacher_name || '';
      const targetDate = deleteTarget.date || '';
      const targetId = deleteTarget.id;
      const res = await adminResetAttendanceRecord(deleteTarget);

      if (res.success) {
        showToast(
          `Catatan presensi ${targetName} pada tanggal ${targetDate} berhasil dihapus.`,
          'success',
          'Data Dihapus'
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        setDeleteTarget(null);
        await loadRecap();
      } else {
        showToast(res.error || 'Gagal menghapus data presensi.', 'error', 'Error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan saat menghapus data: ' + err.message, 'error', 'Error');
    } finally {
      setDeleting(false);
    }
  };

  // Buka Modal Konfirmasi Hapus Massal
  const handleOpenBulkDelete = () => {
    const targets = displayAttendances.filter((item) => selectedIds.has(item.id));
    if (targets.length === 0) return;
    setBulkDeleteTarget(targets);
  };

  // Konfirmasi Hapus Massal (Bulk Delete)
  const handleConfirmBulkDelete = async () => {
    if (bulkDeleteTarget.length === 0) return;

    setBulkDeleting(true);
    try {
      const count = bulkDeleteTarget.length;
      const res = await adminDeleteAttendanceRecords(bulkDeleteTarget);

      if (res.success) {
        showToast(
          `${count} data presensi berhasil dihapus dari rekap.`,
          'success',
          'Hapus Massal Berhasil'
        );
        setSelectedIds(new Set());
        setBulkDeleteTarget([]);
        await loadRecap();
      } else {
        showToast(res.error || 'Gagal menghapus data presensi.', 'error', 'Error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan saat menghapus data massal: ' + err.message, 'error', 'Error');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Ekspor ke Dokumen PDF (Kop Resmi Sekolah)
  const handleExportPdf = () => {
    setDownloadMenuOpen(false);
    if (displayAttendances.length === 0) {
      showToast('Tidak ada data presensi untuk dicetak pada rentang tanggal ini.', 'warning', 'Peringatan');
      return;
    }

    try {
      const guruTitle = selectedStatus !== 'ALL'
        ? `${selectedTeacherName} (${selectedStatus.replace('_', ' ').toUpperCase()})`
        : selectedTeacherName;

      exportAttendancePdf({
        attendances: displayAttendances,
        startDate,
        endDate,
        teacherName: guruTitle,
        stats,
      });
      showToast('Dokumen PDF rekap presensi berhasil dibuat dan diunduh.', 'success', 'PDF Berhasil');
    } catch (err) {
      console.error('PDF error:', err);
      showToast('Gagal membuat dokumen PDF: ' + err.message, 'error', 'Error PDF');
    }
  };

  // Ekspor ke Spreadsheet Excel / CSV
  const handleExportCsv = () => {
    setDownloadMenuOpen(false);
    if (displayAttendances.length === 0) {
      showToast('Tidak ada data untuk diekspor pada periode ini.', 'warning', 'Peringatan');
      return;
    }

    const headers = ['No', 'Tanggal', 'Nama Guru', 'Status', 'Jam Masuk', 'Status Masuk', 'Telat (Menit)', 'Jam Pulang', 'Status Pulang', 'Pulang Cepat (Menit)', 'Catatan'];
    const rows = displayAttendances.map((a, idx) => {
      const isMissingOut = isNoCheckOut(a);
      const jamPulang = a.check_out_time
        ? a.check_out_time.slice(0, 5)
        : isMissingOut
        ? 'Tidak Tap'
        : '-';
      const statusPulang = a.check_out_time
        ? (a.check_out_status || '-')
        : isMissingOut
        ? 'TIDAK TAP PULANG'
        : '-';
      const noteText = isMissingOut
        ? (a.notes ? `[Tidak tap pulang] ${a.notes}` : 'Tidak melakukan presensi pulang (Lupa tap pulang)')
        : (a.notes || '-');

      return [
        idx + 1,
        a.date,
        `"${a.teacher_name || ''}"`,
        (a.status || 'hadir').toUpperCase(),
        a.check_in_time ? a.check_in_time.slice(0, 5) : '-',
        a.check_in_status || '-',
        a.late_minutes || 0,
        jamPulang,
        statusPulang,
        a.early_minutes || 0,
        `"${noteText.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rekap_Presensi_${startDate}_sd_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('File Excel / CSV rekap presensi berhasil diunduh.', 'success', 'Export Selesai');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast */}
      <AnimatePresence>
        {toast?.show && toast?.message && (
          <ToastNotification
            toast={toast}
            onClose={() => setToast({ show: false, message: '', type: 'success', title: '' })}
          />
        )}
      </AnimatePresence>

      {/* Header & Aksi Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-secondary to-forest text-white shadow-lg shadow-secondary/20">
            <Calendar size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Rekap Presensi Guru
            </h2>
            <p className="text-slate-500 font-semibold text-xs sm:text-sm mt-0.5">
              Laporan Kehadiran, Filter Fleksibel Per Hari, Ekspor PDF/Excel & Input Manual
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Tombol Input Presensi Manual (Solusi Guru Kelupaan) */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-secondary hover:bg-forest text-white font-black text-xs sm:text-sm shadow-md shadow-secondary/20 transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>Input Presensi Manual</span>
          </button>

          {/* Tombol Unduh Laporan Dropdown Popover */}
          <div className="relative flex-1 sm:flex-none" ref={downloadMenuRef}>
            <button
              type="button"
              onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
              disabled={attendances.length === 0 || loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-xs sm:text-sm hover:bg-black transition-all shadow-md disabled:opacity-50"
            >
              <Download size={15} />
              <span>Unduh Laporan</span>
              <ChevronDown size={14} className={downloadMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {/* Menu Popover Pilihan PDF & Excel */}
            <AnimatePresence>
              {downloadMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-50 text-xs font-bold text-slate-700"
                >
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-emerald-50 text-slate-800 hover:text-secondary transition-all text-left"
                  >
                    <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                      <Printer size={15} />
                    </div>
                    <div>
                      <p className="font-black text-xs text-slate-900">Dokumen PDF Resmi</p>
                      <p className="text-[10px] text-slate-400 font-semibold">Lengkap Kop Sekolah</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-emerald-50 text-slate-800 hover:text-secondary transition-all text-left"
                  >
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <FileSpreadsheet size={15} />
                    </div>
                    <div>
                      <p className="font-black text-xs text-slate-900">Spreadsheet Excel</p>
                      <p className="text-[10px] text-slate-400 font-semibold">Format CSV / XLS</p>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Filter Bar (Dari Tanggal, Sampai Tanggal, Filter Guru, Filter Status & Tombol Reset) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3">
        {/* Dari Tanggal */}
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
            Dari Tanggal:
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-2xl px-4 py-2.5 focus:outline-none focus:border-secondary transition-all"
          />
        </div>

        {/* Sampai Tanggal */}
        <div className="flex-1 min-w-[130px]">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
            Sampai Tanggal:
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-2xl px-4 py-2.5 focus:outline-none focus:border-secondary transition-all"
          />
        </div>

        {/* Filter Guru */}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
            Filter Guru:
          </label>
          <div className="relative">
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-2xl px-4 py-2.5 appearance-none focus:outline-none focus:border-secondary transition-all pr-8"
            >
              <option value="ALL">Semua Guru ({teachers.length})</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Filter Status */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">
            Filter Status:
          </label>
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-2xl px-4 py-2.5 appearance-none focus:outline-none focus:border-secondary transition-all pr-8"
            >
              <option value="ALL">Semua Status</option>
              <option value="hadir">Hadir (Semua)</option>
              <option value="tepat_waktu">Tepat Waktu</option>
              <option value="terlambat">Terlambat</option>
              <option value="tidak_tap_pulang">⚠️ Tidak Tap Pulang</option>
              <option value="izin">Izin</option>
              <option value="sakit">Sakit</option>
              <option value="dinas">Dinas Luar</option>
              <option value="alpha">Alpha</option>
              <option value="belum_absen">Belum Absen</option>
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Tombol Aksi: Reset Filter & Refresh */}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={handleResetFilter}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
            title="Kembalikan semua filter ke kondisi awal default"
          >
            <RotateCcw size={15} className="text-slate-500" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={loadRecap}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center transition-all shadow-sm"
            title="Muat Ulang Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-secondary' : ''} />
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Total Rekap</span>
            <Users size={16} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total}</div>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Hari kerja terdata</p>
        </div>

        <div className="bg-emerald-50/60 p-4 sm:p-5 rounded-3xl border border-emerald-100 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Tepat Waktu</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700">{stats.tepatWaktu}</div>
          <p className="text-[10px] font-bold text-emerald-600/80 mt-1">Sesuai jadwal</p>
        </div>

        <div className="bg-rose-50/60 p-4 sm:p-5 rounded-3xl border border-rose-100 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Terlambat</span>
            <Clock size={16} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-700">{stats.terlambat}</div>
          <p className="text-[10px] font-bold text-rose-600/80 mt-1">
            Total {stats.totalLateMinutes} menit
          </p>
        </div>

        <div className="bg-amber-50/70 p-4 sm:p-5 rounded-3xl border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Tidak Tap Pulang</span>
            <AlertCircle size={16} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-800">{stats.tidakTapPulang || 0}</div>
          <p className="text-[10px] font-bold text-amber-700/80 mt-1">Lupa presensi keluar</p>
        </div>

        <div className="bg-blue-50/60 p-4 sm:p-5 rounded-3xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Izin / Sakit</span>
            <FileText size={16} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-700">{stats.izinSakitDinas}</div>
          <p className="text-[10px] font-bold text-blue-600/80 mt-1">Dengan keterangan</p>
        </div>

        <div className="bg-rose-100/60 p-4 sm:p-5 rounded-3xl border border-rose-300 shadow-sm">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Alpha</span>
            <AlertTriangle size={16} />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-800">{stats.alpha}</div>
          <p className="text-[10px] font-bold text-rose-700/80 mt-1">
            {stats.belumAbsen > 0 ? `${stats.belumAbsen} belum absen hari ini` : 'Tanpa keterangan'}
          </p>
        </div>
      </div>

      {/* Toolbar Aksi Massal (Muncul jika ada baris terpilih) */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-secondary/30 text-emerald-400 flex items-center justify-center font-black text-xs border border-secondary/30">
                {selectedIds.size}
              </span>
              <div>
                <p className="text-xs sm:text-sm font-black text-white">
                  {selectedIds.size} Baris Data Terpilih
                </p>
                <p className="text-[11px] font-semibold text-slate-400">
                  Data yang dipilih dapat dihapus secara bersamaan dari rekap presensi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
              >
                Batal Pilihan
              </button>
              <button
                type="button"
                onClick={handleOpenBulkDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-600/30 transition-all transform active:scale-95"
              >
                <Trash2 size={14} />
                <span>Hapus Terpilih ({selectedIds.size})</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daftar Rekap Presensi */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
            <RefreshCw className="animate-spin text-secondary" size={26} />
            <span>Memuat data rekap presensi…</span>
          </div>
        ) : displayAttendances.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs font-bold space-y-1">
            <CalendarDays size={40} className="text-slate-300 mx-auto mb-2" />
            <p className="text-slate-700 text-sm font-black">Tidak Ada Data Presensi</p>
            <p>Tidak ditemukan data presensi guru pada rentang {startDate} s/d {endDate}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded-md border-slate-300 text-secondary focus:ring-secondary cursor-pointer accent-emerald-600"
                      title={isAllSelected ? 'Batalkan Pilih Semua' : 'Pilih Semua Baris'}
                    />
                  </th>
                  <th className="py-3.5 px-4">Tanggal</th>
                  <th className="py-3.5 px-4">Guru</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Masuk</th>
                  <th className="py-3.5 px-3">Ketepatan</th>
                  <th className="py-3.5 px-3">Pulang</th>
                  <th className="py-3.5 px-3">Ket. Pulang</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 text-center">Aksi Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {displayAttendances.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isAlpha = item.status === 'alpha';
                  const isBelumAbsen = item.status === 'belum_absen';
                  const isLeave = ['izin', 'sakit', 'dinas'].includes(item.status);
                  const isLate = item.check_in_status === 'terlambat';
                  const isEarly = item.check_out_status === 'pulang_cepat' || (item.early_minutes && Number(item.early_minutes) > 0);
                  const isMissingOut = isNoCheckOut(item);

                  let statusBadgeClass = 'bg-emerald-100 text-emerald-700';
                  let statusText = item.status;
                  if (isAlpha) {
                    statusBadgeClass = 'bg-rose-100 text-rose-700 border border-rose-200';
                    statusText = 'ALPHA';
                  } else if (isBelumAbsen) {
                    statusBadgeClass = 'bg-amber-100 text-amber-800 border border-amber-300';
                    statusText = 'BELUM ABSEN';
                  } else if (isLeave) {
                    statusBadgeClass = 'bg-blue-100 text-blue-700';
                    statusText = item.status.toUpperCase();
                  }

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/80 border-l-4 border-secondary'
                          : isAlpha
                          ? 'bg-rose-50/40 hover:bg-rose-50/70'
                          : isBelumAbsen
                          ? 'bg-amber-50/30 hover:bg-amber-50/60'
                          : isMissingOut
                          ? 'bg-amber-50/20 hover:bg-amber-50/50'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(item.id)}
                          className="w-4 h-4 rounded-md border-slate-300 text-secondary focus:ring-secondary cursor-pointer accent-emerald-600"
                        />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-900 font-black">
                        {item.date}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-900">
                        {item.teacher_name}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${statusBadgeClass}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap font-mono">
                        {item.check_in_time ? item.check_in_time.slice(0, 5) : '-'}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.check_in_status ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isLate ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isLate ? `Telat ${item.late_minutes}m` : 'Tepat Waktu'}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap font-mono">
                        {item.check_out_time ? (
                          item.check_out_time.slice(0, 5)
                        ) : isMissingOut ? (
                          <span className="text-amber-700 font-sans text-[11px] font-black">Tidak Tap</span>
                        ) : '-'}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.check_out_time ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isEarly ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isEarly ? `Cepat ${item.early_minutes || 0}m` : 'OK'}
                          </span>
                        ) : isMissingOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            ⚠️ Tidak Tap Pulang
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={item.notes || ''}>
                        {isMissingOut ? (
                          <span className="text-amber-800 font-semibold">
                            {item.notes ? `[Tidak tap pulang] ${item.notes}` : 'Tidak melakukan presensi pulang (Lupa tap pulang)'}
                          </span>
                        ) : (
                          item.notes || '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Edit Koreksi / Input Presensi */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className={`p-1.5 rounded-xl transition-all ${
                              item.isVirtual
                                ? 'bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-800 border border-amber-300'
                                : 'bg-slate-100 hover:bg-secondary hover:text-white text-slate-600'
                            }`}
                            title={item.isVirtual ? 'Input / Koreksi Kehadiran Guru' : 'Koreksi Data Presensi'}
                          >
                            <Edit2 size={13} />
                          </button>
                          {/* Tombol HAPUS Presensi (Icon Sampah) - SEMUA BARIS BISA DIHAPUS */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-600 transition-all"
                            title="Hapus Data Presensi"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL INPUT PRESENSI MANUAL (GURU LUPA ABSEN) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {addModalOpen && (
          <Modal
            onClose={() => !savingAdd && setAddModalOpen(false)}
            title="Input Presensi Manual"
          >
            <form onSubmit={handleSaveAdd} className="p-6 space-y-4">
              {/* Pilih Guru */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  Pilih Guru / Pegawai <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={addForm.teacherId}
                  onChange={(e) => setAddForm({ ...addForm, teacherId: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-secondary"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal Presensi */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  Tanggal Presensi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={addForm.date}
                  onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-none focus:border-secondary"
                />
              </div>

              {/* Status Kehadiran */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">Status Kehadiran</label>
                <div className="grid grid-cols-4 gap-2">
                  {['hadir', 'izin', 'sakit', 'dinas'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAddForm({ ...addForm, status: st })}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition-all ${
                        addForm.status === st
                          ? 'bg-secondary text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jam Masuk & Pulang (Hanya jika Hadir) */}
              {addForm.status === 'hadir' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1">Jam Masuk</label>
                      <input
                        type="time"
                        value={addForm.check_in_time}
                        onChange={(e) => setAddForm({ ...addForm, check_in_time: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1">Ketepatan Masuk</label>
                      <select
                        value={addForm.check_in_status}
                        onChange={(e) => setAddForm({ ...addForm, check_in_status: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                      >
                        <option value="tepat_waktu">Tepat Waktu</option>
                        <option value="terlambat">Terlambat</option>
                      </select>
                    </div>
                  </div>

                  {addForm.check_in_status === 'terlambat' && (
                    <div>
                      <label className="block text-xs font-black text-rose-700 mb-1">Jumlah Terlambat (Menit)</label>
                      <input
                        type="number"
                        min="1"
                        value={addForm.late_minutes}
                        onChange={(e) => setAddForm({ ...addForm, late_minutes: Number(e.target.value) })}
                        className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-xl font-mono text-xs font-bold text-rose-800 focus:outline-none focus:border-rose-400"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1">Jam Pulang</label>
                      <input
                        type="time"
                        value={addForm.check_out_time}
                        onChange={(e) => setAddForm({ ...addForm, check_out_time: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1">Ketepatan Pulang</label>
                      <select
                        value={addForm.check_out_status}
                        onChange={(e) => setAddForm({ ...addForm, check_out_status: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                      >
                        <option value="tepat_waktu">Tepat Waktu (OK)</option>
                        <option value="pulang_cepat">Pulang Cepat</option>
                      </select>
                    </div>
                  </div>

                  {addForm.check_out_status === 'pulang_cepat' && (
                    <div>
                      <label className="block text-xs font-black text-amber-700 mb-1">Menit Pulang Lebih Awal</label>
                      <input
                        type="number"
                        min="1"
                        value={addForm.early_minutes}
                        onChange={(e) => setAddForm({ ...addForm, early_minutes: Number(e.target.value) })}
                        className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-xl font-mono text-xs font-bold text-amber-800 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Catatan Admin */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">Catatan / Alasan Input Manual</label>
                <textarea
                  rows={2}
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  placeholder="Contoh: Guru kelupaan tap absen / kendala HP..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                />
              </div>

              <ModalFooter>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    disabled={savingAdd}
                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingAdd}
                    className="flex-1 py-3 rounded-xl bg-secondary text-white font-black text-xs hover:bg-forest shadow-md shadow-secondary/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    {savingAdd && <RefreshCw size={14} className="animate-spin" />}
                    <span>{savingAdd ? 'Menyimpan…' : 'Simpan Presensi'}</span>
                  </button>
                </div>
              </ModalFooter>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL EDIT KOREKSI PRESENSI OLEH ADMIN */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editModalOpen && editingItem && (
          <Modal
            onClose={() => !savingEdit && setEditModalOpen(false)}
            title="Koreksi Data Presensi"
          >
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Nama Guru:</span>
                  <span className="text-sm font-black text-slate-900">{editingItem.teacher_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Tanggal:</span>
                  <span className="font-mono font-black text-slate-800">{editingItem.date}</span>
                </div>
              </div>

              {/* Status Kehadiran */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">Status Kehadiran</label>
                <div className="grid grid-cols-4 gap-2">
                  {['hadir', 'izin', 'sakit', 'dinas'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, status: st })}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition-all ${
                        editForm.status === st
                          ? 'bg-secondary text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jam Masuk & Ketepatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">Jam Masuk (WIB)</label>
                  <input
                    type="time"
                    value={editForm.check_in_time}
                    onChange={(e) => setEditForm({ ...editForm, check_in_time: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">Status Ketepatan</label>
                  <select
                    value={editForm.check_in_status}
                    onChange={(e) => setEditForm({ ...editForm, check_in_status: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                  >
                    <option value="tepat_waktu">Tepat Waktu</option>
                    <option value="terlambat">Terlambat</option>
                  </select>
                </div>
              </div>

              {/* Menit Terlambat (jika status terlambat) */}
              {editForm.check_in_status === 'terlambat' && (
                <div>
                  <label className="block text-xs font-black text-rose-700 mb-1.5">
                    Jumlah Keterlambatan (Menit)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.late_minutes}
                    onChange={(e) => setEditForm({ ...editForm, late_minutes: Number(e.target.value) })}
                    className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-xl font-mono text-xs font-bold text-rose-800 focus:outline-none focus:border-rose-400"
                  />
                </div>
              )}

              {/* Jam Pulang & Ketepatan Pulang */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">Jam Pulang (WIB)</label>
                  <input
                    type="time"
                    value={editForm.check_out_time}
                    onChange={(e) => setEditForm({ ...editForm, check_out_time: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">Status Kepulangan</label>
                  <select
                    value={editForm.check_out_status}
                    onChange={(e) => setEditForm({ ...editForm, check_out_status: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                  >
                    <option value="tepat_waktu">Tepat Waktu (OK)</option>
                    <option value="pulang_cepat">Pulang Cepat (Lebih Awal)</option>
                  </select>
                </div>
              </div>

              {/* Menit Pulang Cepat (jika status pulang cepat) */}
              {editForm.check_out_status === 'pulang_cepat' && (
                <div>
                  <label className="block text-xs font-black text-amber-700 mb-1.5">
                    Jumlah Menit Pulang Lebih Awal
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.early_minutes}
                    onChange={(e) => setEditForm({ ...editForm, early_minutes: Number(e.target.value) })}
                    className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-xl font-mono text-xs font-bold text-amber-800 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {/* Catatan Admin */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">Catatan / Alasan Koreksi</label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Contoh: Terjadi kendala sinyal GPS saat absen masuk..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary"
                />
              </div>

              <ModalFooter>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    disabled={savingEdit}
                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 py-3 rounded-xl bg-secondary text-white font-black text-xs hover:bg-forest shadow-md shadow-secondary/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    {savingEdit && <RefreshCw size={14} className="animate-spin" />}
                    <span>{savingEdit ? 'Menyimpan…' : 'Simpan Koreksi'}</span>
                  </button>
                </div>
              </ModalFooter>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI HAPUS PRESENSI (ICON SAMPAH) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            open={true}
            type="danger"
            title="Hapus Data Presensi?"
            message={`Apakah Anda yakin ingin menghapus catatan presensi untuk ${deleteTarget.teacher_name} pada tanggal ${deleteTarget.date}? Data ini akan dihapus permanen dari sistem.`}
            confirmLabel="Ya, Hapus Presensi"
            cancelLabel="Batal"
            loading={deleting}
            onConfirm={handleConfirmDelete}
            onCancel={() => !deleting && setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI HAPUS MASSAL (BULK DELETE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {bulkDeleteTarget.length > 0 && (
          <ConfirmDialog
            open={true}
            type="danger"
            title={`Hapus ${bulkDeleteTarget.length} Data Presensi?`}
            message={`Apakah Anda yakin ingin menghapus ${bulkDeleteTarget.length} data presensi yang dipilih? Baris yang dihapus tidak akan ditampilkan lagi di rekap presensi.`}
            confirmLabel={`Ya, Hapus ${bulkDeleteTarget.length} Data`}
            cancelLabel="Batal"
            loading={bulkDeleting}
            onConfirm={handleConfirmBulkDelete}
            onCancel={() => !bulkDeleting && setBulkDeleteTarget([])}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
