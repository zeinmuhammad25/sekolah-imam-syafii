import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TeacherLoginModal({ isOpen, onClose }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Username wajib diisi');
      return;
    }

    if (!password) {
      setError('Kata sandi wajib diisi');
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

      // Jika di dev mode lokal (mis. npm run dev biasa tanpa wrangler backend), loloskan admin123
      if (import.meta.env.DEV && (!res.ok || res.status === 404)) {
        if (password === 'admin123' || password === 'admin') {
          sessionStorage.setItem('isTeacherAuthenticated', 'true');
          sessionStorage.setItem('teacherUser', JSON.stringify({ username: 'admin', name: 'Administrator', role: 'superadmin', permissions: '["all"]' }));
          onClose();
          navigate('/dashboard-guru');
          return;
        }
      }

      const data = await res.json();
      if (data.success) {
        const userObj = data.user || { username, name: data.name || username, role: 'guru', permissions: '["all"]' };
        sessionStorage.setItem('isTeacherAuthenticated', 'true');
        sessionStorage.setItem('teacherUser', JSON.stringify(userObj));
        localStorage.setItem('isTeacherAuthenticated', 'true');
        localStorage.setItem('teacherUser', JSON.stringify(userObj));
        onClose();
        navigate('/dashboard-guru');
      } else {
        setError(data.error || 'Username atau kata sandi salah');
      }
    } catch (err) {
      if (import.meta.env.DEV && (password === 'admin123' || password === 'admin')) {
        sessionStorage.setItem('isTeacherAuthenticated', 'true');
        sessionStorage.setItem('teacherUser', JSON.stringify({ username: 'admin', name: 'Administrator', role: 'superadmin', permissions: '["all"]' }));
        onClose();
        navigate('/dashboard-guru');
        return;
      }
      setError('Gagal terhubung ke server. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-5"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 relative shadow-3xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-primary transition-colors"
            >
              <X size={20} />
            </button>

            <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-6 shadow-inner">
              <Lock size={28} />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-1.5">Portal Guru & Staf</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-6">
              Masuk dengan akun terdaftar untuk mengakses dashboard.
            </p>

            <form onSubmit={handleLogin} className="space-y-3.5 text-left">
              <div>
                <label className="block text-[11px] font-black text-slate-600 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  placeholder="Contoh: admin / ustadz_ahmad"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 mb-1">
                  Kata Sandi
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className={`w-full bg-slate-50 border-2 rounded-2xl p-3.5 text-xs sm:text-sm font-bold text-slate-800 outline-none transition-all ${
                    error ? 'border-rose-200 ring-2 ring-rose-50' : 'border-slate-100 focus:border-secondary'
                  }`}
                />
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs border border-rose-100"
                >
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-xs sm:text-sm hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 mt-5 disabled:opacity-50"
              >
                {loading ? 'MEMERIKSA...' : <>MASUK DASHBOARD <ArrowRight size={16} /></>}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Akses Terproteksi • RBAC Multi User
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
