import React, { useState } from 'react';
import { X, Send, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitPPDBForm } from '../services/gsheet';

export default function PPDBForm({ isOpen, onClose }) {
  const [step, setStep] = useState('form'); // form, loading, success
  const [formData, setFormData] = useState({
    parent_name: '',
    student_name: '',
    phone: '',
    email: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStep('loading');
    
    const result = await submitPPDBForm(formData);
    
    if (result.success) {
      setStep('success');
    } else {
      alert('Terjadi kesalahan. Silakan coba lagi.');
      setStep('form');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-primary/40 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[2.5rem] w-full max-w-lg relative z-10 shadow-2xl overflow-hidden"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={24} />
        </button>

        <div className="p-8 md:p-12">
          {step === 'form' && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-black text-primary mb-2">Pendaftaran PPDB</h2>
                <p className="text-slate-500 font-medium">Lengkapi formulir untuk memulai pendaftaran anak Anda.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nama Lengkap Orang Tua</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-secondary focus:bg-white transition-all outline-none"
                    placeholder="Contoh: Ahmad Reza"
                    value={formData.parent_name}
                    onChange={(e) => setFormData({...formData, parent_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nama Calon Siswa</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-secondary focus:bg-white transition-all outline-none"
                    placeholder="Nama lengkap anak"
                    value={formData.student_name}
                    onChange={(e) => setFormData({...formData, student_name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">No. WhatsApp</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-secondary focus:bg-white transition-all outline-none"
                      placeholder="0812..."
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                    <input 
                      required
                      type="email" 
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-secondary focus:bg-white transition-all outline-none"
                      placeholder="email@anda.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-primary/20 group"
                >
                  Kirim Pendaftaran <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
              </form>
            </>
          )}

          {step === 'loading' && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-lg font-bold text-slate-700">Mengirim data...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="py-12 text-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="text-3xl font-black text-primary mb-4">Berhasil Terkirim!</h2>
              <p className="text-slate-500 mb-8 max-w-xs mx-auto">Terima kasih telah mendaftar. Tim administrasi kami akan segera menghubungi Anda melalui WhatsApp.</p>
              <button 
                onClick={onClose}
                className="w-full bg-slate-100 text-slate-900 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
