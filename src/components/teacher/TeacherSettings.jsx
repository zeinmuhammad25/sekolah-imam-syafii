import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ToastNotification } from './ModalKit';

const fieldClass = 'w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-secondary transition-all';

export default function TeacherSettings() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', title: '' });

  const showToast = (message, type = 'success', title = '') => {
    setToast({ show: true, message, type, title });
  };

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      showToast('Semua kolom password wajib diisi.', 'warning', 'Form Belum Lengkap');
      return;
    }
    if (form.newPassword.length < 6) {
      showToast('Password baru minimal 6 karakter.', 'warning', 'Password Terlalu Pendek');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      showToast('Konfirmasi password baru tidak cocok. Periksa kembali ketikan Anda.', 'error', 'Tidak Cocok');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Password Anda berhasil diganti! Silakan gunakan password ini pada sesi login berikutnya.', 'success', 'Password Diperbarui');
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        showToast(data.error || 'Password lama salah atau gagal mengganti password.', 'error', 'Gagal Ganti Password');
      }
    } catch {
      showToast('Gagal terhubung ke server. Periksa koneksi internet dan coba lagi.', 'error', 'Koneksi Terputus');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      {/* Toast Notification Top Center */}
      <AnimatePresence>
        {toast?.show && toast?.message && (
          <ToastNotification
            toast={toast}
            onClose={() => setToast({ show: false, message: '', type: 'success', title: '' })}
          />
        )}
      </AnimatePresence>

      <h2 className="text-2xl font-black text-slate-900 mb-1">Pengaturan Akun</h2>
      <p className="text-slate-400 font-medium mb-8 text-sm">Kelola keamanan dan kata sandi akun panel guru.</p>

      <div className="bg-white border-2 border-slate-100 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-inner">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm">Ganti Password Pribadi</h3>
            <p className="text-slate-400 text-xs font-medium">Perbarui kata sandi untuk akun login Anda saat ini.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Password Lama
            </label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={set('currentPassword')}
              className={fieldClass}
              placeholder="Masukkan password saat ini"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Password Baru
            </label>
            <input
              type="password"
              value={form.newPassword}
              onChange={set('newPassword')}
              className={fieldClass}
              placeholder="Minimal 6 karakter"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              className={fieldClass}
              placeholder="Ulangi password baru"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-slate-900 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-black active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 mt-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan…</> : 'Simpan Password Baru'}
          </button>
        </form>
      </div>
    </div>
  );
}
