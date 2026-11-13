import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronDown,
  Image,
  Users,
  Newspaper,
  Youtube,
  Contact,
  FileBarChart2,
  Award,
  BookMarked,
  GraduationCap,
  Globe,
  CalendarCheck,
  Clock,
  ClipboardCheck,
  SlidersHorizontal,
  KeyRound,
  ShieldAlert,
  ArrowLeft,
  QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function TeacherLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  // Pengguna aktif saat ini
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('teacherUser') || sessionStorage.getItem('teacherUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Re-auth in-place handler: perbarui sesi tanpa reload halaman
  const handleReauthSubmit = async (e) => {
    e?.preventDefault();
    if (!reauthPassword) {
      setReauthError('Masukkan password Anda');
      return;
    }
    setReauthLoading(true);
    setReauthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser?.username || 'admin',
          password: reauthPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsSessionExpired(false);
        setIsReauthModalOpen(false);
        setReauthPassword('');
        if (data.user) {
          setCurrentUser(data.user);
          sessionStorage.setItem('teacherUser', JSON.stringify(data.user));
          localStorage.setItem('teacherUser', JSON.stringify(data.user));
        }
      } else {
        setReauthError(data.error || 'Password salah');
      }
    } catch {
      setReauthError('Gagal menghubungi server. Periksa koneksi internet.');
    } finally {
      setReauthLoading(false);
    }
  };

  // Sinkronisasi data user aktif & Silent Keepalive dari backend
  useEffect(() => {
    const checkAuth = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.loggedIn) {
          // Ambil user dari payload atau fallback ke user yang sudah tersimpan di storage/state
          const currentStored = currentUser || (() => {
            try { return JSON.parse(localStorage.getItem('teacherUser') || sessionStorage.getItem('teacherUser')); } catch { return null; }
          })();

          const fallbackUsername = data.username || currentStored?.username || (data.name === 'Admin Sekolah' ? 'admin' : '');
          const isSuper = fallbackUsername === 'admin' || data.role === 'superadmin' || currentStored?.role === 'superadmin';

          const userObj = data.user || {
            id: data.userId || currentStored?.id,
            username: fallbackUsername || currentStored?.username,
            name: data.name || currentStored?.name,
            role: isSuper ? 'superadmin' : (data.role || currentStored?.role || 'guru'),
            permissions: isSuper ? '["all"]' : (data.permissions || currentStored?.permissions || '["all"]')
          };
          setCurrentUser(userObj);
          sessionStorage.setItem('teacherUser', JSON.stringify(userObj));
          localStorage.setItem('teacherUser', JSON.stringify(userObj));
          setIsSessionExpired(false);
        } else if (res.status === 401 || data.loggedIn === false) {
          setIsSessionExpired(true);
        }
      } catch {
        // Abaikan offline / error sementara
      }
    };

    checkAuth();
    const interval = setInterval(checkAuth, 10 * 60 * 1000); // Heartbeat keepalive tiap 10 menit
    const onFocus = () => checkAuth();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Helper cek izin akses
  const hasPermission = (permKey) => {
    if (!currentUser) return true; // toleran saat sesi dimuat
    if (currentUser.role === 'superadmin') return true;

    let perms = [];
    if (Array.isArray(currentUser.permissions)) {
      perms = currentUser.permissions;
    } else if (typeof currentUser.permissions === 'string') {
      try {
        perms = JSON.parse(currentUser.permissions);
      } catch {
        perms = [];
      }
    }
    if (perms.includes('all')) return true;
    return perms.includes(permKey);
  };

  // Struktur navigasi pohon (Tree Hierarchy) dengan hak akses RBAC
  const rawNavigationConfig = useMemo(() => [
    {
      type: 'item',
      id: 'dashboard',
      name: 'Dashboard Utama',
      icon: LayoutDashboard,
      path: '/dashboard-guru',
      perm: 'dashboard',
    },
    {
      type: 'group',
      id: 'akademik',
      name: 'Akademik & Siswa',
      icon: GraduationCap,
      items: [
        { name: 'Data Siswa (KK)', icon: Contact, path: '/dashboard-guru/siswa', perm: 'siswa' },
        { name: 'Mata Pelajaran', icon: BookMarked, path: '/dashboard-guru/mapel', perm: 'mapel' },
        { name: 'Bank Soal', icon: BookOpen, path: '/dashboard-guru/soal', perm: 'soal' },
        { name: 'E-Raport', icon: FileBarChart2, path: '/dashboard-guru/eraport', perm: 'eraport' },
        { name: 'Publikasi Nilai', icon: Award, path: '/dashboard-guru/nilai', perm: 'nilai' },
      ],
    },
    {
      type: 'group',
      id: 'presensi_siswa',
      name: 'Presensi Siswa',
      icon: QrCode,
      items: [
        { name: 'Scan QR Presensi', icon: QrCode, path: '/dashboard-guru/presensi-siswa', perm: 'presensi_siswa' },
        { name: 'Rekap Presensi Siswa', icon: ClipboardCheck, path: '/dashboard-guru/presensi-siswa/rekap', perm: 'presensi_siswa_rekap' },
      ],
    },
    {
      type: 'group',
      id: 'absensi',
      name: 'Absensi Guru',
      icon: CalendarCheck,
      items: [
        { name: 'Absen Harian', icon: Clock, path: '/dashboard-guru/absensi', perm: 'absensi_harian' },
        { name: 'Data Guru & Jadwal', icon: Users, path: '/dashboard-guru/absensi-guru', perm: 'absensi_guru' },
        { name: 'Rekap Presensi', icon: ClipboardCheck, path: '/dashboard-guru/absensi-rekap', perm: 'absensi_rekap' },
        { name: 'Pengaturan Presensi', icon: SlidersHorizontal, path: '/dashboard-guru/absensi-settings', perm: 'absensi_settings' },
      ],
    },
    {
      type: 'group',
      id: 'konten',
      name: 'Konten Web Sekolah',
      icon: Globe,
      items: [
        { name: 'Galeri Siswa', icon: Image, path: '/dashboard-guru/galeri', perm: 'galeri' },
        { name: 'Tim Pengajar', icon: Users, path: '/dashboard-guru/pengajar', perm: 'pengajar' },
        { name: 'Warta Terbaru', icon: Newspaper, path: '/dashboard-guru/warta', perm: 'warta' },
        { name: 'Galeri Video', icon: Youtube, path: '/dashboard-guru/video', perm: 'video' },
      ],
    },
    {
      type: 'group',
      id: 'pengaturan',
      name: 'Pengaturan',
      icon: Settings,
      items: [
        { name: 'Ganti Password', icon: KeyRound, path: '/dashboard-guru/settings', perm: 'password' },
        { name: 'Kelola Pengguna', icon: Users, path: '/dashboard-guru/users', perm: 'kelola_pengguna' },
      ],
    },
  ], []);

  // Filter navigasi berdasarkan izin user yang aktif
  const navigationConfig = useMemo(() => {
    return rawNavigationConfig
      .map((node) => {
        if (node.type === 'item') {
          return hasPermission(node.perm) ? node : null;
        }
        if (node.type === 'group') {
          const visibleItems = node.items.filter((item) => hasPermission(item.perm));
          if (visibleItems.length === 0) return null;
          return { ...node, items: visibleItems };
        }
        return null;
      })
      .filter(Boolean);
  }, [rawNavigationConfig, currentUser]);

  // Cek apakah halaman saat ini diizinkan untuk dibuka
  const isCurrentPageAllowed = useMemo(() => {
    if (!currentUser) return true;
    if (currentUser.role === 'superadmin') return true;

    // Cari item yang cocok dengan path aktif
    for (const node of rawNavigationConfig) {
      if (node.type === 'item' && node.path === location.pathname) {
        return hasPermission(node.perm);
      }
      if (node.type === 'group') {
        const found = node.items.find((it) => it.path === location.pathname);
        if (found) {
          return hasPermission(found.perm);
        }
      }
    }
    return true;
  }, [location.pathname, rawNavigationConfig, currentUser]);

  // State Accordion Eksklusif: Default tertutup semua (null)
  const [activeExpandedGroup, setActiveExpandedGroup] = useState(null);

  // Buka group secara otomatis jika anak menu di dalamnya sedang aktif
  useEffect(() => {
    for (const node of navigationConfig) {
      if (node.type === 'group' && node.items.some((it) => it.path === location.pathname)) {
        setActiveExpandedGroup(node.id);
        break;
      }
    }
  }, [location.pathname, navigationConfig]);

  // Toggle: jika parent yang diklik sedang terbuka, maka tutup. Jika belum, buka parent ini dan tutup yang lain
  const toggleGroup = (groupId) => {
    setActiveExpandedGroup((current) => (current === groupId ? null : groupId));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isTeacherAuthenticated');
    sessionStorage.removeItem('teacherUser');
    localStorage.removeItem('isTeacherAuthenticated');
    localStorage.removeItem('teacherUser');
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    navigate('/');
  };

  // Label Peran yang Ramah
  const getRoleLabel = (role) => {
    switch (role) {
      case 'superadmin':
        return 'Super Admin';
      case 'tu':
        return 'Staf Tata Usaha';
      case 'humas':
        return 'Tim Humas';
      case 'guru':
        return 'Guru Pengajar';
      default:
        return role ? role.toUpperCase() : 'Guru Pengajar';
    }
  };

  // Renderer Navigasi Tree (Dipakai bersama di Desktop & Mobile)
  const renderNavItems = (isMobile = false) => (
    <div className="space-y-1.5">
      {navigationConfig.map((node) => {
        if (node.type === 'item') {
          const isActive = location.pathname === node.path;
          return (
            <Link
              key={node.path}
              to={node.path}
              onClick={() => isMobile && setIsMobileMenuOpen(false)}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all group ${
                isActive
                  ? 'bg-secondary text-white shadow-lg shadow-secondary/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <node.icon
                  size={18}
                  className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-secondary transition-colors'}
                />
                <span className="truncate">{node.name}</span>
              </div>
              {isActive && <ChevronRight size={14} className="shrink-0" />}
            </Link>
          );
        }

        if (node.type === 'group') {
          const isGroupActive = node.items.some((it) => location.pathname === it.path);
          const isExpanded = activeExpandedGroup === node.id;

          return (
            <div key={node.id} className="pt-1">
              {/* Tombol Parent Accordion */}
              <button
                type="button"
                onClick={() => toggleGroup(node.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all ${
                  isGroupActive
                    ? 'text-white bg-white/10 border border-secondary/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <node.icon
                    size={18}
                    className={isGroupActive ? 'text-secondary' : 'text-slate-400'}
                  />
                  <span className="truncate">{node.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                    {node.items.length}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-secondary' : 'text-slate-500'
                    }`}
                  />
                </div>
              </button>

              {/* Child Menu Tree (Animasi Expand-Collapse) */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="ml-5 pl-2.5 sm:pl-3 border-l-2 border-white/10 space-y-1 my-1.5">
                      {node.items.map((child) => {
                        const isChildActive = location.pathname === child.path;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => isMobile && setIsMobileMenuOpen(false)}
                            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all group ${
                              isChildActive
                                ? 'bg-secondary text-white shadow-md shadow-secondary/20'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <child.icon
                                size={16}
                                className={isChildActive ? 'text-white' : 'text-slate-500 group-hover:text-secondary transition-colors'}
                              />
                              <span className="truncate">{child.name}</span>
                            </div>
                            {isChildActive && <ChevronRight size={13} className="shrink-0" />}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }

        return null;
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-slate-950 text-white flex-col border-r border-white/5 shrink-0">
        <div className="p-8 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-secondary/20">IS</div>
            <div>
              <h1 className="font-black text-sm leading-tight">GURU PANEL</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">SD Imam Syafii</p>
            </div>
          </div>
        </div>

        <nav className="flex-grow px-4 overflow-y-auto">
          <p className="text-[10px] uppercase font-black text-slate-600 tracking-[0.2em] mb-3 px-4">Menu Navigasi</p>
          {renderNavItems(false)}
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-white/5 rounded-3xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold border-2 border-white/10 overflow-hidden shrink-0">
                <User size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black truncate">{currentUser?.name || 'Pengguna Guru'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    currentUser?.role === 'superadmin'
                      ? 'bg-amber-500/20 text-amber-300'
                      : currentUser?.role === 'tu'
                      ? 'bg-blue-500/20 text-blue-300'
                      : currentUser?.role === 'humas'
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {getRoleLabel(currentUser?.role)}
                  </span>
                </div>
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
      <header className="md:hidden bg-slate-950 text-white p-4 flex items-center justify-between sticky top-0 z-[100] shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center text-white font-black text-xs">IS</div>
          <span className="font-black text-xs tracking-widest uppercase">Guru Panel</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white/10 rounded-xl active:scale-95 transition-all text-white"
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Menu Overlay — Scrollable dengan collapsible tree */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '-100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-0 z-[90] bg-slate-950 pt-16 flex flex-col md:hidden overflow-y-auto"
          >
            <nav className="p-4 sm:p-6 pb-10 flex-grow">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 mb-4">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold shrink-0">
                  <User size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-white truncate">{currentUser?.name || 'Pengguna Guru'}</p>
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    {getRoleLabel(currentUser?.role)}
                  </p>
                </div>
              </div>

              <p className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] mb-3 px-3">
                Menu Utama Guru
              </p>
              {renderNavItems(true)}
              <div className="pt-4 border-t border-white/10 mt-6">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/20 transition-all"
                >
                  <LogOut size={18} /> Keluar Panel
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area — Natural document flow agar vertical scroll bebas bergerak */}
      <main className="flex-1 min-w-0 w-full pt-0 md:pt-0">
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
                 <p className="text-xs font-black text-slate-900">{currentUser?.name || 'Admin Sekolah'}</p>
                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                   {getRoleLabel(currentUser?.role)}
                 </p>
               </div>
               <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 border border-slate-200">
                 <User size={20} />
               </div>
             </div>
           </div>
        </header>

        {/* Banner Peringatan Sesi Kedaluwarsa */}
        {isSessionExpired && (
          <div className="bg-rose-600 text-white px-4 py-3 flex items-center justify-between text-xs font-bold shadow-md sticky top-0 md:top-20 z-50 animate-in fade-in">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="shrink-0 text-amber-300" />
              <span>Sesi login Anda telah berakhir. Perubahan baru mungkin belum tersimpan ke server.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsReauthModalOpen(true);
                setReauthError('');
                setReauthPassword('');
              }}
              className="bg-white text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors uppercase text-[10px] font-black shrink-0 ml-3 shadow-sm active:scale-95"
            >
              Login Ulang di Sini
            </button>
          </div>
        )}

        {/* Modal Pop-up In-Place Re-auth (Tanpa Reload Halaman) */}
        <AnimatePresence>
          {isReauthModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setIsReauthModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-100"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                  <KeyRound size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Perpanjang Sesi Login</h3>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Masukkan password akun <strong className="text-slate-800 font-black">[{currentUser?.name || currentUser?.username || 'Guru'}]</strong> untuk melanjutkan pekerjaan tanpa me-reload halaman.
                </p>

                {reauthError && (
                  <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                    {reauthError}
                  </div>
                )}

                <form onSubmit={handleReauthSubmit} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Password Akun
                    </label>
                    <input
                      type="password"
                      autoFocus
                      required
                      value={reauthPassword}
                      onChange={(e) => setReauthPassword(e.target.value)}
                      placeholder="Masukkan password..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsReauthModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={reauthLoading}
                      className="flex-1 py-2.5 rounded-xl bg-secondary hover:brightness-95 text-white text-xs font-black shadow-md shadow-secondary/20 transition-all disabled:opacity-50"
                    >
                      {reauthLoading ? 'Memeriksa…' : 'Masuk Kembali'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Padding responsif: pas kanan-kiri di HP (px-3 py-4 = 12px) dan lapang di PC (10 = 40px), safe bottom space */}
        <div className="px-3 py-4 sm:p-6 md:p-10 w-full max-w-5xl mx-auto min-w-0 pb-28 md:pb-12">
          {!isCurrentPageAllowed ? (
            <div className="max-w-xl mx-auto my-12 bg-white p-8 rounded-3xl border border-rose-100 shadow-sm text-center">
              <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <ShieldAlert size={32} />
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2">Akses Halaman Dibatasi</h2>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-6">
                Akun Anda (<span className="font-black text-slate-700">{currentUser?.name || 'Pengguna'}</span>) dengan peran{' '}
                <span className="font-black text-rose-600">[{getRoleLabel(currentUser?.role)}]</span> tidak memiliki hak akses untuk membuka modul ini. Silakan hubungi Super Admin jika membutuhkan wewenang akses tambahan.
              </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard-guru')}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-secondary text-white text-xs font-black hover:bg-forest transition-all shadow-md shadow-secondary/20 active:scale-95"
              >
                <ArrowLeft size={16} /> Kembali ke Dashboard
              </button>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
