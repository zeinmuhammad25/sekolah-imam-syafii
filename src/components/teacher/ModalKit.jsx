import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Loader2,
  ImageOff,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Trash2,
  Check,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';

// Modal shell (header sticky, body scroll, footer sticky) — dipakai semua panel CRUD guru.
// closeOnBackdrop: klik area gelap di luar kartu menutup popup (default ya, seperti sebelumnya).
// expanded/onToggleExpand: opsional — kalau diisi, muncul tombol perbesar/perkecil di header.
export function Modal({ title, onClose, children, maxWidthClass = 'max-w-lg', closeOnBackdrop = true, expanded = false, onToggleExpand, expandedWidthClass = 'max-w-6xl' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <motion.div
        initial={{ y: 30, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 30, scale: 0.98, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className={`bg-white w-full ${expanded ? expandedWidthClass : maxWidthClass} rounded-2xl sm:rounded-3xl flex flex-col ${expanded ? 'max-h-[96vh]' : 'max-h-[92vh] sm:max-h-[88vh]'} overflow-hidden shadow-2xl transition-[max-width] duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 md:px-8 py-3.5 sm:py-5 border-b border-slate-100">
          <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 truncate pr-2 min-w-0">{title}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleExpand && (
              <button
                onClick={onToggleExpand}
                className="p-1.5 sm:p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                title={expanded ? 'Perkecil' : 'Perbesar'}
              >
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 sm:p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-700 transition-colors" aria-label="Tutup"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </motion.div>
    </motion.div>
  );
}

export function ModalFooter({ children }) {
  return <div className="shrink-0 px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-t border-slate-100 bg-white">{children}</div>;
}

export function ConfirmDialog({
  open,
  isOpen,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  loading = false,
  isLoading = false,
  type = 'danger', // 'danger' | 'warning' | 'info' | 'primary'
  hideIcon = false,
  onCancel,
  onConfirm
}) {
  const isDialogActive = open !== undefined ? open : isOpen;
  if (isDialogActive === false || isDialogActive === null) return null;

  const resolvedConfirmLabel = confirmLabel || confirmText || 'Ya, Lanjutkan';
  const resolvedCancelLabel = cancelLabel || cancelText || 'Batal';
  const resolvedLoading = loading || isLoading;

  const isDanger = type === 'danger';
  const isWarning = type === 'warning';
  const isInfo = type === 'info';

  const iconBg = isDanger
    ? 'bg-rose-50 text-rose-500'
    : isWarning
    ? 'bg-amber-50 text-amber-500'
    : isInfo
    ? 'bg-sky-50 text-sky-500'
    : 'bg-emerald-50 text-secondary';

  const confirmBtnBg = isDanger
    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
    : isWarning
    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
    : isInfo
    ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
    : 'bg-secondary hover:brightness-95 text-white shadow-secondary/20';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 340 }}
        className="bg-white w-full max-w-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`w-14 h-14 sm:w-16 sm:h-16 ${iconBg} rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-sm`}>
          {isDanger ? (
            <AlertTriangle size={28} />
          ) : isWarning ? (
            <AlertCircle size={28} />
          ) : isInfo ? (
            <Info size={28} />
          ) : (
            <CheckCircle2 size={28} />
          )}
        </div>
        <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 leading-tight">{title}</h3>
        <div className="text-slate-500 font-medium text-xs sm:text-sm mb-6 leading-relaxed whitespace-pre-line text-center">{message}</div>
        <div className="flex gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={resolvedLoading}
            className="flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-100 text-slate-600 font-black text-xs sm:text-sm hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={resolvedLoading}
            className={`flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl ${confirmBtnBg} font-black text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50`}
          >
            {resolvedLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : hideIcon ? null : isDanger ? (
              <Trash2 size={16} />
            ) : (
              <Check size={16} />
            )}
            {resolvedConfirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Toast Notifikasi Mengambang di Tengah Atas (Modern Top-Center Toast)
// Otomatis hilang: Sukses = 3 detik, Error = 6 detik, Warning = 4.5 detik.
// Mendukung Pause on Hover (jeda timer saat disorot kursor mouse).
export function ToastNotification({ toast, onClose, duration }) {
  if (!toast || (toast.show !== undefined && !toast.show) || !toast.message) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';

  // Opsi A: Sukses 3 detik, Error 6 detik, Warning 4.5 detik
  const defaultDuration = isSuccess ? 3000 : isError ? 6000 : 4500;
  const totalDuration = typeof toast.duration === 'number'
    ? toast.duration
    : typeof duration === 'number'
    ? duration
    : defaultDuration;

  const [isHovered, setIsHovered] = useState(false);
  const [remainingTime, setRemainingTime] = useState(totalDuration);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);

  // Reset timer saat toast berganti pesan/tipe
  useEffect(() => {
    setRemainingTime(totalDuration);
    startTimeRef.current = Date.now();
  }, [toast?.message, toast?.type, totalDuration]);

  // Efek penanganan timer mundur dengan jeda saat hover
  useEffect(() => {
    if (totalDuration <= 0 || !onClose) return;

    if (isHovered) {
      // Jeda timer: hitung sisa waktu
      const elapsed = Date.now() - startTimeRef.current;
      setRemainingTime((prev) => Math.max(0, prev - elapsed));
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      // Lanjutkan timer dengan sisa waktu yang ada
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        onClose();
      }, remainingTime);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHovered, remainingTime, totalDuration, onClose, toast?.message]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -25, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-2rem)] max-w-md pointer-events-auto select-none"
    >
      <div
        className={`relative overflow-hidden flex items-start gap-3 rounded-2xl p-4 shadow-2xl border backdrop-blur-md transition-shadow ${
          isSuccess
            ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950 shadow-emerald-900/10'
            : isError
            ? 'bg-rose-50/95 border-rose-200 text-rose-950 shadow-rose-900/10'
            : isWarning
            ? 'bg-amber-50/95 border-amber-200 text-amber-950 shadow-amber-900/10'
            : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-900/10'
        }`}
      >
        <div
          className={`shrink-0 mt-0.5 p-1.5 rounded-xl ${
            isSuccess
              ? 'bg-emerald-500 text-white'
              : isError
              ? 'bg-rose-500 text-white'
              : isWarning
              ? 'bg-amber-500 text-white'
              : 'bg-secondary text-white'
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 size={18} />
          ) : isError ? (
            <AlertTriangle size={18} />
          ) : isWarning ? (
            <AlertCircle size={18} />
          ) : (
            <Info size={18} />
          )}
        </div>

        <div className="min-w-0 flex-grow">
          <div className="flex items-center gap-2 mb-0.5">
            {toast.title && <h5 className="font-black text-xs uppercase tracking-wider">{toast.title}</h5>}
            {isHovered && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-black/10 text-slate-600">
                Dijeda
              </span>
            )}
          </div>
          <p className="text-xs font-semibold leading-relaxed whitespace-pre-line">{toast.message}</p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors"
            title="Tutup Sekarang"
          >
            <X size={16} />
          </button>
        )}

        {/* Indikator Garis Durasi Waktu (Visual Countdown Bar) */}
        {totalDuration > 0 && (
          <motion.div
            key={toast?.message}
            initial={{ width: '100%' }}
            animate={{ width: isHovered ? undefined : '0%' }}
            transition={{
              duration: remainingTime / 1000,
              ease: 'linear',
            }}
            className={`absolute bottom-0 left-0 h-1 ${
              isSuccess
                ? 'bg-emerald-500/50'
                : isError
                ? 'bg-rose-500/50'
                : isWarning
                ? 'bg-amber-500/50'
                : 'bg-secondary/50'
            }`}
          />
        )}
      </div>
    </motion.div>
  );
}

export function Thumb({ src }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><ImageOff size={18} /></div>;
  return <img src={src} onError={() => setErr(true)} className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl object-cover bg-slate-100 shrink-0" alt="" />;
}

// Input generik berdasar deskriptor field { name, label, type, options, allowCustom, placeholder, rows }.
// dense: versi lebih ringkas (padding/label lebih kecil) — dipakai form panjang seperti Data Siswa,
// tidak memengaruhi panel CRUD lain yang tetap pakai ukuran default.
export function Field({ field, value, uploading, onChange, onFile, dense = false }) {
  const base = dense
    ? 'w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-2 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-secondary transition-all'
    : 'w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 sm:p-3.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-secondary transition-all';
  const label = (
    <label className={`block font-black text-slate-500 uppercase tracking-wider ${dense ? 'text-[10px] mb-1' : 'text-[11px] sm:text-xs mb-1.5'}`}>{field.label}</label>
  );

  // Field dikunci (nilai tetap, tidak bisa diubah TU) — mis. Agama = Islam untuk sekolah Islam.
  if (field.locked) {
    return (
      <div>{label}
        <input type="text" value={field.lockedValue ?? value} disabled className={`${base} bg-slate-100 text-slate-400 cursor-not-allowed`} />
      </div>
    );
  }

  // Field angka murni dengan panjang tetap (NIK/NISN/No. KK) — cegah huruf & batasi jumlah digit saat mengetik.
  if (field.numeric) {
    return (
      <div>{label}
        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, field.maxLength || undefined))}
          className={base}
        />
      </div>
    );
  }

  if (field.type === 'image') {
    return (
      <div>
        {label}
        <div className="flex items-center gap-3">
          <Thumb src={value} />
          <label className="flex-grow cursor-pointer">
            <div className={`${base} flex items-center justify-center gap-2 text-slate-500 hover:border-secondary`}>
              {uploading ? <><Loader2 className="animate-spin" size={16} /> Mengunggah…</> : <><Upload size={16} /> {value ? 'Ganti foto' : 'Pilih foto'}</>}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files[0])} disabled={uploading} />
          </label>
        </div>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return <div>{label}<textarea rows={field.rows || 4} value={value} onChange={(e) => onChange(e.target.value)} className={base} /></div>;
  }

  if (field.type === 'select' && !field.allowCustom) {
    return (
      <div>{label}
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">— pilih —</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === 'select' && field.allowCustom) {
    const listId = `dl-${field.name}`;
    return (
      <div>{label}
        <input list={listId} value={value} onChange={(e) => onChange(e.target.value)} className={base} placeholder="pilih atau ketik baru" />
        <datalist id={listId}>{field.options.map((o) => <option key={o} value={o} />)}</datalist>
      </div>
    );
  }

  return <div>{label}<input type={field.type === 'date' ? 'date' : 'text'} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={base} /></div>;
}
