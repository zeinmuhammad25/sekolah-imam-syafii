import React, { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  Menu,
  X,
  Settings,
  Bell,
  User,
  ChevronRight,
  Image,
  Users,
  Newspaper
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function TeacherLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Dashboard Utama', icon: LayoutDashboard, path: '/dashboard-guru' },
    { name: 'Dashboard Soal', icon: BookOpen, path: '/dashboard-guru/soal' },
    { name: 'Galeri Siswa', icon: Image, path: '/dashboard-guru/galeri' },
    { name: 'Tim Pengajar', icon: Users, path: '/dashboard-guru/pengajar' },
    { name: 'Warta Terbaru', icon: Newspaper, path: '/dashboard-guru/warta' },
    { name: 'Pengaturan', icon: Settings, path: '/dashboard-guru/settings' },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem('isTeacherAuthenticated');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-slate-950 text-white flex-col border-r border-white/5">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-secondary/20">IS</div>
            <div>
              <h1 className="font-black text-sm leading-tight">GURU PANEL</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">SD Imam Syafii</p>
            </div>
          </div>
        </div>

        <nav className="flex-grow px-4 space-y-1">
          <p className="text-[10px] uppercase font-black text-slate-600 tracking-[0.2em] mb-4 px-4">Menu Utama</p>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group ${
                  isActive 
                  ? 'bg-secondary text-white shadow-xl shadow-secondary/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-secondary transition-colors'} />
                  {item.name}
                </div>
                {isActive && <ChevronRight size={14} />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-white/5 rounded-3xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold border-2 border-white/10 overflow-hidden">
                <User size={20} />
              </div>
              <div>
                <p className="text-xs font-black">Admin Sekolah</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Guru Pengajar</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-black hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={14} /> Keluar Panel
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-slate-950 text-white p-4 flex items-center justify-between sticky top-0 z-[100]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center text-white font-black text-xs">IS</div>
          <span className="font-black text-xs tracking-widest uppercase">Guru Panel</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white/5 rounded-lg"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '-100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '-100%' }}
            className="fixed inset-0 z-[90] bg-slate-950 pt-20 flex flex-col md:hidden"
          >
            <nav className="p-6 space-y-2">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-4 px-6 py-5 rounded-2xl font-black text-base transition-all ${
                      isActive ? 'bg-secondary text-white' : 'text-slate-400'
                    }`}
                  >
                    <item.icon size={22} />
                    {item.name}
                  </Link>
                );
              })}
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl font-black text-base text-rose-500"
              >
                <LogOut size={22} /> Keluar Panel
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <main className="flex-grow flex flex-col min-h-0 pt-0 md:pt-0">
        {/* Top Header Bar (PC) */}
        <header className="hidden md:flex bg-white h-20 items-center justify-between px-10 border-b border-slate-100 sticky top-0 z-40">
           <div className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">
             Panel Administrasi &bull; {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
           </div>
           <div className="flex items-center gap-6">
             <button className="p-2 text-slate-300 hover:text-secondary transition-colors relative">
               <Bell size={20} />
               <span className="absolute top-1 right-1 w-2 h-2 bg-secondary rounded-full border-2 border-white"></span>
             </button>
             <div className="h-8 w-px bg-slate-100"></div>
             <div className="flex items-center gap-3">
               <div className="text-right">
                 <p className="text-xs font-black text-slate-900">Admin Sekolah</p>
                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Super Admin</p>
               </div>
               <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 border border-slate-200">
                 <User size={20} />
               </div>
             </div>
           </div>
        </header>

        <div className="p-6 md:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
