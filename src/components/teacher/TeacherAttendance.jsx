import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, MapPin, CheckCircle2, AlertTriangle, UserCheck, ShieldCheck,
  RefreshCw, Navigation, AlertCircle, Calendar, Sparkles, LogIn, LogOut,
  FileText, Send, ChevronDown, Check, Info, Phone, Lock, ExternalLink,
  Search, ArrowLeft, User, UserX
} from 'lucide-react';
import {
  getAttendanceToday, submitAttendance, getAttendanceTeachers, getAttendanceSettings
} from '../../services/gsheet';
import { Modal, ModalFooter, ConfirmDialog, ToastNotification } from './ModalKit';

// Rumus Haversine di browser untuk radar live
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function TeacherAttendance() {
  // Step Layar: 'list' (Pilih Guru) | 'punch' (Layar Tap Bulat)
  const [viewStep, setViewStep] = useState('list');
  const [searchTeacher, setSearchTeacher] = useState('');

  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [settings, setSettings] = useState(null);
  const [todayRecord, setTodayRecord] = useState(null);
  const [allTodayAttendances, setAllTodayAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // GPS & Permission State
  const [coords, setCoords] = useState(null); // { lat, lng, accuracy }
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [distance, setDistance] = useState(null);

  // Message Feedback Di Bawah Tombol Bulat (Auto-dismiss 3 detik)
  const [punchFeedback, setPunchFeedback] = useState(null);
  const punchTimerRef = useRef(null);

  // Modal Konfirmasi Checkout Lebih Awal (Early Leave)
  const [earlyCheckoutConfirm, setEarlyCheckoutConfirm] = useState({
    isOpen: false,
    earlyMinutes: 0,
    endTime: '15:00',
  });

  // Modal Izin / Sakit
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ status: 'izin', notes: '' });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Toast Notification Cadangan (Floating)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', title: '' });
  const showToast = (message, type = 'success', title = '') => {
    setToast({ show: true, message, type, title });
  };

  // Jam Digital Detik Berjalan
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitor Geolocation Permission API jika didukung browser
  useEffect(() => {
    if ('permissions' in navigator && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          setPermissionDenied(true);
        } else {
          setPermissionDenied(false);
        }
        result.onchange = () => {
          if (result.state === 'denied') {
            setPermissionDenied(true);
            setCoords(null);
          } else {
            setPermissionDenied(false);
            acquireGps(false);
          }
        };
      }).catch(() => {});
    }
  }, []);

  // Ambil Data Awal: Settings, Teachers & Presensi Hari Ini
  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);
      const [tRes, sRes, aRes] = await Promise.all([
        getAttendanceTeachers(),
        getAttendanceSettings(),
        getAttendanceToday(),
      ]);

      if (mounted) {
        if (tRes.success && Array.isArray(tRes.teachers)) {
          setTeachers(tRes.teachers);
        }
        if (sRes.success && sRes.settings) {
          setSettings(sRes.settings);
        }
        if (aRes && aRes.success && Array.isArray(aRes.attendances)) {
          setAllTodayAttendances(aRes.attendances);
        }
        setLoading(false);
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  // Ambil status presensi hari ini jika guru terpilih berubah
  useEffect(() => {
    if (!selectedTeacher) return;
    let mounted = true;

    async function loadToday() {
      const res = await getAttendanceToday(selectedTeacher.id);
      if (mounted && res.success) {
        const found = (res.attendances || []).find((a) => a.teacher_id === selectedTeacher.id);
        setTodayRecord(found || null);
      }
    }
    loadToday();
    return () => { mounted = false; };
  }, [selectedTeacher]);

  // Pantau GPS Perangkat
  const acquireGps = (isInteractive = false) => {
    setGpsLoading(true);
    setGpsError('');

    if (!('geolocation' in navigator)) {
      setGpsError('Perangkat tidak mendukung GPS Geolocation.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setCoords({ lat: userLat, lng: userLng, accuracy: Math.round(pos.coords.accuracy) });
        setPermissionDenied(false);
        setGpsLoading(false);
        setPermissionModalOpen(false);

        if (settings) {
          const d = getDistanceInMeters(userLat, userLng, settings.school_latitude, settings.school_longitude);
          setDistance(d);
        }
        if (isInteractive) {
          showToast('Lokasi GPS berhasil diizinkan dan terdeteksi.', 'success', 'GPS Aktif');
        }
      },
      (err) => {
        let msg = 'Gagal mendeteksi lokasi.';
        if (err.code === 1) {
          msg = 'Izin lokasi GPS ditolak oleh browser HP. Anda wajib memilih "Allow" / "Izinkan" untuk dapat melakukan absensi.';
          setPermissionDenied(true);
          if (isInteractive) {
            setPermissionModalOpen(true);
          }
        } else if (err.code === 2) {
          msg = 'Sinyal GPS lemah atau perangkat tidak dapat mendeteksi posisi.';
        } else if (err.code === 3) {
          msg = 'Waktu permintaan lokasi habis (timeout). Silakan coba lagi.';
        }
        setGpsError(msg);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
  };

  useEffect(() => {
    if (settings) acquireGps(false);
  }, [settings]);

  // Recalculate distance saat settings atau coords berubah
  useEffect(() => {
    if (coords && settings) {
      const d = getDistanceInMeters(coords.lat, coords.lng, settings.school_latitude, settings.school_longitude);
      setDistance(d);
    }
  }, [coords, settings]);

  // Tampilkan notifikasi di bawah tombol bulat yang hilang dalam 3 detik
  const triggerPunchFeedback = (title, message, type = 'success') => {
    if (punchTimerRef.current) clearTimeout(punchTimerRef.current);
    setPunchFeedback({ title, message, type });
    punchTimerRef.current = setTimeout(() => {
      setPunchFeedback(null);
    }, 3000);
  };

  // Bersihkan timer saat unmount
  useEffect(() => {
    return () => {
      if (punchTimerRef.current) clearTimeout(punchTimerRef.current);
    };
  }, []);

  // Filter daftar guru di layar pertama
  const filteredTeachers = useMemo(() => {
    const q = searchTeacher.toLowerCase().trim();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.role || '').toLowerCase().includes(q) ||
        (t.nip || '').toLowerCase().includes(q)
    );
  }, [teachers, searchTeacher]);

  // Memilih guru dari list -> masuk ke layar tap
  const handleSelectTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    setViewStep('punch');
    // Segera deteksi koordinat GPS
    acquireGps(false);
  };

  // Kembali ke list guru
  const handleBackToList = () => {
    setViewStep('list');
    setPunchFeedback(null);
  };

  // Validasi Geofence Radius
  const isGeofenceValid = useMemo(() => {
    if (!settings || !settings.is_geofence_enabled) return true;
    if (distance == null) return false;
    return distance <= Number(settings.max_distance_meters || 100);
  }, [distance, settings]);

  // Status Kehadiran Hari Ini
  const attendanceState = useMemo(() => {
    if (!todayRecord) return 'ready_check_in'; // Belum absen sama sekali
    if (todayRecord.status !== 'hadir') return 'leave_recorded'; // Izin/sakit
    if (todayRecord.check_in_time && !todayRecord.check_out_time) return 'ready_check_out'; // Sudah masuk, belum pulang
    if (todayRecord.check_in_time && todayRecord.check_out_time) return 'completed'; // Lengkap
    return 'ready_check_in';
  }, [todayRecord]);

  // Hitung Menit Pulang Cepat Secara Dinamis & Presisi
  const calculatedEarlyMinutes = useMemo(() => {
    if (!todayRecord?.check_out_time) return 0;
    if (todayRecord.early_minutes && Number(todayRecord.early_minutes) > 0) {
      return Number(todayRecord.early_minutes);
    }
    const endTimeStr = selectedTeacher?.work_end_time || settings?.work_end_time || '15:00';
    const outMins = parseTimeToMinutes(todayRecord.check_out_time.slice(0, 5));
    const endMins = parseTimeToMinutes(endTimeStr);
    return endMins > outMins ? (endMins - outMins) : 0;
  }, [todayRecord, selectedTeacher, settings]);

  const isEarlyCheckOut = useMemo(() => {
    if (!todayRecord?.check_out_time) return false;
    return todayRecord.check_out_status === 'pulang_cepat' || calculatedEarlyMinutes > 0;
  }, [todayRecord, calculatedEarlyMinutes]);

  // Eksekusi Submit Presensi (Masuk atau Pulang)
  const executePunch = async (type) => {
    setSubmitting(true);

    const res = await submitAttendance({
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.name,
      type,
      userLat: coords?.lat || null,
      userLng: coords?.lng || null,
      status: 'hadir',
    });

    setSubmitting(false);

    if (res.success) {
      if (type === 'check_in') {
        const isLate = res.checkInStatus === 'terlambat';
        triggerPunchFeedback(
          isLate ? 'Presensi Masuk (Terlambat)' : 'Presensi Masuk Berhasil',
          isLate
            ? `Tercatat pukul ${res.time.slice(0, 5)} WIB. Anda terlambat ${res.lateMinutes} menit.`
            : `Tepat waktu pukul ${res.time.slice(0, 5)} WIB. Barakallahu fiik.`,
          isLate ? 'warning' : 'success'
        );
      } else {
        const isEarly = res.checkOutStatus === 'pulang_cepat';
        const earlyM = res.earlyMinutes || Math.max(0, parseTimeToMinutes(selectedTeacher?.work_end_time || '15:00') - parseTimeToMinutes(res.time.slice(0, 5)));
        triggerPunchFeedback(
          isEarly ? 'Absen Pulang (Lebih Awal)' : 'Absen Pulang Berhasil',
          isEarly
            ? `Tercatat pukul ${res.time.slice(0, 5)} WIB (${earlyM} menit lebih awal).`
            : `Tercatat tepat waktu pukul ${res.time.slice(0, 5)} WIB. Selamat beristirahat!`,
          isEarly ? 'warning' : 'success'
        );
      }

      // Refresh data presensi guru hari ini
      const updated = await getAttendanceToday(selectedTeacher.id);
      if (updated.success) {
        const found = (updated.attendances || []).find((a) => a.teacher_id === selectedTeacher.id);
        setTodayRecord(found || null);
      }
      getAttendanceToday().then((all) => {
        if (all.success && Array.isArray(all.attendances)) setAllTodayAttendances(all.attendances);
      }).catch(() => {});
      getAttendanceToday().then((all) => {
        if (all.success && Array.isArray(all.attendances)) setAllTodayAttendances(all.attendances);
      }).catch(() => {});
    } else {
      triggerPunchFeedback('Presensi Gagal', res.error || 'Gagal mengirim presensi.', 'error');
    }
  };

  // Handler saat tombol tap bulat ditekan
  const handlePunchTrigger = async () => {
    if (!selectedTeacher) {
      showToast('Pilih nama guru terlebih dahulu.', 'warning', 'Peringatan');
      return;
    }

    if (attendanceState === 'completed') {
      triggerPunchFeedback('Presensi Selesai', 'Alhamdulillah, presensi Anda hari ini sudah lengkap (masuk & pulang).', 'success');
      return;
    }

    if (attendanceState === 'leave_recorded') {
      triggerPunchFeedback('Status Izin', `Hari ini Anda tercatat status: ${todayRecord.status.toUpperCase()}.`, 'info');
      return;
    }

    // WAJIB: Cek apakah izin lokasi GPS sudah diizinkan dan koordinat ada
    if (!coords) {
      setPermissionModalOpen(true);
      showToast(
        'Akses Lokasi (GPS) Wajib Diizinkan! Silakan klik "Allow" / "Izinkan" pada pop-up browser HP Anda.',
        'warning',
        'Izin Lokasi Diperlukan'
      );
      acquireGps(true);
      return;
    }

    // Cek Jarak GPS jika geofence aktif
    if (settings && settings.is_geofence_enabled && !isGeofenceValid) {
      triggerPunchFeedback(
        'Di Luar Radius Sekolah',
        `Jarak Anda (${distance != null ? distance + 'm' : 'tidak terdeteksi'}) berada di luar radius sekolah (${settings.max_distance_meters}m).`,
        'error'
      );
      return;
    }

    const type = attendanceState === 'ready_check_in' ? 'check_in' : 'check_out';

    // Jika tap checkout (pulang), validasi apakah di bawah jam pulang seharusnya
    if (type === 'check_out') {
      const currentH = currentTime.getHours();
      const currentM = currentTime.getMinutes();
      const nowTotalMinutes = currentH * 60 + currentM;

      const teacherEndTime = selectedTeacher.work_end_time || settings?.work_end_time || '15:00';
      const endTotalMinutes = parseTimeToMinutes(teacherEndTime);

      if (nowTotalMinutes < endTotalMinutes) {
        const earlyMins = endTotalMinutes - nowTotalMinutes;
        // Tampilkan dialog konfirmasi pulang lebih awal
        setEarlyCheckoutConfirm({
          isOpen: true,
          earlyMinutes: earlyMins,
          endTime: teacherEndTime,
        });
        return;
      }
    }

    // Jika masuk atau pulang tepat waktu/lewat, eksekusi langsung
    executePunch(type);
  };

  // Konfirmasi tetap pulang lebih awal
  const handleConfirmEarlyCheckout = () => {
    setEarlyCheckoutConfirm({ ...earlyCheckoutConfirm, isOpen: false });
    executePunch('check_out');
  };

  // Submit Izin / Sakit / Dinas
  const handleSaveLeave = async () => {
    if (!selectedTeacher) return;
    setSubmittingLeave(true);

    const res = await submitAttendance({
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.name,
      type: 'leave',
      status: leaveForm.status,
      notes: leaveForm.notes,
    });

    setSubmittingLeave(false);
    if (res.success) {
      triggerPunchFeedback('Keterangan Terkirim', `Status ${leaveForm.status.toUpperCase()} berhasil dicatat.`, 'info');
      setLeaveModalOpen(false);
      setLeaveForm({ status: 'izin', notes: '' });

      const updated = await getAttendanceToday(selectedTeacher.id);
      if (updated.success) {
        const found = (updated.attendances || []).find((a) => a.teacher_id === selectedTeacher.id);
        setTodayRecord(found || null);
      }
      getAttendanceToday().then((all) => {
        if (all.success && Array.isArray(all.attendances)) setAllTodayAttendances(all.attendances);
      }).catch(() => {});
    } else {
      showToast(res.error || 'Gagal menyimpan keterangan.', 'error', 'Gagal');
    }
  };

  // Format Jam & Tanggal
  const timeString = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFormatted = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 md:pb-16 [touch-action:pan-y]">
      {/* Toast Notification Mengambang Cadangan (Hanya Tampil Jika Ada Message & Show Aktif) */}
      <AnimatePresence>
        {toast?.show && toast?.message && (
          <ToastNotification
            toast={toast}
            onClose={() => setToast({ show: false, message: '', type: 'success', title: '' })}
          />
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* LAYAR 1: PILIH PROFIL GURU (GATE SCREEN — LIST 1 KOLOM MOBILE, RAMAH JEMPOL & SMOOTH SCROLL) */}
      {/* ========================================================================= */}
      {viewStep === 'list' && (
        <div className="space-y-3.5 [touch-action:pan-y]">
          {/* Header Ringkas Pilih Guru */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-secondary/10 text-secondary rounded-xl">
                <UserCheck size={20} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                  Pilih Identitas Guru
                </h2>
                <p className="text-[11px] font-semibold text-slate-400">
                  Ketuk nama Anda sebelum melakukan presensi.
                </p>
              </div>
            </div>

            {/* Pencarian Nama Guru Ringkas */}
            <div className="relative mt-3">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTeacher}
                onChange={(e) => setSearchTeacher(e.target.value)}
                placeholder="Cari nama Anda…"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary transition-all"
              />
            </div>
          </div>

          {/* List Guru Vertikal 1 Kolom di HP (Ramah Jempol, Anti-Macet Scroll) */}
          {loading ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm">
              <RefreshCw size={24} className="animate-spin text-secondary mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">Memuat daftar guru…</p>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm">
              <UserX size={36} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-700 text-sm font-black">Nama tidak ditemukan</p>
              <p className="text-xs text-slate-400 mt-0.5">Silakan cek kembali kata kunci pencarian.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 [touch-action:pan-y] [-webkit-overflow-scrolling:touch]">
              {filteredTeachers.map((teacher) => {
                const rec = (allTodayAttendances || []).find((a) => a.teacher_id === teacher.id);
                const hasIn = rec && rec.check_in_time;
                const hasOut = rec && rec.check_out_time;
                const isLeave = rec && rec.status && rec.status !== 'hadir';

                return (
                  <button
                    key={teacher.id}
                    type="button"
                    onClick={() => handleSelectTeacher(teacher)}
                    className="w-full bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 hover:border-secondary/40 shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-left flex items-center justify-between gap-3 group [touch-action:pan-y]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-secondary/15 to-forest/15 text-secondary group-hover:from-secondary group-hover:to-forest group-hover:text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm transition-all">
                        {(teacher.name || 'G').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 text-xs sm:text-sm truncate group-hover:text-secondary transition-colors">
                          {teacher.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {hasOut ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              ✓ Selesai ({rec.check_out_time.slice(0, 5)})
                            </span>
                          ) : hasIn ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                              ✓ Masuk ({rec.check_in_time.slice(0, 5)})
                            </span>
                          ) : isLeave ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md uppercase">
                              {rec.status}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">
                              Belum presensi hari ini
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="p-2 rounded-xl bg-slate-50 group-hover:bg-secondary group-hover:text-white text-slate-400 transition-all">
                        <ChevronRight size={16} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* LAYAR 2: LAYAR TAP BULAT PRESENSI */}
      {/* ========================================================================= */}
      {viewStep === 'punch' && selectedTeacher && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-5"
        >
          {/* Header Profil Guru Terpilih & Tombol Ganti Guru */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-secondary to-forest text-white flex items-center justify-center font-black text-base shrink-0 shadow-md shadow-secondary/20">
                {(selectedTeacher.name || 'G').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-secondary">
                    Presensi Aktif:
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 truncate leading-tight">
                  {selectedTeacher.name}
                </h2>
                <p className="text-[11px] font-semibold text-slate-400 truncate">
                  {selectedTeacher.nip ? `NIP: ${selectedTeacher.nip}` : selectedTeacher.role || 'Tenaga Pendidik'}
                </p>
              </div>
            </div>

            {/* Tombol Ganti Guru */}
            <button
              type="button"
              onClick={handleBackToList}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
              title="Ganti ke Guru Lain"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Ganti Guru</span>
            </button>
          </div>

          {/* Banner Peringatan Kritis: Izin Lokasi GPS Belum Diizinkan */}
          {(!coords || permissionDenied) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-4 sm:p-5 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-2xl shrink-0 mt-0.5">
                  <MapPin size={20} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-amber-900 leading-tight">
                    Izin Lokasi (GPS) Diperlukan
                  </h3>
                  <p className="text-[11px] font-bold text-amber-800/90 mt-0.5 leading-snug">
                    Pilih <span className="underline font-black">"Allow while visiting the site"</span> atau <span className="underline font-black">"Allow this time"</span> pada pop-up browser HP Anda agar tombol absen dapat digunakan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => acquireGps(true)}
                disabled={gpsLoading}
                className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center justify-center gap-1.5"
              >
                <Navigation size={13} className={gpsLoading ? 'animate-spin' : ''} />
                <span>{gpsLoading ? 'Mendeteksi…' : 'Izinkan Lokasi Sekarang'}</span>
              </button>
            </motion.div>
          )}

          {/* Clock & Radar GPS Card */}
          <div className="bg-gradient-to-br from-primary via-slate-900 to-forest rounded-3xl p-6 text-white text-center shadow-xl shadow-primary/10 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-secondary/10 blur-2xl pointer-events-none" />
            <div className="absolute -left-10 -top-10 w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

            <p className="text-xs font-semibold text-secondary flex items-center justify-center gap-1.5 mb-1">
              <Calendar size={13} />
              {dateFormatted}
            </p>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight font-mono text-white mb-3">
              {timeString}
            </h1>

            {/* Radar Geofencing GPS Status */}
            <div className="pt-2 border-t border-white/10 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 flex-wrap justify-center text-xs">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
                  !coords
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : gpsLoading
                      ? 'bg-white/10 text-slate-300'
                      : isGeofenceValid
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  <Navigation size={13} className={gpsLoading ? 'animate-spin' : ''} />
                  <span>
                    {!coords
                      ? 'Izin Lokasi Belum Diizinkan'
                      : gpsLoading
                        ? 'Mencari sinyal GPS HP…'
                        : gpsError
                          ? 'GPS Error'
                          : distance != null
                            ? `Jarak ke Sekolah: ${distance} m`
                            : 'Koordinat terdeteksi'}
                  </span>
                </div>

                <button
                  onClick={() => acquireGps(true)}
                  disabled={gpsLoading}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                  title="Perbarui Akurasi Lokasi GPS"
                >
                  <RefreshCw size={12} className={gpsLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Keterangan batas radius & Transparansi Koordinat */}
              {settings && (
                <div className="text-[11px] font-medium text-slate-300 space-y-1 mt-1">
                  <p>
                    {settings.is_geofence_enabled ? (
                      <>Radius maksimal presensi: <b className="text-secondary">{settings.max_distance_meters} meter</b> dari titik gerbang sekolah</>
                    ) : (
                      <span className="text-amber-300 font-semibold">Validasi batas jarak sedang dinonaktifkan</span>
                    )}
                  </p>
                  {coords && (
                    <div className="flex items-center justify-center gap-3 text-[10px] font-mono text-slate-400 pt-1">
                      <span>GPS Anda: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
                      <span>•</span>
                      <span>Target Sekolah: {Number(settings.school_latitude).toFixed(5)}, {Number(settings.school_longitude).toFixed(5)}</span>
                    </div>
                  )}
                </div>
              )}

              {gpsError && (
                <p className="text-[11px] text-rose-400 font-bold bg-rose-950/40 px-3 py-1 rounded-xl mt-1">
                  {gpsError}
                </p>
              )}
            </div>
          </div>

          {/* HERO TRIGGER BUTTON (Tombol Bulat Besar) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center relative">
            <div className="mb-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                {!coords
                  ? 'Wajib Izinkan Akses Lokasi (GPS)'
                  : attendanceState === 'ready_check_in'
                    ? 'Tahap 1: Absen Masuk'
                    : attendanceState === 'ready_check_out'
                      ? 'Tahap 2: Absen Pulang'
                      : attendanceState === 'completed'
                        ? 'Presensi Hari Ini Lengkap'
                        : 'Status Khusus Hari Ini'}
              </p>
              <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                {selectedTeacher.name}
              </p>
            </div>

            {/* BULATAN BESAR INTERAKTIF */}
            <div className="relative my-2">
              {coords && (attendanceState === 'ready_check_in' || attendanceState === 'ready_check_out') && (
                <div
                  className={`absolute inset-0 rounded-full animate-ping opacity-25 pointer-events-none ${
                    attendanceState === 'ready_check_in' ? 'bg-secondary' : 'bg-amber-500'
                  }`}
                />
              )}

              <motion.button
                whileTap={{ scale: 0.94 }}
                whileHover={{ scale: 1.02 }}
                onClick={handlePunchTrigger}
                disabled={submitting || attendanceState === 'completed' || attendanceState === 'leave_recorded'}
                className={`w-48 h-48 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center p-4 text-white font-black shadow-2xl transition-all relative z-10 cursor-pointer disabled:cursor-default ${
                  !coords
                    ? 'bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 ring-8 ring-amber-500/20 shadow-amber-500/30'
                    : attendanceState === 'ready_check_in'
                      ? 'bg-gradient-to-tr from-secondary to-emerald-400 shadow-secondary/30 ring-8 ring-secondary/15'
                      : attendanceState === 'ready_check_out'
                        ? 'bg-gradient-to-tr from-amber-600 to-amber-400 shadow-amber-500/30 ring-8 ring-amber-500/15'
                        : attendanceState === 'leave_recorded'
                          ? 'bg-gradient-to-tr from-blue-600 to-blue-400 ring-8 ring-blue-500/15'
                          : 'bg-gradient-to-tr from-slate-700 to-slate-600 ring-8 ring-slate-200'
                }`}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={36} className="animate-spin mb-2" />
                    <span className="text-sm uppercase tracking-wider">Memproses…</span>
                  </>
                ) : !coords ? (
                  <>
                    <div className="p-3 bg-white/20 rounded-full mb-2">
                      <MapPin size={32} className="animate-bounce" />
                    </div>
                    <span className="text-base sm:text-lg font-black tracking-tight leading-tight">IZINKAN LOKASI</span>
                    <span className="text-[11px] font-bold text-amber-100 mt-1">Ketuk untuk Izin GPS</span>
                  </>
                ) : attendanceState === 'ready_check_in' ? (
                  <>
                    <div className="p-3 bg-white/20 rounded-full mb-2">
                      <LogIn size={32} />
                    </div>
                    <span className="text-lg sm:text-xl font-black tracking-tight leading-tight">TAP HADIR</span>
                    <span className="text-[11px] font-bold text-emerald-100 mt-1">Absen Masuk</span>
                  </>
                ) : attendanceState === 'ready_check_out' ? (
                  <>
                    <div className="p-3 bg-white/20 rounded-full mb-2">
                      <LogOut size={32} />
                    </div>
                    <span className="text-lg sm:text-xl font-black tracking-tight leading-tight">TAP PULANG</span>
                    <span className="text-[11px] font-bold text-amber-100 mt-1">Absen Pulang</span>
                  </>
                ) : attendanceState === 'leave_recorded' ? (
                  <>
                    <div className="p-3 bg-white/20 rounded-full mb-2">
                      <FileText size={32} />
                    </div>
                    <span className="text-base sm:text-lg font-black uppercase">{todayRecord?.status || 'Izin'}</span>
                    <span className="text-[11px] font-bold text-blue-100 mt-1">Tercatat di Sistem</span>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-emerald-500/30 rounded-full mb-2">
                      <CheckCircle2 size={36} className="text-emerald-300" />
                    </div>
                    <span className="text-base sm:text-lg font-black tracking-tight">SELESAI</span>
                    <span className="text-[11px] font-bold text-slate-300 mt-1">Hadir Lengkap</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* NOTIFIKASI HASIL TAP TEPAT DI BAWAH BUTTON TAP (Auto-Dismiss 3 Detik) */}
            <AnimatePresence>
              {punchFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`w-full max-w-sm mt-4 p-3.5 rounded-2xl border text-center shadow-lg ${
                    punchFeedback.type === 'error'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : punchFeedback.type === 'warning'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 font-black text-xs sm:text-sm">
                    {punchFeedback.type === 'error' ? (
                      <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    ) : punchFeedback.type === 'warning' ? (
                      <Clock size={16} className="text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    )}
                    <span>{punchFeedback.title}</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 mt-0.5 leading-snug">
                    {punchFeedback.message}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ringkasan Status Presensi Hari Ini */}
            {todayRecord && (
              <div className="w-full mt-6 pt-5 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-3 text-left">
                  {/* Jam Masuk */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Jam Masuk</span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-sm font-black text-slate-800">
                        {todayRecord.check_in_time ? `${todayRecord.check_in_time.slice(0, 5)} WIB` : '-'}
                      </span>
                      {todayRecord.check_in_status === 'tepat_waktu' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-700">Tepat Waktu</span>
                      )}
                      {todayRecord.check_in_status === 'terlambat' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700">
                          Telat {todayRecord.late_minutes}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Jam Pulang (Validasi Tepat Waktu vs Pulang Cepat [Opsi A]) */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Jam Pulang</span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-sm font-black text-slate-800">
                        {todayRecord.check_out_time ? `${todayRecord.check_out_time.slice(0, 5)} WIB` : '-'}
                      </span>
                      {todayRecord.check_out_time && (
                        isEarlyCheckOut && calculatedEarlyMinutes > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-300">
                            Cepat {calculatedEarlyMinutes}m
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-700">
                            OK
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {todayRecord.notes && (
                  <p className="text-xs text-slate-500 font-bold mt-2.5 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                    📝 Catatan: {todayRecord.notes}
                  </p>
                )}
              </div>
            )}

            {/* Tombol Opsi: Ajukan Izin / Sakit / Dinas */}
            {attendanceState === 'ready_check_in' && (
              <button
                type="button"
                onClick={() => setLeaveModalOpen(true)}
                className="mt-5 text-xs font-black text-slate-400 hover:text-secondary transition-colors underline flex items-center gap-1"
              >
                Berhalangan hadir? Ajukan Izin / Sakit / Dinas
              </button>
            )}
          </div>

          {/* Info Aturan Jadwal Presensi Guru Terpilih */}
          {settings && (
            <div className="bg-amber-50/70 border border-amber-200/60 rounded-3xl p-4 sm:p-5 text-xs text-amber-900 space-y-2">
              <div className="flex items-center justify-between font-black text-amber-950">
                <div className="flex items-center gap-2">
                  <Info size={16} />
                  <span>Ketentuan Jam Kerja Presensi</span>
                </div>
                <span className="text-[10px] font-black text-secondary bg-white px-2 py-0.5 rounded-full border border-secondary/20">
                  Jadwal: {selectedTeacher.name}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-bold">
                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/40">
                  <span className="text-[10px] text-amber-700 block">Jam Masuk:</span>
                  <span className="font-black text-slate-900">
                    {selectedTeacher.work_start_time || settings.work_start_time} WIB
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/40">
                  <span className="text-[10px] text-amber-700 block">Batas Toleransi:</span>
                  <span className="font-black text-rose-600">
                    {selectedTeacher.late_threshold_time || settings.late_threshold_time} WIB
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/40 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-amber-700 block">Jam Pulang:</span>
                  <span className="font-black text-slate-900">
                    {selectedTeacher.work_end_time || settings.work_end_time} WIB
                  </span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* DIALOG KONFIRMASI CHECKOUT LEBIH AWAL (PULANG CEPAT) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {earlyCheckoutConfirm.isOpen && (
          <ConfirmDialog
            open={earlyCheckoutConfirm.isOpen}
            type="warning"
            title="Konfirmasi Absen Pulang Lebih Awal"
            message={`Jadwal kepulangan Anda adalah pukul ${earlyCheckoutConfirm.endTime} WIB. Saat ini Anda melakukan presensi pulang ${earlyCheckoutConfirm.earlyMinutes} menit lebih awal dari jam kerja seharusnya. Apakah Anda yakin ingin checkout sekarang?`}
            confirmLabel="Ya, Tetap Checkout"
            cancelLabel="Batal"
            hideIcon={true}
            loading={submitting}
            onConfirm={handleConfirmEarlyCheckout}
            onCancel={() => setEarlyCheckoutConfirm({ ...earlyCheckoutConfirm, isOpen: false })}
          />
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL PANDUAN IZIN LOKASI (GPS WAJIB ALLOW) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {permissionModalOpen && (
          <Modal onClose={() => setPermissionModalOpen(false)} title="Izin Lokasi (GPS) Wajib Diaktifkan">
            <div className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                <MapPin size={32} className="animate-bounce" />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">
                  Perangkat Memerlukan Akses Lokasi
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-1 leading-relaxed">
                  Untuk memverifikasi bahwa Anda hadir di lingkungan sekolah, sistem presensi mewajibkan izin akses lokasi GPS di browser HP Anda.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-left space-y-3 text-xs font-bold text-slate-700">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-secondary text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                  <span>
                    Jika muncul pop-up browser, pilih <b className="text-emerald-700">"Allow while visiting the site"</b> atau <b className="text-emerald-700">"Allow this time"</b>.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-secondary text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                  <span>
                    Jika sebelumnya terlanjur memilih <b className="text-rose-600">"Never allow" / "Blokir"</b>:
                    <ul className="list-disc pl-4 mt-1 font-medium text-slate-600 space-y-0.5 text-[11px]">
                      <li>Ketuk ikon <b>Gembok 🔒</b> atau simbol pengaturan di sebelah kiri kolom URL browser HP.</li>
                      <li>Ketuk <b>Izin Situs (Permissions)</b> → Aktifkan <b>Lokasi (Location)</b>.</li>
                      <li>Setelah itu, ketuk tombol <b>"Coba Izinkan Lokasi Lagi"</b> di bawah.</li>
                    </ul>
                  </span>
                </div>
              </div>
            </div>

            <ModalFooter>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPermissionModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => acquireGps(true)}
                  disabled={gpsLoading}
                  className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-black transition-all flex items-center justify-center gap-1.5"
                >
                  <Navigation size={14} className={gpsLoading ? 'animate-spin' : ''} />
                  <span>{gpsLoading ? 'Mendeteksi…' : 'Coba Izinkan Lokasi Lagi'}</span>
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL PENGAJUAN IZIN / SAKIT / DINAS */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {leaveModalOpen && selectedTeacher && (
          <Modal onClose={() => !submittingLeave && setLeaveModalOpen(false)} title="Form Izin / Sakit / Dinas">
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">Nama Guru:</label>
                <div className="p-3 bg-slate-100 rounded-2xl font-bold text-sm text-slate-800">
                  {selectedTeacher.name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">Kategori Ketidakhadiran:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['izin', 'sakit', 'dinas'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setLeaveForm({ ...leaveForm, status: st })}
                      className={`py-3 rounded-2xl text-xs font-black uppercase transition-all ${
                        leaveForm.status === st
                          ? 'bg-secondary text-white shadow-md shadow-secondary/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">Keterangan / Alasan:</label>
                <textarea
                  rows={3}
                  value={leaveForm.notes}
                  onChange={(e) => setLeaveForm({ ...leaveForm, notes: e.target.value })}
                  placeholder="Contoh: Mengikuti pelatihan kurikulum di dinas pendidikan / Sakit demam..."
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary transition-all"
                />
              </div>
            </div>

            <ModalFooter>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  disabled={submittingLeave}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveLeave}
                  disabled={submittingLeave}
                  className="flex-1 py-3 rounded-xl bg-secondary text-white font-black text-xs hover:bg-forest shadow-md shadow-secondary/20 transition-all flex items-center justify-center gap-1.5"
                >
                  {submittingLeave && <RefreshCw size={14} className="animate-spin" />}
                  <span>{submittingLeave ? 'Mengirim…' : 'Kirim Keterangan'}</span>
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
