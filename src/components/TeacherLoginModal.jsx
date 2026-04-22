import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TeacherLoginModal({ isOpen, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Kata sandi wajib diisi');
      return;
    }

    if (password === 'admin') {
      sessionStorage.setItem('isTeacherAuthenticated', 'true');
      onClose();
      navigate('/dashboard-guru');
    } else {
      setError('Kata sandi salah. Silakan hubungi Admin Sekolah');
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
            className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-12 relative shadow-3xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-primary transition-colors"
            >
              <X size={20} />
            </button>

            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-8 shadow-inner">
              <Lock size={32} />
            </div>

            <h2 className="text-2xl font-black text-rose-600 mb-2">Hanya Untuk Administrasi Guru</h2>
            <p className="text-slate-500 text-sm font-medium mb-8">Silakan masukkan kata sandi akses internal untuk melanjutkan ke dashboard soal.</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Kata Sandi Internal"
                  className={`w-full bg-slate-50 border-2 rounded-2xl p-5 text-center font-black tracking-widest outline-none transition-all ${
                    error ? 'border-rose-100 ring-4 ring-rose-50' : 'border-slate-50 focus:border-amber-400'
                  }`}
                />
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 mt-3 text-rose-500 font-bold text-xs"
                  >
                    <AlertCircle size={14} />
                    {error}
                  </motion.div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black text-xs hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl mt-4"
              >
                MASUK DASHBOARD <ArrowRight size={18} />
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Akses Terbatas • Security v1.1</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
