import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CameraOff, SwitchCamera, CheckCircle2, AlertTriangle,
  Clock, Calendar, User, Users, QrCode, Sparkles, Send,
  FileSpreadsheet, Download, RefreshCw, XCircle, Search,
  Check, X, ChevronDown, Award, HeartPulse, UserCheck, UserX,
  Volume2, VolumeX, ShieldCheck, ArrowRight, Eye,
  Copy, MessageSquare, Share2, CreditCard, Edit3, Upload
} from 'lucide-react';
import {
  getStudentAttendanceTodayClass,
  submitStudentAttendanceBatch,
  getStudentAttendanceRecap,
  fetchSchoolData,
  describeMutationError
} from '../../services/gsheet';
import { ToastNotification, Modal, ModalFooter } from './ModalKit';
import StudentIdCardModal from './StudentIdCardModal';

const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];

// Audio Beep Sintesis Web Audio API (Tanpa file eksternal, instan & bebas kuota)
let sharedAudioCtx = null;

function initAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
  } catch (err) {}
}

function playScanSound() {
  try {
    initAudio();
    if (!sharedAudioCtx) return;
    const ctx = sharedAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Nada ceria dua frekuensi (880Hz -> 1320Hz)
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch (err) {
    // Abaikan jika autoplay policy membatasi audio
  }
}

// Getar HP (Haptic Feedback) untuk guru saat scan kamera depan
function triggerHaptic() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 150]);
    }
  } catch (err) {}
}

// Format jam WIB saat ini HH:MM:SS
function getCurrentWibTime() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000));
  const hh = String(wib.getHours()).padStart(2, '0');
  const mm = String(wib.getMinutes()).padStart(2, '0');
  const ss = String(wib.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// Format tanggal YYYY-MM-DD WIB
function getCurrentWibDate() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000));
  const yyyy = wib.getFullYear();
  const mm = String(wib.getMonth() + 1).padStart(2, '0');
  const dd = String(wib.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function TeacherStudentAttendance() {
  // Pilihan Kelas & Tanggal
  const [selectedGrade, setSelectedGrade] = useState(() => localStorage.getItem('last_active_grade_attendance') || 'SD 1');
  const [targetDate, setTargetDate] = useState(() => getCurrentWibDate());

  // Data Siswa & Presensi dari Server
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmittedServer, setIsSubmittedServer] = useState(false);

  // Buffer Draft Presensi Lokal (Map studentId -> record presensi)
  const [attendanceMap, setAttendanceMap] = useState({});
  const [lastScannedStudent, setLastScannedStudent] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Status Kamera & Scanner
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (belakang) | 'user' (depan)
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null);
  const scanCooldownRef = useRef(0);
  const handleDecodedQrRef = useRef(null);
  const fileInputRef = useRef(null);

  // Submitting State & Toast
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', title: '' });

  // Modal Cetak ID Card Langsung & Modal Catatan Siswa
  const [idCardModalOpen, setIdCardModalOpen] = useState(false);
  const [idCardStudent, setIdCardStudent] = useState(null);
  const [noteModal, setNoteModal] = useState({ open: false, student: null, noteText: '', targetStatus: '' });

  // Responsif Mobile Tab & Filter Siswa
  const [mobileViewTab, setMobileViewTab] = useState('scanner'); // 'scanner' | 'list'
  const [searchStudent, setSearchStudent] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'unrecorded' | 'hadir' | 'sakit_izin' | 'alpha'

  const showToast = (message, type = 'success', title = '') => {
    setToast({ show: true, message, type, title });
  };

  // Kunci storage draft lokal
  const draftKey = `mias_att_draft_${targetDate}_${selectedGrade.replace(/\s+/g, '_')}`;

  // 1. Muat Data Siswa & Presensi Kelas Terpilih
  const loadClassAttendance = useCallback(async () => {
    setLoading(true);
    setCameraError('');
    try {
      const res = await getStudentAttendanceTodayClass({ kelas: selectedGrade, date: targetDate });
      const studentList = res.students || [];
      setStudents(studentList);
      setIsSubmittedServer(res.isSubmitted || false);

      // Cek apakah ada draft yang belum ter-submit di localStorage
      let localDraft = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) localDraft = JSON.parse(raw);
      } catch {}

      // Bangun map presensi
      const newMap = {};

      if (localDraft && Object.keys(localDraft).length > 0) {
        // Gunakan draft lokal jika ada
        studentList.forEach((s) => {
          if (localDraft[s.id]) {
            newMap[s.id] = localDraft[s.id];
          }
        });
      } else if (res.attendances && res.attendances.length > 0) {
        // Gunakan data tersimpan dari server
        res.attendances.forEach((att) => {
          newMap[att.student_id] = {
            student_id: att.student_id,
            student_name: att.student_name,
            status: att.status || 'hadir',
            method: att.method || 'qr_scan',
            scan_time: att.scan_time || '',
            notes: att.notes || '',
          };
        });
      }

      setAttendanceMap(newMap);
    } catch (err) {
      console.error('loadClassAttendance error:', err);
      showToast('Gagal memuat data presensi: ' + err.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  }, [selectedGrade, targetDate, draftKey]);

  useEffect(() => {
    loadClassAttendance();
  }, [loadClassAttendance]);

  // Simpan perubahan ke draft lokal secara otomatis
  useEffect(() => {
    if (Object.keys(attendanceMap).length > 0) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(attendanceMap));
      } catch {}
    }
  }, [attendanceMap, draftKey]);

  // 2. Parser Payload QR Code Siswa
  const handleDecodedQr = useCallback((decodedText) => {
    const now = Date.now();
    // Cooldown 2 detik agar kartu tidak ter-scan berulang kali seketika
    if (now - scanCooldownRef.current < 2000) return;
    scanCooldownRef.current = now;

    if (!decodedText || typeof decodedText !== 'string') return;

    let studentId = '';
    let studentNisn = '';
    let studentName = '';

    // Coba parse JSON payload: {"app":"mias","id":"...","nisn":"...","name":"..."}
    try {
      const parsed = JSON.parse(decodedText);
      if (parsed.id) {
        studentId = String(parsed.id).trim();
      }
      if (parsed.nisn) {
        studentNisn = String(parsed.nisn).trim();
      }
      studentName = parsed.name || '';
    } catch {
      // Fallback format string: "MIAS:123:..." atau plain ID
      if (decodedText.startsWith('MIAS:')) {
        const parts = decodedText.split(':');
        studentId = parts[1] || '';
      } else {
        studentId = decodedText.trim();
      }
    }

    if (!studentId && !studentNisn) return;

    // Cari siswa di daftar kelas ini (cocokkan ID unik, NISN resmi, atau NIS)
    const matched = students.find((s) => {
      const matchId = studentId && String(s.id).toLowerCase() === studentId.toLowerCase();
      const matchNis = studentId && s.nis && String(s.nis).toLowerCase() === studentId.toLowerCase();
      const matchNisnWithId = studentId && s.nisn && String(s.nisn).toLowerCase() === studentId.toLowerCase();
      const matchNisnDirect = studentNisn && s.nisn && String(s.nisn).toLowerCase() === studentNisn.toLowerCase();
      return matchId || matchNis || matchNisnWithId || matchNisnDirect;
    });

    if (!matched) {
      // Siswa bukan dari kelas ini
      showToast(`Kartu tidak terdaftar di kelas ${selectedGrade}. ID/Kode: ${studentId || studentNisn}. Pastikan dropdown kelas di atas sudah sesuai.`, 'warning', 'Siswa Tidak Ditemukan');
      return;
    }

    // Efek Beep Audio & Getar HP
    if (soundEnabled) playScanSound();
    triggerHaptic();

    const scanTime = getCurrentWibTime();

    // Update Attendance Map
    setAttendanceMap((prev) => ({
      ...prev,
      [matched.id]: {
        student_id: matched.id,
        student_name: matched.nama_siswa,
        status: 'hadir',
        method: 'qr_scan',
        scan_time: scanTime,
        notes: '',
      },
    }));

    // Tampilkan Banner Siswa Berhasil Di-Scan
    setLastScannedStudent({
      ...matched,
      scan_time: scanTime,
      status: 'hadir',
    });

    // Sembunyikan banner otomatis setelah 3.5 detik
    setTimeout(() => {
      setLastScannedStudent((curr) => (curr?.id === matched.id ? null : curr));
    }, 3500);
  }, [students, selectedGrade, soundEnabled]);

  // Selalu perbarui ref agar scanner selalu mengeksekusi closure data siswa terbaru
  handleDecodedQrRef.current = handleDecodedQr;

  // 3. Kontrol Kamera dengan Html5Qrcode (dengan akselerasi BarcodeDetector jika didukung browser)
  const startCamera = async (modeOverride) => {
    initAudio(); // Aktifkan/resume audio context dari interaksi tombol guru
    const activeMode = typeof modeOverride === 'string' ? modeOverride : facingMode;
    setCameraError('');
    setIsCameraActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
      }

      const scanner = new Html5Qrcode('qr-reader-viewport', {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true, // Gunakan C++ BarcodeDetector native Chrome untuk deteksi kilat
        },
        verbose: false,
      });
      scannerRef.current = scanner;

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edge = Math.max(180, Math.floor(minEdge * 0.85)); // 85% area deteksi luas
          return { width: edge, height: edge };
        },
        aspectRatio: 1.0,
      };

      await scanner.start(
        { facingMode: activeMode },
        config,
        (decodedText) => {
          if (handleDecodedQrRef.current) {
            handleDecodedQrRef.current(decodedText);
          }
        },
        () => {} // Abaikan frame gagal deteksi
      );
    } catch (err) {
      console.error('Camera start error:', err);
      setCameraError('Gagal mengakses kamera: ' + (err.message || 'Periksa izin kamera browser.'));
      setIsCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isCameraActive) {
      await stopCamera();
      // Beri sedikit jeda agar hardware release stream lama
      setTimeout(() => {
        startCamera(nextMode);
      }, 250);
    }
  };

  // Handler Scan dari File Gambar / Foto Kartu
  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      initAudio();
      const { Html5Qrcode } = await import('html5-qrcode');
      if (scannerRef.current && isCameraActive) {
        await stopCamera();
      }
      const tempScanner = new Html5Qrcode('qr-reader-viewport', { verbose: false });
      const decodedText = await tempScanner.scanFile(file, true);
      tempScanner.clear();
      if (handleDecodedQrRef.current) {
        handleDecodedQrRef.current(decodedText);
      }
    } catch (err) {
      console.error('Scan file error:', err);
      showToast('QR Code tidak dapat dideteksi dari gambar tersebut. Pastikan pola QR code terlihat jelas dan tidak buram.', 'error', 'Scan Gagal');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // 4. Update Status Manual Siswa (Sakit, Izin, Alpha, Ketinggalan Kartu)
  const setStudentStatus = (studentId, studentName, status, method = 'manual_wali_kelas', notes = '') => {
    const scanTime = status === 'hadir' ? getCurrentWibTime() : '';
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        student_id: studentId,
        student_name: studentName,
        status,
        method,
        scan_time: scanTime,
        notes,
      },
    }));
  };

  // Tandai semua yang belum scan sebagai...
  const markAllUnscannedAs = (status) => {
    const unscanned = students.filter((s) => !attendanceMap[s.id]);
    if (unscanned.length === 0) return;

    setAttendanceMap((prev) => {
      const next = { ...prev };
      unscanned.forEach((s) => {
        next[s.id] = {
          student_id: s.id,
          student_name: s.nama_siswa,
          status,
          method: 'manual_wali_kelas',
          scan_time: status === 'hadir' ? getCurrentWibTime() : '',
          notes: '',
        };
      });
      return next;
    });

    showToast(`${unscanned.length} siswa ditandai sebagai ${status.toUpperCase()}.`, 'info', 'Presensi Diperbarui');
  };

  // 5. Batch Submit ke Cloudflare D1
  const handleSubmitBatch = async () => {
    if (students.length === 0) return;

    // Pastikan semua siswa memiliki status (jika belum, otomatis set alpha atau konfirmasi)
    const unscannedCount = students.filter((s) => !attendanceMap[s.id]).length;
    if (unscannedCount > 0) {
      const confirmSubmit = window.confirm(
        `Masih ada ${unscannedCount} siswa yang belum tercatat presensinya. Siswa yang belum tercatat akan otomatis dianggap 'Alpha'. Lanjutkan simpan?`
      );
      if (!confirmSubmit) return;
    }

    setSubmitting(true);
    try {
      const itemsToSubmit = students.map((s) => {
        const recorded = attendanceMap[s.id];
        if (recorded) {
          return {
            student_id: s.id,
            student_name: s.nama_siswa,
            status: recorded.status || 'hadir',
            method: recorded.method || 'qr_scan',
            scan_time: recorded.scan_time || '',
            notes: recorded.notes || '',
          };
        }
        return {
          student_id: s.id,
          student_name: s.nama_siswa,
          status: 'alpha',
          method: 'auto_unscanned',
          scan_time: '',
          notes: 'Tidak hadir & tidak ada keterangan',
        };
      });

      // Ambil nama pengguna guru yang sedang login
      let teacherName = 'Guru Wali Kelas';
      try {
        const rawUser = localStorage.getItem('teacherUser') || sessionStorage.getItem('teacherUser');
        if (rawUser) {
          const u = JSON.parse(rawUser);
          teacherName = u.name || u.username || 'Guru Wali Kelas';
        }
      } catch {}

      const res = await submitStudentAttendanceBatch({
        date: targetDate,
        kelas: selectedGrade,
        submitted_by: teacherName,
        items: itemsToSubmit,
      });

      if (res.success) {
        showToast(
          `Presensi ${itemsToSubmit.length} siswa kelas ${selectedGrade} tanggal ${targetDate} berhasil disimpan!`,
          'success',
          'Tersimpan di Database'
        );
        setIsSubmittedServer(true);
        // Hapus draft lokal setelah berhasil submit
        try { localStorage.removeItem(draftKey); } catch {}
        if (isCameraActive) stopCamera();
      } else {
        showToast(res.error || 'Gagal menyimpan presensi.', 'error', 'Error');
      }
    } catch (err) {
      console.error('handleSubmitBatch error:', err);
      showToast('Terjadi kesalahan koneksi: ' + err.message, 'error', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  // Statistik Kehadiran Kelas
  const stats = useMemo(() => {
    const total = students.length;
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpha = 0;
    let belumScan = 0;

    students.forEach((s) => {
      const rec = attendanceMap[s.id];
      if (!rec) {
        belumScan++;
      } else if (rec.status === 'hadir') {
        hadir++;
      } else if (rec.status === 'sakit') {
        sakit++;
      } else if (rec.status === 'izin') {
        izin++;
      } else if (rec.status === 'alpha') {
        alpha++;
      }
    });

    return { total, hadir, sakit, izin, alpha, belumScan };
  }, [students, attendanceMap]);

  // Filter, Pencarian, & Pengurutan Siswa di Tabel
  // Prioritas Utama: Siswa yang BELUM absen/scan otomatis tampil di paling atas!
  const filteredStudents = useMemo(() => {
    let list = students;
    if (searchStudent) {
      const q = searchStudent.toLowerCase().trim();
      list = list.filter((s) =>
        String(s.nama_siswa || '').toLowerCase().includes(q) ||
        String(s.nisn || '').toLowerCase().includes(q) ||
        String(s.nis || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      list = list.filter((s) => {
        const rec = attendanceMap[s.id];
        const status = rec?.status || 'unrecorded';
        if (filterStatus === 'unrecorded') return status === 'unrecorded';
        if (filterStatus === 'hadir') return status === 'hadir';
        if (filterStatus === 'sakit_izin') return status === 'sakit' || status === 'izin';
        if (filterStatus === 'alpha') return status === 'alpha';
        return true;
      });
    }

    // Urutkan: Santri yang belum scan/absen otomatis tampil di daftar paling atas
    return [...list].sort((a, b) => {
      const recA = attendanceMap[a.id];
      const recB = attendanceMap[b.id];
      const isUnrecordedA = !recA || recA.status === 'unrecorded';
      const isUnrecordedB = !recB || recB.status === 'unrecorded';

      // Jika satu belum absen dan satu sudah: yang belum absen naik ke atas
      if (isUnrecordedA !== isUnrecordedB) {
        return isUnrecordedA ? -1 : 1;
      }

      // Di dalam masing-masing kelompok (belum absen vs sudah absen): urutkan alfabetis A-Z
      return String(a.nama_siswa || '').localeCompare(String(b.nama_siswa || ''));
    });
  }, [students, attendanceMap, searchStudent, filterStatus]);

  // 6. Format & Broadcast Laporan Presensi WhatsApp
  const generateWhatsAppReport = () => {
    const hadirList = [];
    const sakitList = [];
    const izinList = [];
    const alphaList = [];

    students.forEach((s) => {
      const rec = attendanceMap[s.id];
      const status = rec?.status || 'alpha';
      const noteSuffix = rec?.notes ? ` (${rec.notes})` : '';
      if (status === 'hadir') {
        const flag = rec?.method === 'ketinggalan_kartu' ? ' (Lupa Kartu)' : '';
        hadirList.push(`${s.nama_siswa}${flag}`);
      } else if (status === 'sakit') {
        sakitList.push(`${s.nama_siswa}${noteSuffix}`);
      } else if (status === 'izin') {
        izinList.push(`${s.nama_siswa}${noteSuffix}`);
      } else {
        alphaList.push(`${s.nama_siswa}${noteSuffix}`);
      }
    });

    const totalStudents = students.length;
    const rate = totalStudents > 0 ? Math.round((hadirList.length / totalStudents) * 100) : 0;

    let text = `*LAPORAN PRESENSI HARIAN SISWA*\n`;
    text += `*Sekolah Islam Imam Syafi'i Percut*\n`;
    text += `══════════════════════════\n`;
    text += `📅 *Hari/Tanggal:* ${targetDate}\n`;
    text += `🏫 *Kelas:* ${selectedGrade}\n`;
    text += `══════════════════════════\n\n`;
    text += `📊 *Ringkasan Kehadiran:*\n`;
    text += `• ✅ Hadir: ${hadirList.length} siswa\n`;
    text += `• 🏥 Sakit: ${sakitList.length} siswa\n`;
    text += `• ✉️ Izin: ${izinList.length} siswa\n`;
    text += `• ❌ Alpha: ${alphaList.length} siswa\n`;
    text += `• 📈 Tingkat Kehadiran: *${rate}%*\n\n`;

    if (sakitList.length > 0) {
      text += `🏥 *Siswa Sakit:*\n`;
      sakitList.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
      text += `\n`;
    }

    if (izinList.length > 0) {
      text += `✉️ *Siswa Izin:*\n`;
      izinList.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
      text += `\n`;
    }

    if (alphaList.length > 0) {
      text += `❌ *Siswa Tanpa Keterangan (Alpha):*\n`;
      alphaList.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; });
      text += `\n`;
    }

    text += `_Alhamdulillah seluruh presensi santri telah tercatat di Sistem Presensi Digital MIAS._`;
    return text;
  };

  const handleCopyWhatsAppReport = () => {
    const text = generateWhatsAppReport();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Format laporan presensi WhatsApp berhasil disalin ke clipboard!', 'success', 'Tersalin');
      }).catch(() => {
        fallbackCopyText(text);
      });
    } else {
      fallbackCopyText(text);
    }
  };

  const fallbackCopyText = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('Format laporan presensi WhatsApp berhasil disalin!', 'success', 'Tersalin');
    } catch {
      showToast('Gagal menyalin otomatis, silakan salin manual.', 'warning', 'Perhatian');
    }
    document.body.removeChild(textArea);
  };

  const handleShareWhatsApp = () => {
    const text = generateWhatsAppReport();
    const encoded = encodeURIComponent(text);
    const waUrl = `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <Sparkles size={11} /> Presensi Digital
            </span>
            {isSubmittedServer && (
              <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-600" /> Sudah Tersimpan di D1
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Presensi Siswa (Scan QR Code)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-bold mt-0.5">
            Gunakan kamera depan atau belakang untuk scan kartu ID siswa secara instan & hemat kuota database.
          </p>
        </div>

        {/* Kontrol Kelas & Tanggal */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pilih Jenjang / Kelas */}
          <div className="relative">
            <select
              value={selectedGrade}
              onChange={(e) => {
                const g = e.target.value;
                setSelectedGrade(g);
                try { localStorage.setItem('last_active_grade_attendance', g); } catch {}
              }}
              className="appearance-none bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-2.5 pr-9 font-black text-xs sm:text-sm text-slate-800 outline-none focus:border-secondary transition-all cursor-pointer"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>Kelas {g}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Pilih Tanggal */}
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-3.5 py-2 font-bold text-xs sm:text-sm text-slate-800 outline-none focus:border-secondary transition-all"
          />

          {/* Tombol Refresh */}
          <button
            onClick={loadClassAttendance}
            disabled={loading}
            className="p-2.5 rounded-2xl border-2 border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
            title="Segarkan data presensi"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Ringkasan Kehadiran Kelas (Statistik Live) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Siswa</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-black">
            <Users size={16} />
          </div>
        </div>

        <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Hadir</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-800">{stats.hadir}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
            <UserCheck size={16} />
          </div>
        </div>

        <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Sakit</p>
            <p className="text-xl sm:text-2xl font-black text-amber-800">{stats.sakit}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">
            <HeartPulse size={16} />
          </div>
        </div>

        <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Izin</p>
            <p className="text-xl sm:text-2xl font-black text-blue-800">{stats.izin}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center font-black">
            <Clock size={16} />
          </div>
        </div>

        <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">Alpha</p>
            <p className="text-xl sm:text-2xl font-black text-rose-800">{stats.alpha}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black">
            <UserX size={16} />
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border shadow-sm flex items-center justify-between transition-all ${
          stats.belumScan > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-100/70 border-slate-200'
        }`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Belum Scan</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800">{stats.belumScan}</p>
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
            stats.belumScan > 0 ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-700'
          }`}>
            <QrCode size={16} />
          </div>
        </div>
      </div>

      {/* Tab Switcher Khusus Web Mobile (< 1024px) */}
      <div className="flex lg:hidden bg-slate-200/70 p-1.5 rounded-2xl gap-1 shadow-inner">
        <button
          type="button"
          onClick={() => setMobileViewTab('scanner')}
          className={`flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
            mobileViewTab === 'scanner'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Camera size={15} className={mobileViewTab === 'scanner' ? 'text-secondary' : ''} /> Kamera Scanner
        </button>
        <button
          type="button"
          onClick={() => setMobileViewTab('list')}
          className={`flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
            mobileViewTab === 'list'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={15} className={mobileViewTab === 'list' ? 'text-emerald-700' : ''} /> Daftar Siswa ({stats.hadir}/{stats.total})
        </button>
      </div>

      {/* Main Grid: Kolom Kiri Kamera Scanner & Kolom Kanan Review & Batch Submit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= KOLOM KIRI: SCANNER KAMERA (5 Kolom) ================= */}
        <div className={`lg:col-span-5 bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-4 ${
          mobileViewTab === 'scanner' ? 'block' : 'hidden lg:block'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Camera size={16} className="text-secondary" /> Kamera Scanner
            </h3>
            <div className="flex items-center gap-1.5">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleScanFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all text-xs font-bold flex items-center gap-1"
                title="Scan dari file gambar atau foto kartu siswa"
              >
                <Upload size={14} />
                <span className="hidden sm:inline">File</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSoundEnabled((v) => !v);
                  initAudio();
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  soundEnabled ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-100'
                }`}
                title={soundEnabled ? 'Suara beep aktif' : 'Suara dimatikan'}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              <button
                type="button"
                onClick={toggleCameraFacing}
                className="p-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all text-xs font-bold flex items-center gap-1"
                title="Ganti kamera depan / belakang"
              >
                <SwitchCamera size={16} />
                <span className="hidden sm:inline">{facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
              </button>
            </div>
          </div>

          {/* Viewport Kamera Video (Kamera Responsif) */}
          <div className="relative w-full aspect-square max-h-[360px] bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center border-2 border-slate-900 shadow-inner mx-auto">
            {/* Viewport Div untuk Html5Qrcode */}
            <div id="qr-reader-viewport" className="w-full h-full object-cover" />

            {!isCameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-900/95 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                  <QrCode size={32} />
                </div>
                <div>
                  <h4 className="font-black text-base text-white">Scanner Belum Aktif</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Klik tombol di bawah untuk mengaktifkan kamera atau pilih file foto kartu ID siswa.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider hover:bg-emerald-500 active:scale-95 transition-all shadow-lg flex items-center gap-1.5"
                  >
                    <Camera size={16} /> Aktifkan Kamera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md flex items-center gap-1.5 border border-slate-700"
                  >
                    <Upload size={15} /> Upload Gambar
                  </button>
                </div>
              </div>
            )}

            {/* Overlay Notifikasi Langsung di Atas Kamera saat Scan Sukses */}
            <AnimatePresence>
              {lastScannedStudent && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: -25 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -25 }}
                  className="absolute inset-x-3 top-3 z-30 bg-emerald-800/95 text-white p-3 rounded-2xl shadow-2xl backdrop-blur-md border border-emerald-400 flex items-center gap-3 select-none"
                >
                  <img
                    src={lastScannedStudent.foto_siswa || (String(lastScannedStudent.jenis_kelamin).toLowerCase().includes('p') ? '/avatars/akhwat.webp' : '/avatars/ikhwan.webp')}
                    alt=""
                    className="w-12 h-14 rounded-xl object-cover border-2 border-white bg-white shrink-0 shadow-md"
                  />
                  <div className="min-w-0 flex-grow text-left">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-emerald-100 flex items-center gap-1 w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
                      BERHASIL SCAN • HADIR
                    </span>
                    <h4 className="font-black text-sm leading-tight mt-1 truncate text-white">
                      {lastScannedStudent.nama_siswa}
                    </h4>
                    <p className="text-[11px] text-emerald-100 font-bold mt-0.5 font-mono">
                      {lastScannedStudent.scan_time} WIB • {lastScannedStudent.nisn ? `NISN: ${lastScannedStudent.nisn}` : `ID: ${lastScannedStudent.id}`}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isCameraActive && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-1.5 rounded-full bg-slate-900/90 text-white font-black text-xs hover:bg-black transition-all backdrop-blur-xs flex items-center gap-1.5 shadow-md"
                >
                  <CameraOff size={14} /> Matikan
                </button>
                <span className="px-3 py-1.5 rounded-full bg-emerald-600/90 text-white font-black text-[10px] tracking-wider uppercase backdrop-blur-xs flex items-center gap-1 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                  {facingMode === 'environment' ? 'Belakang' : 'Depan (Selfie)'}
                </span>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Banner Notifikasi Siswa Berhasil Di-Scan */}
          <AnimatePresence>
            {lastScannedStudent && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3.5 rounded-2xl shadow-lg flex items-center gap-3 border border-emerald-400"
              >
                <div className="relative shrink-0">
                  <img
                    src={lastScannedStudent.foto_siswa || (String(lastScannedStudent.jenis_kelamin).toLowerCase().includes('p') ? '/avatars/akhwat.webp' : '/avatars/ikhwan.webp')}
                    alt=""
                    className="w-12 h-16 rounded-xl object-cover border-2 border-white shadow-md bg-white"
                  />
                  <span className="absolute -bottom-1 -right-1 bg-white text-emerald-700 rounded-full p-0.5 shadow-xs">
                    <CheckCircle2 size={13} />
                  </span>
                </div>
                <div className="min-w-0 flex-grow">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-emerald-100">
                    Berhasil Scan • Hadir
                  </span>
                  <h4 className="font-black text-sm sm:text-base leading-tight mt-0.5">
                    {lastScannedStudent.nama_siswa}
                  </h4>
                  <p className="text-xs text-emerald-100/90 font-bold">
                    Pukul {lastScannedStudent.scan_time} WIB • Kelas {selectedGrade}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Petunjuk Penggunaan */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-500 leading-relaxed">
            <p className="font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" /> Mode Kamera Depan (Selfie):
            </p>
            <p>
              Guru/piket bisa meletakkan HP di atas meja mengarah ke siswa. Saat kartu didekatkan, HP akan otomatis <b>bergetar & bunyi beep</b> sehingga guru tahu siswa berikutnya sudah boleh scan tanpa perlu menatap layar.
            </p>
          </div>
        </div>

        {/* ================= KOLOM KANAN: REVIEW DAFTAR SISWA & SUBMIT (7 Kolom) ================= */}
        <div className={`lg:col-span-7 bg-white rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm space-y-4 ${
          mobileViewTab === 'list' ? 'block' : 'hidden lg:block'
        }`}>
          {/* Header Panel Daftar Siswa & Aksi Cepat Massal */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-base text-slate-900 leading-tight">
                Daftar Presensi Kelas {selectedGrade}
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                {stats.hadir} Hadir • {stats.sakit} Sakit • {stats.izin} Izin • {stats.alpha} Alpha • {stats.belumScan} Belum Scan
              </p>
            </div>

            {/* Aksi Cepat Siswa Belum Scan */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => markAllUnscannedAs('hadir')}
                disabled={stats.belumScan === 0}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-black text-xs hover:bg-emerald-100 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                title="Tandai semua yang belum scan sebagai Hadir"
              >
                Semua Hadir
              </button>
              <button
                type="button"
                onClick={() => markAllUnscannedAs('alpha')}
                disabled={stats.belumScan === 0}
                className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 font-black text-xs hover:bg-rose-100 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                title="Tandai semua yang belum scan sebagai Alpha"
              >
                Semua Alpha
              </button>
            </div>
          </div>

          {/* Filter & Search Bar di Atas Daftar Siswa */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama santri atau NISN..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
              />
              {searchStudent && (
                <button
                  type="button"
                  onClick={() => setSearchStudent('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Status Tabs: Semua | Belum Scan | Hadir | Sakit/Izin | Alpha */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { key: 'all', label: `Semua (${stats.total})` },
                { key: 'unrecorded', label: `Belum Scan (${stats.belumScan})`, alert: stats.belumScan > 0 },
                { key: 'hadir', label: `Hadir (${stats.hadir})` },
                { key: 'sakit_izin', label: `Sakit/Izin (${stats.sakit + stats.izin})` },
                { key: 'alpha', label: `Alpha (${stats.alpha})` },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterStatus(f.key)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 ${
                    filterStatus === f.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : f.alert
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Daftar Baris Siswa Kelas (Desain 2-Tier: Nama Penuh Tanpa Truncate & Segmented Buttons) */}
          <div className="max-h-[500px] overflow-y-auto space-y-2.5 pr-1">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-14 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                {searchStudent || filterStatus !== 'all'
                  ? 'Tidak ada santri yang cocok dengan filter pencarian.'
                  : `Belum ada siswa terdaftar di kelas ${selectedGrade}.`}
              </div>
            ) : (
              filteredStudents.map((student) => {
                const rec = attendanceMap[student.id];
                const status = rec?.status || 'unrecorded';
                const isAkhwat = String(student.jenis_kelamin || '').toLowerCase().includes('p');
                const avatar = student.foto_siswa || (isAkhwat ? '/avatars/akhwat.webp' : '/avatars/ikhwan.webp');

                return (
                  <div
                    key={student.id}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                      status === 'hadir'
                        ? 'bg-emerald-50/50 border-emerald-200/80 shadow-2xs'
                        : status === 'sakit'
                        ? 'bg-amber-50/50 border-amber-200/80 shadow-2xs'
                        : status === 'izin'
                        ? 'bg-blue-50/50 border-blue-200/80 shadow-2xs'
                        : status === 'alpha'
                        ? 'bg-rose-50/50 border-rose-200/80 shadow-2xs'
                        : 'bg-white border-slate-200/70 hover:border-slate-300'
                    }`}
                  >
                    {/* Baris Atas: Foto, Nama Lengkap Santri, Info, Status Pill & Tombol ID Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <img
                          src={avatar}
                          alt=""
                          className="w-10 h-13 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0 shadow-2xs"
                        />
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-slate-900 leading-snug">
                            {student.nama_siswa}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 font-bold mt-0.5">
                            <span>NISN: {student.nisn || '-'}</span>
                            <span>•</span>
                            <span>NIS: {student.nis || '-'}</span>
                            {rec?.scan_time && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 font-black flex items-center gap-0.5">
                                  <Clock size={11} /> {rec.scan_time} WIB
                                </span>
                              </>
                            )}
                            {rec?.method === 'ketinggalan_kartu' && (
                              <span className="text-amber-700 font-black">(Lupa Kartu)</span>
                            )}
                          </div>
                          {rec?.notes && (
                            <p className="text-xs text-slate-600 font-medium italic mt-1 bg-white/80 px-2 py-0.5 rounded-lg border border-slate-200/70 inline-block">
                              "{rec.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Kanan Atas: Badge Status & Tombol Cetak ID Card */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          status === 'hadir' ? 'bg-emerald-600 text-white' :
                          status === 'sakit' ? 'bg-amber-500 text-white' :
                          status === 'izin' ? 'bg-blue-600 text-white' :
                          status === 'alpha' ? 'bg-rose-600 text-white' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {status === 'unrecorded' ? 'Belum Scan' : status}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setIdCardStudent(student);
                            setIdCardModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 bg-white transition-all shadow-2xs"
                          title={`Cetak ID Card Santri: ${student.nama_siswa}`}
                        >
                          <CreditCard size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Baris Bawah: Segmented Action Buttons */}
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setStudentStatus(student.id, student.nama_siswa, 'hadir', 'manual_wali_kelas')}
                        className={`py-1.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1 ${
                          status === 'hadir'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <Check size={12} /> Hadir
                      </button>

                      <button
                        type="button"
                        onClick={() => setNoteModal({ open: true, student, targetStatus: 'sakit', noteText: rec?.notes || '' })}
                        className={`py-1.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1 ${
                          status === 'sakit'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                        title="Tandai Sakit & Tambah Alasan"
                      >
                        <HeartPulse size={12} /> Sakit
                      </button>

                      <button
                        type="button"
                        onClick={() => setNoteModal({ open: true, student, targetStatus: 'izin', noteText: rec?.notes || '' })}
                        className={`py-1.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1 ${
                          status === 'izin'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                        title="Tandai Izin & Tambah Alasan"
                      >
                        <Clock size={12} /> Izin
                      </button>

                      <button
                        type="button"
                        onClick={() => setStudentStatus(student.id, student.nama_siswa, 'alpha')}
                        className={`py-1.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1 ${
                          status === 'alpha'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                        }`}
                      >
                        <UserX size={12} /> Alpha
                      </button>

                      {/* Tombol Lupa Kartu */}
                      <button
                        type="button"
                        onClick={() => setStudentStatus(student.id, student.nama_siswa, 'hadir', 'ketinggalan_kartu', 'Lupa bawa kartu')}
                        className={`col-span-4 sm:col-span-1 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                          rec?.method === 'ketinggalan_kartu'
                            ? 'bg-amber-700 text-white shadow-xs'
                            : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                        }`}
                        title="Tandai Hadir karena kartu santri tertinggal di rumah"
                      >
                        Lupa Kartu
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tombol Utama: Batch Submit & Kirim Laporan WA */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            {/* Tombol Simpan Presensi (Full Width, Jelas, & Tidak Terpotong) */}
            <button
              type="button"
              onClick={handleSubmitBatch}
              disabled={submitting || students.length === 0}
              className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm uppercase tracking-wider transition-all shadow-md active:scale-98 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="animate-spin" size={16} /> Menyimpan Presensi ke Database...
                </>
              ) : (
                <>
                  <Send size={16} className="text-emerald-400" /> Simpan Presensi Kelas ({selectedGrade})
                </>
              )}
            </button>

            {/* Tombol Broadcast WhatsApp (Grid 2 Kolom Seimbang) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyWhatsAppReport}
                disabled={students.length === 0}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-black text-xs transition-all active:scale-95 shadow-xs disabled:opacity-40"
                title="Salin format teks laporan untuk grup WhatsApp"
              >
                <Copy size={14} className="text-slate-500" /> Salin WA
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                disabled={students.length === 0}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs transition-all active:scale-95 shadow-sm disabled:opacity-40"
                title="Buka WhatsApp untuk kirim laporan presensi ke grup wali murid"
              >
                <MessageSquare size={14} className="text-emerald-200" /> Kirim ke WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Keterangan Presensi Siswa (Sakit / Izin) */}
      <AnimatePresence>
        {noteModal.open && noteModal.student && (
          <Modal
            onClose={() => setNoteModal({ open: false, student: null, noteText: '', targetStatus: '' })}
            title={`Keterangan ${noteModal.targetStatus.toUpperCase()} - ${noteModal.student.nama_siswa}`}
            maxWidthClass="max-w-md"
          >
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Alasan / Keterangan (Opsional):
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder={noteModal.targetStatus === 'sakit' ? 'Contoh: Demam tinggi, Sakit gigi' : 'Contoh: Acara keluarga, Keperluan mendesak'}
                  value={noteModal.noteText}
                  onChange={(e) => setNoteModal((prev) => ({ ...prev, noteText: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setStudentStatus(noteModal.student.id, noteModal.student.nama_siswa, noteModal.targetStatus, 'manual_wali_kelas', noteModal.noteText);
                      setNoteModal({ open: false, student: null, noteText: '', targetStatus: '' });
                    }
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm text-slate-800 outline-none focus:border-secondary transition-all"
                />

                {/* Pilihan Cepat Keterangan (One-Tap Chips) */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 w-full mb-0.5">
                    Pilihan Cepat:
                  </span>
                  {(noteModal.targetStatus === 'sakit'
                    ? ['Demam', 'Batuk / Pilek', 'Sakit Perut', 'Sakit Gigi', 'Istirahat Dokter']
                    : ['Acara Keluarga', 'Keperluan Mendesak', 'Pulang Kampung', 'Safar', 'Izin Orang Tua']
                  ).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setNoteModal((prev) => ({ ...prev, noteText: chip }))}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all border ${
                        noteModal.noteText === chip
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <ModalFooter>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModal({ open: false, student: null, noteText: '', targetStatus: '' })}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudentStatus(noteModal.student.id, noteModal.student.nama_siswa, noteModal.targetStatus, 'manual_wali_kelas', noteModal.noteText);
                    setNoteModal({ open: false, student: null, noteText: '', targetStatus: '' });
                  }}
                  className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-all shadow-md"
                >
                  Simpan Status
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Modal Generator ID Card Siswa */}
      <StudentIdCardModal
        isOpen={idCardModalOpen}
        onClose={() => setIdCardModalOpen(false)}
        initialStudent={idCardStudent}
        students={students}
        activeGrade={selectedGrade}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <ToastNotification
            toast={toast}
            onClose={() => setToast({ show: false, message: '', type: 'success', title: '' })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
