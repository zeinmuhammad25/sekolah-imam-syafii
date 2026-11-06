import React, { useState } from 'react';
import { Lock, User, ArrowRight, Home, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function TeacherLoginGate({ onSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Username wajib diisi.');
      return;
    }
    if (!password) {
      setError('Kata sandi wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });

      // Fallback lokal development jika offline
      if (import.meta.env.DEV && (!res.ok || res.status === 404)) {
        if (password === 'admin123' || password === 'admin') {
          const userObj = { username: 'admin', name: 'Administrator', role: 'superadmin', permissions: '["all"]' };
          localStorage.setItem('isTeacherAuthenticated', 'true');
          localStorage.setItem('teacherUser', JSON.stringify(userObj));
          sessionStorage.setItem('isTeacherAuthenticated', 'true');
          sessionStorage.setItem('teacherUser', JSON.stringify(userObj));
          if (onSuccess) onSuccess(userObj);
          return;
        }
      }

      const data = await res.json();
      if (data.success) {
        const userObj = data.user || {
          username: username.trim().toLowerCase(),
          name: data.name || username,
          role: 'guru',
          permissions: '["all"]',
        };
        localStorage.setItem('isTeacherAuthenticated', 'true');
        localStorage.setItem('teacherUser', JSON.stringify(userObj));
        sessionStorage.setItem('isTeacherAuthenticated', 'true');
        sessionStorage.setItem('teacherUser', JSON.stringify(userObj));
        if (onSuccess) onSuccess(userObj);
      } else {
        setError(data.error || 'Username atau kata sandi tidak cocok.');
      }
    } catch {
      if (import.meta.env.DEV && (password === 'admin123' || password === 'admin')) {
        const userObj = { username: 'admin', name: 'Administrator', role: 'superadmin', permissions: '["all"]' };
        localStorage.setItem('isTeacherAuthenticated', 'true');
        localStorage.setItem('teacherUser', JSON.stringify(userObj));
        sessionStorage.setItem('isTeacherAuthenticated', 'true');
        sessionStorage.setItem('teacherUser', JSON.stringify(userObj));
        if (onSuccess) onSuccess(userObj);
        return;
      }
      setError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-secondary selection:text-white">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-forest/20 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md bg-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl border border-white/10 relative z-10"
      >
        {/* Brand Icon & Heading */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-secondary to-forest rounded-3xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4 shadow-xl shadow-secondary/25">
            IS
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-secondary text-[10px] font-black tracking-widest uppercase mb-2">
            Portal Akses Guru & Staf
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Masuk ke Panel Guru
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            Halaman ini terproteksi. Silakan masukkan akun login Anda untuk langsung membuka fitur ini.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 p-3.5 mb-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span className="leading-tight">{error}</span>
          </motion.div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5 ml-1">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username Anda"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-secondary focus:bg-white transition-all"
              />
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5 ml-1">
              Kata Sandi
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-secondary focus:bg-white transition-all"
              />
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 bg-secondary hover:bg-forest text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-secondary/25 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Memverifikasi Akun...</span>
              </>
            ) : (
              <>
                <span>Masuk & Lanjutkan</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Navigasi Batal / Kembali ke Beranda Sekolah */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-secondary transition-colors"
          >
            <Home size={14} />
            <span>Kembali ke Beranda Website Sekolah</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
