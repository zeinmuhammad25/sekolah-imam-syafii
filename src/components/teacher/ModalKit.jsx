import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, ImageOff, AlertTriangle, Trash2, Maximize2, Minimize2 } from 'lucide-react';

// Modal shell (header sticky, body scroll, footer sticky) — dipakai semua panel CRUD guru.
// closeOnBackdrop: klik area gelap di luar kartu menutup popup (default ya, seperti sebelumnya).
// expanded/onToggleExpand: opsional — kalau diisi, muncul tombol perbesar/perkecil di header.
export function Modal({ title, onClose, children, maxWidthClass = 'max-w-lg', closeOnBackdrop = true, expanded = false, onToggleExpand, expandedWidthClass = 'max-w-6xl' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <motion.div
        initial={{ y: 40, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 40, scale: 0.98, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className={`bg-white w-full ${expanded ? expandedWidthClass : maxWidthClass} rounded-3xl flex flex-col ${expanded ? 'max-h-[95vh]' : 'max-h-[88vh]'} overflow-hidden shadow-2xl transition-[max-width] duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-6 md:px-8 py-5 border-b border-slate-100">
          <h3 className="text-lg md:text-xl font-black text-slate-900">{title}</h3>
          <div className="flex items-center gap-1.5">
            {onToggleExpand && (
              <button
                onClick={onToggleExpand}
                className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                title={expanded ? 'Perkecil' : 'Perbesar'}
              >
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </motion.div>
    </motion.div>
  );
}

export function ModalFooter({ children }) {
  return <div className="shrink-0 px-6 md:px-8 py-4 border-t border-slate-100 bg-white">{children}</div>;
}

export function ConfirmDialog({ title, message, confirmLabel, loading, onCancel, onConfirm }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[160] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="bg-white w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-5">
          <AlertTriangle size={30} />
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-500 font-medium text-sm mb-7 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all disabled:opacity-50">Batal</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white font-black text-sm hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Thumb({ src }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><ImageOff size={20} /></div>;
  return <img src={src} onError={() => setErr(true)} className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0" alt="" />;
}

// Input generik berdasar deskriptor field { name, label, type, options, allowCustom, placeholder, rows }.
// dense: versi lebih ringkas (padding/label lebih kecil) — dipakai form panjang seperti Data Siswa,
// tidak memengaruhi panel CRUD lain yang tetap pakai ukuran default.
export function Field({ field, value, uploading, onChange, onFile, dense = false }) {
  const base = dense
    ? 'w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-2 text-sm font-semibold text-slate-800 outline-none focus:border-secondary transition-all'
    : 'w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3.5 font-bold text-slate-800 outline-none focus:border-secondary transition-all';
  const label = (
    <label className={`block font-black text-slate-500 uppercase tracking-wider ${dense ? 'text-[10px] mb-1' : 'text-xs mb-1.5'}`}>{field.label}</label>
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
