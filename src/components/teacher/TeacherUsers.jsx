import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  KeyRound,
  Shield,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Lock,
  GraduationCap,
  CalendarCheck,
  Globe,
  Settings,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuthUsers, addAuthUser, updateAuthUser, deleteAuthUser } from '../../services/gsheet';
import { Modal, ModalFooter, ConfirmDialog, ToastNotification } from './ModalKit';

// Daftar Pohon Modul dan Permission Keys
export const MODULE_PERMISSIONS = [
  {
    groupId: 'dashboard',
    groupName: 'Dashboard Utama',
    icon: Sparkles,
    modules: [
      { key: 'dashboard', label: 'Dashboard Ringkasan Utama', path: '/dashboard-guru' },
    ],
  },
  {
    groupId: 'akademik',
    groupName: 'Akademik & Nilai',
    icon: GraduationCap,
    modules: [
      { key: 'siswa', label: 'Data Siswa (KK)', path: '/dashboard-guru/siswa' },
      { key: 'mapel', label: 'Mata Pelajaran', path: '/dashboard-guru/mapel' },
      { key: 'soal', label: 'Bank Soal', path: '/dashboard-guru/soal' },
      { key: 'eraport', label: 'E-Raport Kurikulum Merdeka', path: '/dashboard-guru/eraport' },
      { key: 'nilai', label: 'Publikasi Nilai', path: '/dashboard-guru/nilai' },
    ],
  },
  {
    groupId: 'absensi',
    groupName: 'Absensi Guru',
    icon: CalendarCheck,
    modules: [
      { key: 'absensi_harian', label: 'Absen Harian (Self Check-in)', path: '/dashboard-guru/absensi' },
      { key: 'absensi_guru', label: 'Data Guru & Jadwal', path: '/dashboard-guru/absensi-guru' },
      { key: 'absensi_rekap', label: 'Rekap Presensi & Koreksi', path: '/dashboard-guru/absensi-rekap' },
      { key: 'absensi_settings', label: 'Pengaturan Presensi GPS', path: '/dashboard-guru/absensi-settings' },
    ],
  },
  {
    groupId: 'konten',
    groupName: 'Konten Web Sekolah',
    icon: Globe,
    modules: [
      { key: 'galeri', label: 'Galeri Siswa', path: '/dashboard-guru/galeri' },
      { key: 'pengajar', label: 'Tim Pengajar', path: '/dashboard-guru/pengajar' },
      { key: 'warta', label: 'Warta Terbaru', path: '/dashboard-guru/warta' },
      { key: 'video', label: 'Galeri Video', path: '/dashboard-guru/video' },
    ],
  },
  {
    groupId: 'pengaturan',
    groupName: 'Pengaturan Sistem',
    icon: Settings,
    modules: [
      { key: 'password', label: 'Ganti Password Akun Pribadi', path: '/dashboard-guru/settings' },
      { key: 'kelola_pengguna', label: 'Kelola Pengguna & Hak Akses', path: '/dashboard-guru/users' },
    ],
  },
];

// Semua keys modul
export const ALL_MODULE_KEYS = MODULE_PERMISSIONS.flatMap((g) => g.modules.map((m) => m.key));

// Preset Template Role Cepat
export const ROLE_PRESETS = {
  superadmin: {
    label: 'Super Admin',
    desc: 'Akses penuh ke semua fitur dan pengaturan pengguna',
    color: 'from-amber-500 to-amber-700',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    permissions: ['all', ...ALL_MODULE_KEYS],
  },
  guru: {
    label: 'Guru Pengajar',
    desc: 'Akses ke Bank Soal, E-Raport, Data Siswa, Absen Harian & Ganti Password',
    color: 'from-emerald-600 to-emerald-800',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    permissions: ['dashboard', 'siswa', 'soal', 'eraport', 'absensi_harian', 'password'],
  },
  tu: {
    label: 'Staf TU / Operator',
    desc: 'Akses ke Data Siswa, Mapel, Jadwal Guru, Rekap Presensi & Ganti Password',
    color: 'from-blue-600 to-blue-800',
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    permissions: ['dashboard', 'siswa', 'mapel', 'nilai', 'absensi_guru', 'absensi_rekap', 'password'],
  },
  humas: {
    label: 'Tim Humas / Web',
    desc: 'Akses ke manajemen konten web sekolah (Galeri, Warta, Pengajar, Video)',
    color: 'from-purple-600 to-purple-800',
    badge: 'bg-purple-50 text-purple-800 border-purple-200',
    permissions: ['dashboard', 'galeri', 'pengajar', 'warta', 'video', 'password'],
  },
  custom: {
    label: 'Kustom Mandiri',
    desc: 'Centang pohon izin modul secara manual sesuai kebutuhan',
    color: 'from-slate-600 to-slate-800',
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    permissions: ['dashboard', 'password'],
  },
};

export default function TeacherUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSessionUser, setCurrentSessionUser] = useState(null);

  // Modal State
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [form, setForm] = useState({
    username: '',
    name: '',
    password: '',
    role: 'guru',
    permissions: ROLE_PRESETS.guru.permissions,
    is_active: 1,
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', title: '' });
  const showToast = (message, type = 'success', title = '') => {
    setToast({ show: true, message, type, title });
  };

  // Muat user dari sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('teacherUser');
      if (stored) setCurrentSessionUser(JSON.parse(stored));
    } catch {}
  }, []);

  const loadData = async () => {
    setLoading(true);
    const res = await getAuthUsers();
    if (res.success) {
      setUsers(res.users || []);
    } else {
      showToast(res.error || 'Gagal memuat daftar pengguna.', 'error', 'Error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setForm({
      username: '',
      name: '',
      password: '',
      role: 'guru',
      permissions: [...ROLE_PRESETS.guru.permissions],
      is_active: 1,
    });
    setFormModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    let parsedPerms = [];
    try {
      parsedPerms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || []);
    } catch {
      parsedPerms = ['all'];
    }

    setForm({
      username: user.username,
      name: user.name || '',
      password: '',
      role: user.role || (user.username === 'admin' || user.username === 'guru' ? 'superadmin' : 'guru'),
      permissions: parsedPerms.includes('all') ? ['all', ...ALL_MODULE_KEYS] : parsedPerms,
      is_active: user.is_active != null ? Number(user.is_active) : 1,
    });
    setFormModalOpen(true);
  };

  const handleSelectRolePreset = (roleKey) => {
    const preset = ROLE_PRESETS[roleKey];
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      role: roleKey,
      permissions: [...preset.permissions],
    }));
  };

  const handleTogglePermission = (permKey) => {
    setForm((prev) => {
      const has = prev.permissions.includes(permKey);
      let next = has ? prev.permissions.filter((p) => p !== permKey && p !== 'all') : [...prev.permissions, permKey];
      return {
        ...prev,
        role: 'custom',
        permissions: next,
      };
    });
  };

  const handleToggleGroup = (groupId) => {
    const grp = MODULE_PERMISSIONS.find((g) => g.groupId === groupId);
    if (!grp) return;
    const groupKeys = grp.modules.map((m) => m.key);
    const allChecked = groupKeys.every((k) => form.permissions.includes(k));

    setForm((prev) => {
      let next;
      if (allChecked) {
        next = prev.permissions.filter((k) => !groupKeys.includes(k) && k !== 'all');
      } else {
        const set = new Set([...prev.permissions, ...groupKeys]);
        next = Array.from(set);
      }
      return {
        ...prev,
        role: 'custom',
        permissions: next,
      };
    });
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Nama pengguna wajib diisi.', 'error', 'Validasi');
      return;
    }

    if (!form.username.trim() || form.username.length < 3) {
      showToast('Username minimal 3 karakter.', 'error', 'Validasi');
      return;
    }

    if (!editingUser) {
      if (!form.password || form.password.length < 6) {
        showToast('Password minimal 6 karakter.', 'error', 'Validasi');
        return;
      }
    } else {
      if (form.password && form.password.length < 6) {
        showToast('Password baru minimal 6 karakter.', 'error', 'Validasi');
        return;
      }
    }

    setSubmitting(true);
    let res;
    if (editingUser) {
      res = await updateAuthUser({
        id: editingUser.id,
        username: form.username.trim().toLowerCase(),
        name: form.name,
        role: form.role,
        permissions: form.role === 'superadmin' ? ['all'] : form.permissions,
        is_active: form.is_active,
        password: form.password || undefined,
      });
    } else {
      res = await addAuthUser({
        username: form.username.trim().toLowerCase(),
        name: form.name,
        password: form.password,
        role: form.role,
        permissions: form.role === 'superadmin' ? ['all'] : form.permissions,
        is_active: form.is_active,
      });
    }
    setSubmitting(false);

    if (res.success) {
      if (currentSessionUser && editingUser && (currentSessionUser.username === editingUser.username || currentSessionUser.id === editingUser.id)) {
        const updatedSession = {
          ...currentSessionUser,
          username: form.username.trim().toLowerCase(),
          name: form.name,
          role: form.role,
        };
        localStorage.setItem('teacherUser', JSON.stringify(updatedSession));
        sessionStorage.setItem('teacherUser', JSON.stringify(updatedSession));
        setCurrentSessionUser(updatedSession);
      }
      showToast(
        editingUser
          ? `Data pengguna "${form.name}" berhasil diperbarui.`
          : `Pengguna "${form.name}" berhasil didaftarkan.`,
        'success',
        'Berhasil'
      );
      setFormModalOpen(false);
      loadData();
    } else {
      showToast(res.error || 'Gagal menyimpan pengguna.', 'error', 'Error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    const res = await deleteAuthUser(deleteTarget.id);
    setDeleting(false);

    if (res.success) {
      showToast(`Pengguna "${deleteTarget.name}" berhasil dihapus.`, 'success', 'Dihapus');
      setDeleteTarget(null);
      loadData();
    } else {
      showToast(res.error || 'Gagal menghapus pengguna.', 'error', 'Error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <ToastNotification toast={toast} setToast={setToast} />

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-secondary to-forest text-white rounded-2xl shadow-lg shadow-secondary/20">
            <Users size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                Kelola Pengguna & Hak Akses
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-secondary text-xs font-black border border-secondary/20">
                {users.length} User
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
              Multi-password dan kontrol hak akses pohon modul dashboard untuk guru dan staf sekolah.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
            title="Muat Ulang Data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin text-secondary' : ''} />
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-secondary hover:bg-forest text-white font-black text-xs sm:text-sm shadow-lg shadow-secondary/25 transition-all transform active:scale-95"
          >
            <Plus size={18} />
            <span>Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {/* Tabel Pengguna */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 font-bold text-xs flex flex-col items-center gap-2">
            <RefreshCw size={28} className="animate-spin text-secondary mb-1" />
            <span>Memuat data pengguna…</span>
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold text-xs space-y-2">
            <Users size={48} className="mx-auto text-slate-300" />
            <p className="text-slate-800 font-black text-sm">Belum Ada Pengguna</p>
            <p>Klik tombol "Tambah Pengguna" di atas untuk mendaftarkan akun baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-4 px-6">Pengguna & Username</th>
                  <th className="py-4 px-4">Peran (Role)</th>
                  <th className="py-4 px-4">Cakupan Hak Akses</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {users.map((u) => {
                  const isRootAdmin = u.username === 'admin' || u.username === 'guru';
                  const isSelf = currentSessionUser && currentSessionUser.username === u.username;
                  const isActive = u.is_active != null ? Number(u.is_active) === 1 : true;
                  const preset = ROLE_PRESETS[u.role] || ROLE_PRESETS.custom;

                  let perms = [];
                  try {
                    perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : (u.permissions || []);
                  } catch {
                    perms = [];
                  }
                  const hasAll = perms.includes('all') || isRootAdmin || u.role === 'superadmin';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center font-black text-sm shrink-0">
                            {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-black text-slate-900 text-sm">{u.name || u.username}</p>
                              {isRootAdmin && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-black tracking-wider">
                                  ROOT
                                </span>
                              )}
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black tracking-wider">
                                  ANDA
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border ${preset.badge}`}>
                          <Shield size={12} />
                          <span>{preset.label}</span>
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        {hasAll ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-black text-xs">
                            <Sparkles size={13} className="text-amber-500" />
                            <span>Semua Modul (Full Access)</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap max-w-sm">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black">
                              {perms.length} Modul Terbuka
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isActive ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          <span>{isActive ? 'Aktif' : 'Dinonaktifkan'}</span>
                        </span>
                      </td>

                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-secondary hover:text-white text-slate-600 transition-all"
                            title="Edit Data & Hak Akses"
                          >
                            <Edit2 size={13} />
                          </button>
                          {!isRootAdmin && !isSelf ? (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(u)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-600 transition-all"
                              title="Hapus Pengguna"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : (
                            <div className="w-[29px]" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL TAMBAH / EDIT PENGGUNA */}
      <AnimatePresence>
        {formModalOpen && (
          <Modal
            onClose={() => !submitting && setFormModalOpen(false)}
            title={editingUser ? `Edit Pengguna: ${editingUser.name || editingUser.username}` : 'Tambah Pengguna Baru'}
          >
            <form onSubmit={handleSubmitForm} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Form Input Dasar */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Nama Lengkap / Panggilan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Contoh: Ustadz Ahmad Fauzi, S.Pd."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-secondary transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      Username Login <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                      placeholder="Contoh: ustadz_ahmad"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-secondary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      {editingUser ? 'Ganti Password (Opsional)' : 'Kata Sandi (Password) *'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={editingUser ? 'Kosongkan jika tak diubah' : 'Minimal 6 karakter'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-secondary transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Pemilihan Role Preset Cepat */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-800">
                    Template Peran (Role Preset)
                  </label>
                  <span className="text-[11px] font-bold text-secondary">
                    Otomatis memilih hak akses pohon menu
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(ROLE_PRESETS)
                    .filter(([k]) => k !== 'custom')
                    .map(([roleKey, preset]) => {
                      const isSelected = form.role === roleKey;
                      return (
                        <button
                          key={roleKey}
                          type="button"
                          onClick={() => handleSelectRolePreset(roleKey)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-secondary text-white border-secondary shadow-md shadow-secondary/20'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <p className="font-black text-xs">{preset.label}</p>
                          <p className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {preset.desc}
                          </p>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Checklist Pohon Modul Navigasi (Granular Permissions) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-800">
                    Centang Pohon Menu yang Boleh Dibuka
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, permissions: ['all', ...ALL_MODULE_KEYS], role: 'superadmin' })}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-secondary text-[10px] font-black border border-secondary/20 hover:bg-emerald-100"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, permissions: ['dashboard', 'password'], role: 'custom' })}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black hover:bg-slate-200"
                    >
                      Reset Minimal
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {MODULE_PERMISSIONS.map((group) => {
                    const groupKeys = group.modules.map((m) => m.key);
                    const allInGroupChecked = groupKeys.every((k) => form.permissions.includes(k) || form.permissions.includes('all'));
                    const someInGroupChecked = groupKeys.some((k) => form.permissions.includes(k) || form.permissions.includes('all'));
                    const Icon = group.icon;

                    return (
                      <div
                        key={group.groupId}
                        className="rounded-2xl border border-slate-200 overflow-hidden bg-white"
                      >
                        {/* Header Group */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <Icon size={15} className="text-secondary" />
                            <span className="text-xs font-black text-slate-800">{group.groupName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleGroup(group.groupId)}
                            className="text-[11px] font-black text-secondary hover:underline"
                          >
                            {allInGroupChecked ? 'Batalkan Grup' : 'Centang Grup'}
                          </button>
                        </div>

                        {/* List Modul Anak */}
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                          {group.modules.map((mod) => {
                            const isChecked = form.permissions.includes(mod.key) || form.permissions.includes('all');
                            return (
                              <label
                                key={mod.key}
                                className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-emerald-50/70 border-emerald-300 text-slate-900'
                                    : 'bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(mod.key)}
                                  className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
                                />
                                <span className="text-xs font-bold leading-tight">{mod.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Aktif User */}
              {(!editingUser || (editingUser.username !== 'admin' && editingUser.username !== 'guru')) && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <p className="text-xs font-black text-slate-800">Status Akun Pengguna</p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Jika dinonaktifkan, pengguna tidak dapat masuk ke sistem dashboard.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active === 1}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                  </label>
                </div>
              )}

              <ModalFooter>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormModalOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-secondary text-white font-black text-xs hover:bg-forest shadow-md shadow-secondary/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    {submitting && <RefreshCw size={14} className="animate-spin" />}
                    <span>{submitting ? 'Menyimpan…' : editingUser ? 'Perbarui Pengguna' : 'Simpan Pengguna'}</span>
                  </button>
                </div>
              </ModalFooter>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI HAPUS PENGGUNA */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            open={true}
            type="danger"
            title="Hapus Pengguna?"
            message={`Apakah Anda yakin ingin menghapus akun "${deleteTarget.name}" (@${deleteTarget.username})? Pengguna ini tidak akan bisa login lagi.`}
            confirmLabel="Ya, Hapus Pengguna"
            cancelLabel="Batal"
            loading={deleting}
            onConfirm={handleConfirmDelete}
            onCancel={() => !deleting && setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

