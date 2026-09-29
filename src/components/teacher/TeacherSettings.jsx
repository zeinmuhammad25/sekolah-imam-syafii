import React, { useState } from 'react';
import { KeyRound, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const fieldClass = 'w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-secondary transition-all';

export default function TeacherSettings() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (name) => (e) => { setForm((f) => ({ ...f, [name]: e.target.value })); setError(''); setSuccess(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) { setError('Semua field wajib diisi'); return; }
    if (form.newPassword.length < 8) { setError('Password baru minimal 8 karakter'); return; }
    if (form.newPassword !== form.confirmPassword) { setError('Konfirmasi password baru tidak cocok'); return; }

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
        setSuccess(true);
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setError(data.error || 'Gagal mengganti password');
      }
    } catch {
      setError('Gagal terhubung ke server. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-black text-slate-900 mb-1">Pengaturan</h2>
      <p className="text-slate-400 font-medium mb-8 text-sm">Kelola akses akun panel guru.</p>

      <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm">Ganti Password</h3>
            <p className="text-slate-400 text-xs font-medium">Akun bersama panel guru — kata sandi berlaku untuk semua guru.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Password Lama</label>
            <input type="password" value={form.currentPassword} onChange={set('currentPassword')} className={fieldClass} placeholder="Password saat ini" autoComplete="current-password" />
          </div>
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Password Baru</label>
            <input type="password" value={form.newPassword} onChange={set('newPassword')} className={fieldClass} placeholder="Minimal 8 karakter" autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Konfirmasi Password Baru</label>
            <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} className={fieldClass} placeholder="Ulangi password baru" autoComplete="new-password" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-500 font-bold text-xs bg-rose-50 rounded-xl p-3">
              <AlertTriangle size={15} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 rounded-xl p-3">
              <CheckCircle2 size={15} /> Password berhasil diganti.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan…</> : 'Simpan Password Baru'}
          </button>
        </form>
      </div>
    </div>
  );
}
